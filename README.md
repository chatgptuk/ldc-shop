# LDC Shop (Next.js + Workers)

[English](./README_EN.md)

---

基于 **Next.js 16**、**Shadcn UI** 和 **Linux DO Connect** 构建的强大的无服务器虚拟商品商店。

> [!IMPORTANT]
> **⚠️ Vercel 版本已停止更新，请使用 Cloudflare Workers 版本！**
> 
> Workers 版本是当前唯一持续维护的版本，包含所有最新功能。

> 🚀 **推荐部署方式：Cloudflare Workers 版本**
> 
> | 对比项 | Cloudflare Workers | Vercel |
> |--------|-------------------|--------|
> | 维护状态 | **✅ 持续更新** | ⚠️ 停止更新 |
> | 免费请求 | **10 万次/天** | 有限制 |
> | 数据库 | **D1 免费 5GB** | Postgres 有限额 |
> | 冷启动 | **几乎无延迟** | 有冷启动 |
> | 全球边缘 | ✅ 全球节点 | 部分地区 |
> 
> 👉 **[查看 Workers 部署指南 → `_workers_next/README.md`](./_workers_next/README.md)**

## ✨ 特性
- **现代技术栈**: Next.js 16 (App Router), Tailwind CSS, TypeScript.
- **Vercel 原生**: 一键部署，自动配置 Vercel Postgres 数据库。
- **Linux DO 集成**: 内置 OIDC 登录与 EasyPay 支付。
- **商城体验**:
    - 🔍 **搜索与分类筛选**: 客户端即时搜索与分类过滤。
    - 📢 **公告栏**: 首页公告配置与展示。
    - 📝 **Markdown 描述**: 商品支持富文本展示。
    - 🔥 **热门与折扣**: 支持热门标记与原价/折扣价展示。
    - ⭐ **评分与评论**: 已购用户可评分/评论，列表展示评分。
    - 📦 **库存/已售显示**: 实时展示可用库存与已售数量。
    - 🚫 **限购**: 按已支付次数限制购买。
    - 🔢 **数量选择**: 支持购买多个商品（受限于库存与限购数量）。
    - 🏷️ **自定义商店名称**: 支持自定义显示在标题和导航栏的商店名称。
- **订单与发货**:
    - ✅ **支付回调验签**: 签名与金额校验。
    - 🎁 **自动发货卡密**: 支付成功后自动发放卡密，缺货则标记已支付待处理。
    - 📦 **多卡密分发**: 购买多件商品时，订单详情页自动分行展示多个卡密。
    - 🔒 **库存锁定**: 进入支付页后锁定 5 分钟，防止并发超卖。
    - ⏱️ **超时取消**: 5 分钟未支付自动取消订单并释放库存。
    - 🧾 **订单中心**: 订单列表与详情页。
    - 🔔 **待支付提醒**: 首页横幅提醒未支付订单，防止漏单。
    - 🔄 **退款申请**: 用户可提交退款申请，管理员审核与处理（支持客户端直接退款与服务端代理退款）。
    - 💳 **收款码 (Payment QR)**: 管理员可生成收款链接/二维码，无需商品即可直接收款。
