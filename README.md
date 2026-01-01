# LDC Shop (Next.js Edition)

> ⚠️ **警告 / WARNING** ⚠️
> 
> **本项目 (Next.js 版本) 目前正在测试中，代码尚未稳定，请勿部署！**
> 
> **This project (Next.js Edition) is currently under testing. The code is NOT stable. DO NOT deploy!**
>
> ---
> 
> 🚀 **想要立即使用？请部署稳定版 (Cloudflare Workers 版)：**
> 
> **[点击查看稳定版部署指南 → `_legacy/README.md`](./_legacy/README.md)**

---

A robust, serverless virtual goods shop built with **Next.js 16**, **Vercel Postgres**, **Shadcn UI**, and **Linux DO Connect**.

## ✨ Features
- **Modern Stack**: Next.js 16 (App Router), Tailwind CSS, TypeScript.
- **Vercel Native**: One-click deploy with Vercel Postgres database.
- **Linux DO Integration**: Built-in OIDC Login and EasyPay support.
- **Admin Dashboard**: Products, Stock, Orders, and Refunds management.

## 🚀 One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fchatgptuk%2Fldc-shop&env=OAUTH_CLIENT_ID,OAUTH_CLIENT_SECRET,MERCHANT_ID,MERCHANT_KEY,ADMIN_USERS,NEXT_PUBLIC_APP_URL&envDescription=Required%20Environment%20Variables&project-name=ldc-shop&repository-name=ldc-shop&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

Click the button above to deploy your own instance to Vercel.

### Configuration Guide

During the deployment process, you will be asked for the following environment variables:

1.  **Linux DO Credentials**:
    *   `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET`: Get from [connect.linux.do](https://connect.linux.do).
    *   **Callback URL** in Linux DO Connect should be: `https://YOUR_DOMAIN/api/auth/callback/linuxdo`.
    *   `MERCHANT_ID` / `MERCHANT_KEY`: Get from [credit.linux.do](https://credit.linux.do).
2.  **ADMIN_USERS**: Your Linux DO username (e.g., `chatgpt,admin`).
3.  **NEXT_PUBLIC_APP_URL**: Your deployment URL (e.g., `https://your-domain.com`). Required for payment callbacks.

The database (Vercel Postgres) will be automatically provisioned and linked.

## 🇨🇳 中文说明

### ⚠️ 关于退款拦截问题 (Refund WAF Issue)

Linux DO Credit 的退款 API 受到 Cloudflare WAF 的严格保护，直接从服务器端发起请求可能会被拦截（报错 403 Forbidden）。

**目前的临时解决方案：**
本项目采用了**客户端 API 调用方案**（通过 Form 表单提交）。当管理员点击退款按钮时，会打开新标签页并由浏览器直接调用 Linux DO Credit 的退款 API。管理员需确认 API 返回成功后，返回本系统点击"标记已退款"来更新订单状态。

### ⚙️ 配置指南 (Configuration Guide)

部署时需要配置以下环境变量。

> **⚠️ 注意 / NOTE**: 
> 以下配置以域名 `store.chatgpt.org.uk` 为例，**部署时请务必替换为你自己的实际域名！**
> Please replace `store.chatgpt.org.uk` with your actual domain!

#### 1. Linux DO Connect (OIDC) 配置
前往 [connect.linux.do](https://connect.linux.do) 创建/配置应用：

*   **应用名称 (App Name)**: `LDC Store Next` (或任意名称 / Any name)
*   **应用主页 (App Homepage)**: `https://store.chatgpt.org.uk`
*   **应用描述 (App Description)**: `LDC Store Next`
*   **回调地址 (Callback URL)**: `https://store.chatgpt.org.uk/api/auth/callback/linuxdo`

获取 **Client ID** 和 **Client Secret**，分别填入 Vercel 环境变量的 `OAUTH_CLIENT_ID` 和 `OAUTH_CLIENT_SECRET`。

#### 2. EPay (Linux DO Credit) 配置
前往 [credit.linux.do](https://credit.linux.do) 创建/配置应用：

*   **应用名称**: `LDC Store Next` (或任意名称 / Any name)
*   **应用地址**: `https://store.chatgpt.org.uk`
*   **回调 URI**: `https://store.chatgpt.org.uk/callback`
*   **通知 URL**: `https://store.chatgpt.org.uk/api/notify`

获取 **Client ID** 和 **Client Secret**，分别填入 Vercel 环境变量的 `MERCHANT_ID` 和 `MERCHANT_KEY`。

#### 3. 其他变量
*   **ADMIN_USERS**: 管理员用户名，逗号分隔，例如 `chatgpt`
*   **NEXT_PUBLIC_APP_URL**: 你的应用完整域名，例如 `https://store.chatgpt.org.uk`

## 🛠️ Local Development

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Link Vercel Project (for Env Vars & DB):
    ```bash
    vercel link
    vercel env pull .env.development.local
    ```
4.  Run migrations:
    ```bash
    npx drizzle-kit push
    ```
5.  Start dev server:
    ```bash
    npm run dev
    ```

## 📄 License
MIT
