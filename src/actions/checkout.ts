'use server'

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { products, cards, orders, loginUsers } from "@/lib/db/schema"
import { cancelExpiredOrders } from "@/lib/db/queries"
import { generateOrderId, generateSign } from "@/lib/crypto"
import { eq, sql, and, or } from "drizzle-orm"
import { cookies } from "next/headers"

function isMissingColumnError(error: any) {
    const errorString = JSON.stringify(error)
    return errorString.includes('42703') || error?.message?.includes('does not exist')
}

function getMaxPointDeduction(totalAmount: number, quantity: number, maxPointsDiscount: string | number | null | undefined) {
    const rawLimit = typeof maxPointsDiscount === 'string' ? maxPointsDiscount.trim() : maxPointsDiscount
    if (rawLimit === null || rawLimit === undefined || rawLimit === '') {
        return Math.ceil(totalAmount)
    }

    const unitLimit = Number(rawLimit)
    if (!Number.isFinite(unitLimit) || unitLimit < 0) {
        return Math.ceil(totalAmount)
    }

    const cappedAmount = Math.min(totalAmount, unitLimit * quantity)
    if (cappedAmount >= totalAmount) {
        return Math.ceil(totalAmount)
    }

    return Math.floor(Math.max(0, cappedAmount))
}

