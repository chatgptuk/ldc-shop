import { redirect } from "next/navigation";

export default async function CallbackPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const orderId = params.out_trade_no;

    if (orderId && typeof orderId === 'string') {
        redirect(`/order/${orderId}`);
    }

    redirect('/');
}
