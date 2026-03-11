# LDC Shop (Cloudflare Workers Edition)

[中文说明](./README.md)

---


Serverless virtual goods store built with **Next.js 16**, **Cloudflare Workers** (OpenNext), **D1 Database**, and **Shadcn UI**.

## 🛠 Technical Architecture

This version adopts the cutting-edge **Next.js on Workers** approach, rather than a traditional single-file Worker:

*   **Core Framework**: **Next.js 16 (App Router)** - Maintains the same modern development experience as the Vercel version.
*   **Adapter**: **OpenNext (Cloudflare Adapter)** - The most advanced solution for deployed Next.js on Workers, supporting most Next.js features.
*   **Database**: **Cloudflare D1 (SQLite)** - Edge-native relational database, replacing Vercel Postgres.
*   **ORM**: **Drizzle ORM** - Perfectly adapted for D1, providing type-safe SQL operations.
*   **Deployment**: **Wrangler** - One-click deployment to the global edge network.

This architecture aims to combine the development efficiency of Next.js with the edge performance and low cost advantages of Cloudflare.



## ✨ Features

- **Modern Stack**: Next.js 16 (App Router), Tailwind CSS, TypeScript.
- **Edge Native**: Cloudflare Workers + D1 Database, low cost and high performance.
- **Linux DO Integration**: Built-in OIDC login and EasyPay payments.
- **Storefront Experience**:
    - 🔍 **Search & Categories**: Client-side search and category filters; dedicated **search page** `/search` with server-side search, pagination, category and sort.
    - 💡 **Wishlist & Voting**: Users can submit and vote for desired products (admin can enable/disable).
    - 📢 **Announcement Banner**: Configurable homepage announcements.
    - 📝 **Markdown Descriptions**: Rich product descriptions.
    - ⚠️ **Purchase Warning**: Optional pre-purchase warning modal.
    - ❓ **Pre-Purchase Questions**: Admins can set multiple Q&A questions per product; buyers must answer all correctly before ordering (dual client + server validation).
    - 🔒 **Product Visibility**: Products can be restricted by user trust level (0–3); users below the level see a “login or upgrade” message.
    - 🔥 **Hot & Discounts**: Hot tag and original/discount price display.
    - ⭐ **Ratings & Reviews**: Verified buyers can rate and review.
    - 📦 **Stock & Sold Counters**: Real-time inventory and sales display.
    - ♾️ **Shared Products**: Infinite-stock items for shared accounts/tutorials.
    - 🚫 **Purchase Limits**: Limit purchases by paid order count.
    - 🔢 **Quantity Selection**: Support purchasing multiple items.
    - 🏷️ **Custom Store Name**: Configurable store name in header/title.
    - 📐 **Product Variants**: Multiple variants per product (e.g. monthly/yearly) with separate price and stock; homepage shows price range and variant count with **aggregated stock/sold/review stats across all variants**; detail page variant selector with per-variant sold count; admin and user order records show variant label; card keys are managed per variant (per product).
- **Orders & Delivery**:
    - ✅ **Payment Callback Verification**: Signature and amount checks.
    - 🎁 **Auto Delivery**: Card key delivery on payment; paid status retained if out of stock.
    - 📦 **Multi-Card Delivery**: Display multiple card keys for multi-quantity orders.
    - 📧 **Default Email**: Users can set a default email in profile for delivery notifications.
    - 🔒 **Stock Reservation**: 5-minute hold after entering checkout to prevent oversell.
    - ⏱️ **Auto-Cancel**: Unpaid orders are cancelled after 5 minutes and stock is released.
    - 🧾 **Order Center**: Order list and details pages; order records show product variant label when applicable.
    - 🔔 **Pending Order Alert**: Homepage banner reminds users of unpaid orders.
    - 🔄 **Refund Requests**: Users can submit refund requests for admin review.
    - ✅ **Auto Refund**: Auto-trigger refunds after approval with error handling.
    - 💳 **Payment QR**: Admins can generate payment links/QR codes for direct payments.