export async function createOrder(productId: string, quantity: number = 1, email?: string, usePoints: boolean = false) {
    const session = await auth()
    const user = session?.user

    // 1. Get Product
    const getCheckoutProduct = async () => {
        const query = () => db.query.products.findFirst({
            where: eq(products.id, productId),
            columns: {
                id: true,
                name: true,
                price: true,
                purchaseLimit: true,
                maxPointsDiscount: true
            }
        })

        try {
            return await query()
        } catch (error: any) {
            if (!isMissingColumnError(error)) throw error
            await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS max_points_discount DECIMAL(10, 2);`)
            return await query()
        }
    }
    const product = await getCheckoutProduct()
    if (!product) return { success: false, error: 'buy.productNotFound' }

    // 2. Check Blocked Status
    if (user?.id) {
        const userRec = await db.query.loginUsers.findFirst({
            where: eq(loginUsers.userId, user.id),
            columns: { isBlocked: true }
        });
        if (userRec?.isBlocked) {
            return { success: false, error: 'buy.userBlocked' };
        }
    }

    try {
        await cancelExpiredOrders({ productId })
    } catch {
        // Best effort cleanup
    }

    // Points Calculation
    let pointsToUse = 0
    let finalAmount = Number(product.price) * quantity

    if (usePoints && user?.id) {
        const userRec = await db.query.loginUsers.findFirst({
            where: eq(loginUsers.userId, user.id),
            columns: { points: true }
        })
        const currentPoints = userRec?.points || 0

        if (currentPoints > 0) {
            // Logic: 1 Point = 1 Unit of currency
            pointsToUse = Math.min(currentPoints, getMaxPointDeduction(finalAmount, quantity, product.maxPointsDiscount))
            finalAmount = Math.max(0, finalAmount - pointsToUse)
        }
    }

    const isZeroPrice = finalAmount <= 0

    const ensureCardsReservationColumns = async () => {
        await db.execute(sql`
            ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_order_id TEXT;
            ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
        `);
    }

    const ensureOrdersQuantityColumn = async () => {
        await db.execute(sql`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 NOT NULL;
        `);
    }

    const ensureCardsIsUsedDefaults = async () => {
        await db.execute(sql`
            ALTER TABLE cards ALTER COLUMN is_used SET DEFAULT FALSE;
            UPDATE cards SET is_used = FALSE WHERE is_used IS NULL;
        `);
    }

    const getAvailableStock = async () => {
        const result = await db.select({ count: sql<number>`count(*)::int` })
            .from(cards)
            .where(sql`
                ${cards.productId} = ${productId}
                AND (COALESCE(${cards.isUsed}, false) = false)
                AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < NOW() - INTERVAL '5 minutes')
            `)
        return result[0]?.count || 0
    }

    // 2. Check Stock
    let stock = 0
    try {
        stock = await getAvailableStock()
    } catch (error: any) {
        const errorString = JSON.stringify(error)
        const isMissingColumn =
            error?.message?.includes('reserved_order_id') ||
            error?.message?.includes('reserved_at') ||
            errorString.includes('42703')

        if (isMissingColumn) {
            await ensureCardsReservationColumns()
            stock = await getAvailableStock()
        } else {
            throw error
        }
    }

    // Check again if needed
    if (stock < quantity) {
        try {
            const nullUsed = await db.select({ count: sql<number>`count(*)::int` })
                .from(cards)
                .where(sql`${cards.productId} = ${productId} AND ${cards.isUsed} IS NULL`)
            if ((nullUsed[0]?.count || 0) > 0) {
                await ensureCardsIsUsedDefaults()
                stock = await getAvailableStock()
            }
        } catch {
            // ignore
        }
    }

    if (stock < quantity) return { success: false, error: 'buy.outOfStock' }

    // 3. Check Purchase Limit
    if (product.purchaseLimit && product.purchaseLimit > 0) {
        const currentUserId = user?.id
        const currentUserEmail = email || user?.email

        if (currentUserId || currentUserEmail) {
            const conditions = [eq(orders.productId, productId)]
            const userConditions = []

            if (currentUserId) userConditions.push(eq(orders.userId, currentUserId))
            if (currentUserEmail) userConditions.push(eq(orders.email, currentUserEmail))

            if (userConditions.length > 0) {
                try {
                    const countResult = await db.select({
                        totalQuantity: sql<number>`coalesce(sum(${orders.quantity}), count(*))::int`
                    })
                        .from(orders)
                        .where(and(
                            eq(orders.productId, productId),
                            or(...userConditions),
                            or(eq(orders.status, 'paid'), eq(orders.status, 'delivered'))
                        ))

                    const existingCount = countResult[0]?.totalQuantity || 0
                    if (existingCount + quantity > product.purchaseLimit) {
                        return { success: false, error: 'buy.limitExceeded' }
                    }
                } catch (e: any) {
                    // If column missing, try ensuring it (best effort for first run)
                    await ensureOrdersQuantityColumn()
                    // Proceeding assuming it's fine or will fail later if critical
                }
            }
        }
    }

    // 4. Create Order + Reserve Stock (1 minute) OR Deliver Immediately
    const orderId = generateOrderId()

    const reserveAndCreate = async () => {
        const { queryOrderStatus } = await import("@/lib/epay")

        await ensureOrdersQuantityColumn()

        const reservedCards: { id: number, key: string }[] = []

        for (let i = 0; i < quantity; i++) {
            let attempts = 0
            const maxAttempts = 3
            let success = false

            while (attempts < maxAttempts && !success) {
                attempts++

                // A. Try strictly free card
                let reservedResult = await db.execute(sql`
                    UPDATE cards
                    SET reserved_order_id = ${orderId}, reserved_at = NOW()
                    WHERE id = (
                        SELECT id
                        FROM cards
                        WHERE product_id = ${productId}
                        AND COALESCE(is_used, false) = false
                        AND reserved_at IS NULL
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                    )
                    RETURNING id, card_key
                `);

                if (reservedResult.rows.length > 0) {
                    reservedCards.push({
                        id: reservedResult.rows[0].id as number,
                        key: reservedResult.rows[0].card_key as string
                    })
                    success = true
                    continue // Break inner while, continue for loop
                }

                // B. Fallback: Expired
                const expiredCandidates = await db.execute(sql`
                    SELECT id, reserved_order_id
                    FROM cards
                    WHERE product_id = ${productId}
                    AND COALESCE(is_used, false) = false
                    AND reserved_at < NOW() - INTERVAL '5 minutes'
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                `)

                if (expiredCandidates.rows.length === 0) {
                    // No candidates found this attempt
                    break // Break inner while, likely will throw stock_locked if loop finishes
                }

                const candidate = expiredCandidates.rows[0]
                const candidateCardId = candidate.id
                const candidateOrderId = candidate.reserved_order_id as string

                let isPaid = false
                try {
                    if (candidateOrderId) {
                        const statusRes = await queryOrderStatus(candidateOrderId)
                        if (statusRes.success && statusRes.status === 1) {
                            isPaid = true
                        }
                    }
                } catch {
                    // ignore verification error, skip
                }

                if (isPaid) {
                    await db.execute(sql`
                        UPDATE cards SET is_used = true, used_at = NOW() WHERE id = ${candidateCardId};
                        UPDATE orders SET status = 'paid', paid_at = NOW() WHERE order_id = ${candidateOrderId} AND status = 'pending';
                    `)
                    continue // Retry this attempt (find another card)
                } else {
                    reservedResult = await db.execute(sql`
                        UPDATE cards
                        SET reserved_order_id = ${orderId}, reserved_at = NOW()
                        WHERE id = ${candidateCardId}
                        RETURNING id, card_key
                    `)
                    if (reservedResult.rows.length > 0) {
                        reservedCards.push({
                            id: reservedResult.rows[0].id as number,
                            key: reservedResult.rows[0].card_key as string
                        })
                        success = true
                    }
                }
            } // end while

            if (!success) {
                throw new Error('stock_locked')
            }
        } // end for

        const joinedKeys = reservedCards.map(c => c.key).join('\n')

        await createOrderRecord(reservedCards, joinedKeys, isZeroPrice, pointsToUse, finalAmount, user, session?.user?.name, email, product, orderId, quantity)
    };

    const createOrderRecord = async (reservedCards: any[], joinedKeys: string, isZeroPrice: boolean, pointsToUse: number, finalAmount: number, user: any, username: any, email: any, product: any, orderId: string, qty: number) => {
        if (pointsToUse > 0) {
            const updatedUser = await db.update(loginUsers)
                .set({ points: sql`${loginUsers.points} - ${pointsToUse}` })
                .where(and(eq(loginUsers.userId, user!.id!), sql`${loginUsers.points} >= ${pointsToUse}`))
                .returning({ points: loginUsers.points });

            if (!updatedUser.length) {
                throw new Error('insufficient_points');
            }
        }

        if (isZeroPrice) {
            const cardIds = reservedCards.map(c => c.id)
            if (cardIds.length > 0) {
                // Using loop for update to be safe with SQL template array syntax dependent on adapter
                // Or simple:
                for (const cid of cardIds) {
                    await db.update(cards).set({
                        isUsed: true,
                        usedAt: new Date(),
                        reservedOrderId: null,
                        reservedAt: null
                    }).where(eq(cards.id, cid));
                }
            }

            await db.insert(orders).values({
                orderId,
                productId: product.id,
                productName: product.name,
                amount: finalAmount.toString(),
                email: email || user?.email || null,
                userId: user?.id || null,
                username: username || user?.username || null,
                status: 'delivered',
                cardKey: joinedKeys,
                paidAt: new Date(),
                deliveredAt: new Date(),
                tradeNo: 'POINTS_REDEMPTION',
                pointsUsed: pointsToUse,
                quantity: qty
            });

        } else {
            await db.insert(orders).values({
                orderId,
                productId: product.id,
                productName: product.name,
                amount: finalAmount.toString(),
                email: email || user?.email || null,
                userId: user?.id || null,
                username: username || user?.username || null,
                status: 'pending',
                pointsUsed: pointsToUse,
                currentPaymentId: orderId,
                quantity: qty
            });
        }
    }

    try {
        await reserveAndCreate();
    } catch (error: any) {
        if (error?.message === 'stock_locked') {
            return { success: false, error: 'buy.stockLocked' };
        }
        if (error?.message === 'insufficient_points') {
            return { success: false, error: 'Points mismatch, please try again.' };
        }

        const errorString = JSON.stringify(error);
        const isMissingColumn =
            error?.message?.includes('reserved_order_id') ||
            error?.message?.includes('reserved_at') ||
            errorString.includes('42703');

        if (isMissingColumn) {
            await ensureCardsReservationColumns()
            try {
                await reserveAndCreate();
            } catch (retryError: any) {
                if (retryError?.message === 'stock_locked') return { success: false, error: 'buy.stockLocked' };
                if (retryError?.message === 'insufficient_points') return { success: false, error: 'Points mismatch' };
                throw retryError;
            }
        } else {
            throw error;
        }
    }

    if (isZeroPrice) {
        return {
            success: true,
            url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/order/${orderId}`,
            isZeroPrice: true
        }
    }

    const cookieStore = await cookies()
    cookieStore.set('ldc_pending_order', orderId, { secure: true, path: '/', sameSite: 'lax' })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const payParams: Record<string, any> = {
        pid: process.env.MERCHANT_ID!,
        type: 'epay',
        out_trade_no: orderId,
        notify_url: `${baseUrl}/api/notify`,
        return_url: `${baseUrl}/callback/${orderId}`,
        name: product.name,
        money: Number(finalAmount).toFixed(2),
        sign_type: 'MD5'
    }

    payParams.sign = generateSign(payParams, process.env.MERCHANT_KEY!)

    return {
        success: true,
        url: process.env.PAY_URL || 'https://credit.linux.do/epay/pay/submit.php',
        params: payParams
    }
}