- **管理后台**:
    - 📊 **销售统计**: 今日/本周/本月/总计。
    - ⚠️ **库存预警**: 低库存阈值配置与预警提示。
    - 🧩 **商品管理**: 新建/编辑/上下架/排序/限购。
    - 🏷️ **分类管理**: 分类增删改、图标设置、排序。
    - 🗂️ **库存卡密管理**: 批量导入、删除未使用卡密。
    - 🧯 **库存自愈**: 兼容历史数据 `is_used` 为空导致的“错误缺货”，会自动回填为 `false`。
    - 📦 **总库存显示**: 首页展示库存包含“可用+锁定”，避免用户因锁定库存误以为售罄。
    - 💳 **订单与退款**: 分页/搜索/筛选、订单详情、标记已支付/已发货/取消、两步退款流程。
    - 🧹 **订单清理**: 支持批量选择与批量删除。
    - ⭐ **评价管理**: 搜索与删除评价。
    - 📦 **数据导出**: 订单/商品/评价/设置导出，支持全量 JSON 与 D1 SQL。
    - 📣 **公告管理**: 首页公告配置。
    - 💾 **数据导出**: 支持导出订单、商品、评价为 CSV/JSON，以及导出全量数据为 D1 兼容 SQL。
    - ⚙️ **设置**: 跟随心意修改商店名称。
    - 👥 **顾客管理**: 
        - 查看所有顾客列表，包括积分、订单数、注册时间等。
        - 搜索顾客（支持 ID 与用户名）。
        - 🚫 **拉黑/解封**: 可禁止特定用户登录与购买。
        - 管理员可手动修改顾客积分。
    - ✨ **每日签到与积分设置**: 
        - 可开启/关闭每日签到功能。
        - 自定义每日签到奖励积分数额。
- **积分系统**:
    - � **每日签到**: 用户每日签到领取积分。
    - 💰 **积分抵扣**: 购买商品时可使用积分抵扣金额（支持部分或全额抵扣）。
    - 🎁 **积分支付**: 若积分足够支付全款，无需跳转支付平台直接成交。
- **多语言与主题**:
    - 🌐 **中英切换**。
    - 🌓 **浅色/深色/跟随系统**。
    - ⏱️ **自动更新 (Upstream Sync)**: 提供 GitHub Actions 脚本，Fork 用户可启用自动同步上游最新代码并触发 Vercel 部署。

---

## 🚀 部署指南

> Workers 版独有功能与最新说明请直接查看：`_workers_next/README.md`。

### ⭐ 推荐：Cloudflare Workers 一键部署

免费额度更高、全球访问更快、无冷启动延迟。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chatgptuk/ldc-shop)

点击上方按钮，即可一键 Fork 并部署到 Cloudflare Workers。部署完成后，还需要：

1. **创建 D1 数据库**（如果部署流程未自动创建）：Cloudflare Dashboard → Storage & Databases → D1 → Create database，名称填 `ldc-shop-next`
2. **配置环境变量**：进入项目 Settings → Variables and Secrets，添加 `OAUTH_CLIENT_ID`、`OAUTH_CLIENT_SECRET`、`MERCHANT_ID`、`MERCHANT_KEY`、`AUTH_SECRET`、`ADMIN_USERS`、`NEXT_PUBLIC_APP_URL`（Text 类型）
3. **重新部署**：配置完成后，手动触发一次 GitHub Actions 的 **Deploy to Cloudflare Workers** workflow 即可

> 详细配置说明请参考：**[Workers 部署指南 → `_workers_next/README.md`](./_workers_next/README.md)**

### 备选：Vercel 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fchatgptuk%2Fldc-shop&env=OAUTH_CLIENT_ID,OAUTH_CLIENT_SECRET,MERCHANT_ID,MERCHANT_KEY,ADMIN_USERS,NEXT_PUBLIC_APP_URL&envDescription=Required%20Environment%20Variables&project-name=ldc-shop&repository-name=ldc-shop&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

点击上方按钮一键部署到 Vercel，数据库 (Vercel Postgres) 将自动配置。



如果你使用 Vercel 一键部署，默认可能不会包含 GitHub Actions 配置文件。你需要手动创建它来实现每天自动同步上游最新代码（并触发 Vercel 重部署）。

### 1. 配置 Workflow 权限

为了让 GitHub Actions 有权限强制推送到你的仓库，必须先开启写入权限：

1.  进入你的 GitHub 仓库页面。
2.  点击上方的 **Settings** (设置) 标签页。
3.  左侧菜单点击 **Actions** -> **General**。
4.  滚动到页面底部的 **Workflow permissions** 区域。
5.  选中 **Read and write permissions**。
6.  点击 **Save** 保存。