- **Admin Console**:
    - 📊 **Sales Stats**: Today/week/month/total overview.
    - ⚠️ **Low Stock Alerts**: Configurable threshold and warnings.
    - 🧩 **Product Management**: Create/edit, enable/disable, reorder, purchase limits; **visibility** (everyone or trust level 0–3); **Variant Group ID** and **Variant Label** for multi-variant products; **pre-purchase questions** (multiple Q&A); product and order lists show variant info.
    - 🏷️ **Category Management**: CRUD categories with icons and ordering.
    - 🗂️ **Card Inventory**: Bulk import and bulk delete unused card keys; each variant is a separate product—manage card keys per product.
    - 💳 **Order Management**: Pagination/search/filters, order detail, mark paid/delivered/cancel.
    - 🧹 **Order Cleanup**: Bulk select and bulk delete.
    - ⭐ **Review Management**: Search and delete reviews.
    - 📦 **Data Management**: Full SQL export (D1 compatible), import from Vercel SQL.
    - 📣 **Announcements**: Homepage announcement management.
    - 👥 **Customer Management**: View customers, manage points, block/unblock.
    - 📨 **Message Center**: Send inbox messages to all users or specific users, with history; users can contact admin via inbox.
    - ⚙️ **Refund Settings**: Toggle whether refunded card keys return to stock.
    - 🧭 **Navigator Settings**: Opt-in to LDC Navigator; navigator page shows store count.
    - 🎨 **Store & Theme**: Shop name, **shop description** (SEO), **shop logo / favicon**; **theme color** and **theme font**; custom footer; **noindex** toggle (e.g. for staging).
    - 📐 **Check-in Settings**: Enable/disable check-in, configurable **check-in reward** points.
    - 🔔 **Update Check**: Admin panel auto-detects new versions.
- **Points System**:
    - ✨ **Daily Check-in**: Users earn points by daily check-in (admin can disable or set reward amount).
    - 💰 **Points Discount**: Use points to offset purchase amounts.
    - 🎁 **Points Payment**: If points cover full amount, no payment gateway needed.
- **I18n & Theme**:
    - 🌐 **English/Chinese switcher**.
    - 🌓 **Light/Dark/System themes**.
    - ⏱️ **Auto Update**: GitHub Actions workflow for upstream sync.
- **Notifications**:
    - 📧 **Delivery Email**: Send order delivery notifications via Resend (configurable sender, language); users can set default email in profile.
    - 📢 **Telegram Notifications**: New order push notifications via Telegram Bot.
    - 📱 **Bark Notifications**: Bark (iOS) push for new orders, refunds, user messages, etc.; can be used alongside Telegram.
    - 📮 **Inbox Notifications**: User inbox for delivery/refund/admin messages with unread badge; optional **desktop notifications** (browser).
    - 💬 **Contact Admin**: Users can send messages to admin from profile.
    - 🌐 **LDC Navigator**: Opt-in store listing and public navigation page with store count.

## 📐 Product Variants (Multi-Variant) Guide

To offer the same product in multiple variants (e.g. monthly / yearly) with different prices and stock:

1. **Admin**: Create **one product per variant** in Product Management (different product IDs), each with its own price, stock, and card keys.
2. **Link them**: When editing each product, set the same **Variant Group ID** (e.g. `chatgpt`) and a **Variant Label** for that row (e.g. `Monthly`, `Yearly`).
3. **Storefront**: The homepage will show one combined card with price range, variant count, and **aggregated stock/sold/reviews across all variants**; the detail page shows a variant selector with per-variant sold count; order records (admin and user) display the variant label.
4. **Card keys**: Each variant is a separate product; manage card keys per product in Card Inventory.

## 🚀 Deployment Guide

### Web Deploy (Workers Builds)

No command line needed—everything in the Cloudflare Dashboard.

#### 1. Create a D1 Database

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Storage & Databases** → **D1**
3. Click **Create database**, name it: **`ldc-shop-next`**

> 💡 **Recommended**: Use the default name `ldc-shop-next`—the project's `wrangler.json` is pre-configured to auto-bind this database name, so you can skip manual binding.

#### 2. Connect Git Repository

