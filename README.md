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

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fchatgptuk%2Fldc-shop&env=OAUTH_CLIENT_ID,OAUTH_CLIENT_SECRET,MERCHANT_ID,MERCHANT_KEY,ADMIN_USERS&envDescription=Required%20Environment%20Variables&project-name=ldc-shop&repository-name=ldc-shop&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

Click the button above to deploy your own instance to Vercel.

### Configuration Guide

During the deployment process, you will be asked for the following environment variables:

1.  **Linux DO Credentials**:
    *   `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET`: Get from [connect.linux.do](https://connect.linux.do).
    *   **Callback URL** in Linux DO Connect should be: `https://YOUR_DOMAIN.vercel.app/api/auth/callback/linuxdo` (or your custom domain).
    *   `MERCHANT_ID` / `MERCHANT_KEY`: Get from [credit.linux.do](https://credit.linux.do).
3.  **ADMIN_USERS**: Your Linux DO username (e.g., `chatgpt,admin`).

The database (Vercel Postgres) will be automatically provisioned and linked.

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