export async function getRetryPaymentParams(orderId: string) {
    const session = await auth()
    const user = session?.user

    if (!user?.id) return { success: false, error: 'common.error' }

    const order = await db.query.orders.findFirst({
        where: and(eq(orders.orderId, orderId), eq(orders.userId, user.id))
    })

    if (!order) return { success: false, error: 'buy.productNotFound' }
    if (order.status !== 'pending') return { success: false, error: 'order.status.paid' }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const uniqueTradeNo = `${order.orderId}_retry${Date.now()}`;

    await db.update(orders)
        .set({ currentPaymentId: uniqueTradeNo })
        .where(eq(orders.orderId, orderId))

    const payParams: Record<string, any> = {
        pid: process.env.MERCHANT_ID!,
        type: 'epay',
        out_trade_no: uniqueTradeNo,
        notify_url: `${baseUrl}/api/notify`,
        return_url: `${baseUrl}/callback/${order.orderId}`,
        name: order.productName,
        money: Number(order.amount).toFixed(2),
        sign_type: 'MD5'
    }

    payParams.sign = generateSign(payParams, process.env.MERCHANT_KEY!)

    return {
        success: true,
        url: process.env.PAY_URL || 'https://credit.linux.do/epay/pay/submit.php',
        params: payParams
    }
}