1. Cloudflare Dashboard → **Workers & Pages** → **Create application**
2. Choose **Connect to Git**, link your GitHub/GitLab repo
3. Configure build settings:
   - **Path**: `_workers_next`
   - **Build command**: `npm install && npx opennextjs-cloudflare build`
   - **Deploy command**: `npx wrangler deploy`

4. Click **Deploy**

#### Auto-deploy not triggered? Quick troubleshooting

If code is pushed but Cloudflare doesn't start a new build:

1. Confirm the project type is **Workers Builds** (not Pages).
2. Confirm the monitored Git branch matches your push branch (e.g. both `main`).
3. Confirm changes are inside **Path = `_workers_next`** (changes outside may not trigger this project).
4. Confirm build/deploy commands are:
   - Build: `npm install && npx opennextjs-cloudflare build`
   - Deploy: `npx wrangler deploy`
5. If everything looks correct, try disconnecting and reconnecting Git authorization in the Dashboard.

#### 3. Bind D1 Database

**If you used the default database name `ldc-shop-next`**, auto-binding applies—skip this step.

**If you used a different name**, bind manually:

1. Go to project **Settings** → **Bindings**
2. Click **Add binding**
3. Select **D1 Database**
4. **Variable name**: `DB` (must be exactly this)
5. Select your database
6. Save

#### 4. Configure Environment Variables

Go to project **Settings** → **Variables and Secrets**:

| Variable | Type | Description |
|----------|------|-------------|
| `OAUTH_CLIENT_ID` | Secret | Linux DO Connect Client ID |
| `OAUTH_CLIENT_SECRET` | Secret | Linux DO Connect Client Secret |
| `GITHUB_ID` | Secret | GitHub OAuth App Client ID (optional, enables GitHub login) |
| `GITHUB_SECRET` | Secret | GitHub OAuth App Client Secret (optional, enables GitHub login) |
| `MERCHANT_ID` | Secret | EPay Merchant ID |
| `MERCHANT_KEY` | Secret | EPay Merchant Key |
| `AUTH_SECRET` | Secret | Random string (`openssl rand -base64 32`) |
| `ADMIN_USERS` | Secret | Admin username list (Linux DO usernames and GitHub `gh_username`), comma-separated. E.g. `zhangsan,gh_octocat` |
| `NEXT_PUBLIC_APP_URL` | **Text** | Your Workers URL (e.g. `https://ldc-shop.xxx.workers.dev`) |

> ⚠️ **Important**: `NEXT_PUBLIC_APP_URL` **must** be set as Text, not Secret—otherwise payment signatures will fail!
> ⚠️ **Important**: For GitHub users to be admin, `ADMIN_USERS` **must** contain `gh_GitHubUsername` (e.g. `gh_octocat`), not just the raw GitHub username.

**Callback URLs:**

Assuming your Workers URL is `https://ldc-shop.xxx.workers.dev`:

| Platform | Config | URL |
|----------|--------|-----|
| Linux DO Connect | Callback URL | `https://ldc-shop.xxx.workers.dev/api/auth/callback/linuxdo` |
| GitHub OAuth App | Authorization callback URL | `https://ldc-shop.xxx.workers.dev/api/auth/callback/github` |
| EPay / Linux DO Credit | Notify URL | `https://ldc-shop.xxx.workers.dev/api/notify` |
| EPay / Linux DO Credit | Return URL | `https://ldc-shop.xxx.workers.dev/callback` |

> The GitHub **Authorization callback URL** must be: `<your-full-site-url>/api/auth/callback/github`
> Example: `https://shop.chatgpt.org.uk/api/auth/callback/github`
> Must exactly match `NEXT_PUBLIC_APP_URL` protocol and domain, no trailing slash.

**GitHub OAuth App setup:**