### 2. 创建同步脚本

1.  如果在你的仓库中没有找到 `.github/workflows/sync.yml` 文件。
2.  请直接复制本项目（上游仓库）中 [`.github/workflows/sync.yml`](https://github.com/chatgptuk/ldc-shop/blob/main/.github/workflows/sync.yml) 的全部内容。
    *   **文件地址**: [https://github.com/chatgptuk/ldc-shop/blob/main/.github/workflows/sync.yml](https://github.com/chatgptuk/ldc-shop/blob/main/.github/workflows/sync.yml)
3.  在你的仓库中新建目录 `.github/workflows`，并创建文件 `sync.yml`。
4.  将复制的内容粘贴进去并保存提交。
    *   *注意：请直接使用仓库里的版本，不要使用旧文档或其他地方的代码，以确保脚本逻辑与上游一致，避免同步冲突。*

### 3. 启用并测试

1.  点击仓库上方的 **Actions** 标签页。
2.  左侧应该会出现 **Upstream Sync**。
3.  点击它，然后点击右侧的 **Run workflow** -> **Run workflow** 手动触发一次。
4.  如果显示绿色的 ✅，说明配置成功！以后它会自动每天运行。

## 💡 建议：绑定自定义域名

虽然本系统支持主动查询订单状态，但为了获得最佳的用户体验（即时的支付状态更新），我们仍然 **建议** 绑定一个自定义域名（如 `store.yourdomain.com`）。

`vercel.app` 共享域名有时会被支付平台或防火墙拦截，可能导致支付回调延迟或失败。绑定自定义域名可以有效避免此类问题。



## ⚙️ 配置指南

部署时需要配置以下环境变量。

> **⚠️ 注意**: 
> 以下配置以域名 `store.chatgpt.org.uk` 为例，**部署时请务必替换为你自己的实际域名！**

### 1. Linux DO Connect (OIDC) 配置
前往 [connect.linux.do](https://connect.linux.do) 创建/配置应用：

*   **应用名称 (App Name)**: `LDC Store Next` (或任意名称)
*   **应用主页 (App Homepage)**: `https://store.chatgpt.org.uk`
*   **应用描述 (App Description)**: `LDC Store Next`
*   **回调地址 (Callback URL)**: `https://store.chatgpt.org.uk/api/auth/callback/linuxdo`

获取 **Client ID** 和 **Client Secret**，分别填入 Vercel 环境变量的 `OAUTH_CLIENT_ID` 和 `OAUTH_CLIENT_SECRET`。

### 2. EPay (Linux DO Credit) 配置
前往 [credit.linux.do](https://credit.linux.do) 创建/配置应用：

*   **应用名称**: `LDC Store Next` (或任意名称)
*   **应用地址**: `https://store.chatgpt.org.uk`
*   **回调 URI**: `https://store.chatgpt.org.uk/callback`
*   **通知 URL**: `https://store.chatgpt.org.uk/api/notify`

获取 **Client ID** 和 **Client Secret**，分别填入 Vercel 环境变量的 `MERCHANT_ID` 和 `MERCHANT_KEY`。

### 3. 其他变量
*   **ADMIN_USERS**: 管理员用户名，逗号分隔，例如 `chatgpt,admin`
*   **NEXT_PUBLIC_APP_URL**: 你的应用完整域名，例如 `https://store.chatgpt.org.uk`

## 🛠️ 本地开发

1.  克隆仓库。
2.  安装依赖:
    ```bash
    npm install
    ```
3.  链接 Vercel 项目 (用于拉取环境变量和数据库配置):
    ```bash
    vercel link
    vercel env pull .env.development.local
    ```
4.  运行数据库迁移:
    ```bash
    npx drizzle-kit push
    ```
5.  启动开发服务器:
    ```bash
    npm run dev
    ```

## 📄 许可证
MIT