1. Open [GitHub Developer Settings](https://github.com/settings/developers).
2. Go to **OAuth Apps** → **New OAuth App**.
3. Fill in:
   - **Application name**: any name (e.g. `LDC Shop`)
   - **Homepage URL**: your full site URL (matches `NEXT_PUBLIC_APP_URL`)
   - **Authorization callback URL**: `<your-full-site-url>/api/auth/callback/github`
4. Click **Register application**.
5. Copy **Client ID**, click **Generate a new client secret** for **Client Secret**.
6. Set Worker environment variables:
   - `GITHUB_ID` = Client ID
   - `GITHUB_SECRET` = Client Secret (recommended as Secret)

#### 5. First Visit

Visit your Workers URL; the homepage will automatically create all database tables.

---

#### 6. Access the Admin Console

1. **Set admin**: Configure admin usernames in the `ADMIN_USERS` environment variable (case-insensitive, comma-separated). Supports Linux DO usernames and GitHub `gh_GitHubUsername`.
2. **Log in**: Sign in to the store with the admin account.
3. **Entry points**:
    - **Top nav**: After login, a "Admin" link appears in the nav bar (desktop).
    - **Dropdown menu**: Click avatar → "Admin" option.
    - **Direct URL**: Visit `/admin` (e.g. `https://your-domain.workers.dev/admin`).

---

## 💻 Local Development

Local development uses a SQLite file to simulate D1.

1. **Configure local environment**
   Copy `.env.example` (if available) or create `.env.local`:
   ```bash
   LOCAL_DB_PATH=local.sqlite
   ```

2. **Generate local database**
   ```bash
   npx drizzle-kit push
   ```
   This creates a `local.sqlite` file.

3. **Start dev server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`.

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `OAUTH_CLIENT_ID` | Linux DO Connect Client ID (Secret recommended) |
| `OAUTH_CLIENT_SECRET` | Linux DO Connect Client Secret (Secret) |
| `GITHUB_ID` | GitHub OAuth App Client ID (optional, enables GitHub login) |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret (optional, enables GitHub login) |
| `MERCHANT_ID` | EPay Merchant ID (Secret recommended) |
| `MERCHANT_KEY` | EPay Merchant Key (Secret) |
| `AUTH_SECRET` | NextAuth encryption key (Secret) |
| `ADMIN_USERS` | Admin username list, supports Linux DO usernames and GitHub `gh_GitHubUsername`, comma-separated. E.g. `zhangsan,gh_octocat` |
| `NEXT_PUBLIC_APP_URL` | Full deployed URL (for callbacks, must be Text) |

> ⚠️ When using GitHub login, system usernames are auto-prefixed with `gh_`; for admin access, `ADMIN_USERS` **must** contain the prefixed username (e.g. `gh_octocat`), not just `octocat`.

## 🔌 Card Auto-Replenish API Integration

You can configure Card API auto-replenish per product in the admin `Card Inventory` page.

### Trigger Timing

- On enable: the system immediately tries to pull 1 card key.
- Manual pull: when clicking `Pull 1 Card`, it pulls 1 card key.
- Auto-replenish: after each successful delivery, it auto-pulls 1 card key (no cron required).

### Request Rules

- Method: `GET`
- URL: uses the exact API URL you configured in admin, as-is
- No automatic `productId` append/replace
- Optional header:
  - `Authorization: Bearer <token>` (sent only when token is configured)
- Fixed header:
  - `Accept: application/json, text/plain;q=0.9, */*;q=0.8`

### Response Requirements

Each request should return one deliverable card key. Supported response formats:

1. Plain text (`text/plain`)

```text
ABC-DEF-123
```

2. JSON direct fields (any one of them)

```json
{ "cardKey": "ABC-DEF-123" }
```

```json
{ "card": "ABC-DEF-123" }
```

```json
{ "key": "ABC-DEF-123" }
```

```json
{ "code": "ABC-DEF-123" }
```

3. JSON nested fields (recursive extraction from `data` / `result` / `item`)

```json
{ "data": { "cardKey": "ABC-DEF-123" } }
```

```json
{ "result": { "item": { "code": "ABC-DEF-123" } } }
```

4. JSON array (the first valid card key will be used)

```json
[{ "cardKey": "ABC-DEF-123" }, { "cardKey": "XYZ-999-888" }]
```

### Recommended Status Codes

- Success: return `200`
- Failure (out of stock/auth invalid/invalid params): return `4xx/5xx`

Your API should avoid returning duplicate card keys. Duplicate keys will be rejected by the store's uniqueness constraints.

## 📄 License
MIT
