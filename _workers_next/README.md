# LDC Shop (Cloudflare Workers Edition)


基于 **Next.js 16**、**Cloudflare Workers** (OpenNext)、**D1 Database** 和 **Shadcn UI** 构建的无服务器虚拟商品商店。

## 🛠 技术架构 (Technical Architecture)

本版本采用 **Next.js on Workers** 的前沿技术路线，而非传统的单文件 Worker：

*   **核心框架**: **Next.js 16 (App Router)** - 保持与 Vercel 版本一致的现代化开发体验。
*   **适配器**: **OpenNext (Cloudflare Adapter)** - 目前最先进的 Next.js 到 Workers 的转换方案，支持大部分 Next.js 特性。
*   **数据库**: **Cloudflare D1 (SQLite)** - 边缘原生关系型数据库，替代 Vercel Postgres。
*   **ORM**: **Drizzle ORM** - 完美适配 D1，提供类型安全的 SQL 操作。
*   **部署**: **Wrangler** - 一键部署到全球边缘网络。

此架构旨在结合 Next.js 的开发效率与 Cloudflare 的边缘性能/低成本优势。

## ✨ 特性

- **现代技术栈**: Next.js 16 (App Router), Tailwind CSS, TypeScript。
- **边缘原生**: Cloudflare Workers + D1 数据库，低成本高性能。
- **Linux DO 集成**: 内置 OIDC 登录与 EasyPay 支付。
- **商城体验**:
    - 🔍 **搜索与分类筛选**: 客户端即时搜索与分类过滤；独立搜索页 `/search` 支持服务端搜索、分页、分类与排序。
    - 💡 **心愿单与投票**: 用户可提交想要的商品并投票（后台可开启/关闭）。
    - 📢 **公告栏**: 首页公告配置与展示。
    - 📝 **Markdown 描述**: 商品支持富文本展示。
    - ⚠️ **购买前提醒**: 支持购买前弹窗提示。
    - ❓ **购买前验证问题**: 管理员可为商品设置多道问答题，用户必须全部答对才能下单（前后端双重校验）。
    - 🔒 **商品可见级别**: 可按用户信任等级（0–3）限制商品可见，未达标用户见「需登录或升级」提示。
    - 🔥 **热门与折扣**: 支持热门标记与原价/折扣价展示。
    - ⭐ **评分与评论**: 已购用户可评分/评论，列表展示评分。
    - 📦 **库存/已售显示**: 实时展示可用库存与已售数量。
    - ♾️ **共享卡密商品**: 支持无限库存商品（共享账号/教程等）。
    - 🚫 **限购**: 按已支付次数限制购买。
    - 🔢 **数量选择**: 支持购买多个商品（受限于库存与限购数量）。
    - 🏷️ **自定义商店名称**: 支持自定义显示在标题和导航栏的商店名称。
    - 📐 **商品规格（多规格）**: 同一商品可设置多个规格（如月付/季付/年付），不同规格独立价格与库存；首页显示价格区间与规格数，**库存/已售/评价数按全组合计**；详情页规格选择器并显示各规格已售；后台与用户订单记录中显示规格标签；卡密按规格（商品）分别管理。
- **订单与发货**:
    - ✅ **支付回调验签**: 签名与金额校验。
    - 🎁 **自动发货卡密**: 支付成功后自动发放卡密，缺货则标记已支付待处理。
    - 📦 **多卡密分发**: 购买多件商品时，订单详情页自动分行展示多个卡密。
    - 📧 **默认收件邮箱**: 个人中心可设置默认邮箱，发货邮件优先发送到该邮箱。
    - 🔒 **库存锁定**: 进入支付页后锁定 5 分钟，防止并发超卖。
    - ⏱️ **超时取消**: 5 分钟未支付自动取消订单并释放库存。
    - 🧾 **订单中心**: 订单列表与详情页；订单记录中显示商品规格标签（若有）。
    - 🔔 **待支付提醒**: 首页横幅提醒未支付订单，防止漏单。
    - 🔄 **退款申请**: 用户可提交退款申请，管理员审核与处理。
    - ✅ **自动退款**: 管理员同意退款后自动触发退款（支持失败提示）。
    - 💳 **收款码**: 管理员可生成收款链接/二维码，无需商品即可直接收款。
- **管理后台**:
    - 📊 **销售统计**: 今日/本周/本月/总计。
    - ⚠️ **库存预警**: 低库存阈值配置与预警提示。
    - 🧩 **商品管理**: 新建/编辑/上下架/排序/限购；**可见范围**（所有人可见或仅某信任等级及以上）；**规格组 ID** 与 **规格标签**（多规格商品）；**购买前验证问题**（多道问答）；商品列表与订单列表展示规格信息。
    - 🏷️ **分类管理**: 分类增删改、图标设置、排序。
    - 🗂️ **卡密管理**: 批量导入、批量删除未使用卡密；多规格商品的每个规格需在对应商品下分别管理卡密。
    - 💳 **订单管理**: 分页/搜索/筛选、订单详情、标记已支付/已发货/取消；订单列表显示商品规格。
    - 🧹 **订单清理**: 支持批量选择与批量删除。
    - ⭐ **评价管理**: 搜索与删除评价。
    - 📦 **数据管理**: 全量导出 SQL（兼容 D1），支持从 Vercel 版 SQL 导入。
    - 📣 **公告管理**: 首页公告配置。
    - 👥 **顾客管理**: 查看顾客列表、积分管理、拉黑/解封。
    - 📨 **消息管理**: 管理员可向全部/指定用户发送站内消息，支持查看用户来信与发送历史。
    - ⚙️ **退款设置**: 可配置退款后卡密是否回收进库存。
    - 🧭 **导航设置**: 可选择加入 LDC 导航，并控制前台导航入口显示；导航页展示商店数目。
    - 🎨 **店铺与主题**: 商店名称、**商店描述**（SEO）、**商店 Logo / Favicon** 自定义；**主题色**与**主题字体**；自定义页脚文案；**noindex** 开关（适合测试环境）。
    - 📐 **签到设置**: 签到功能开关、**签到奖励积分**可配置。
    - 🔔 **更新检查**: 管理后台自动检测新版本并提示。
- **积分系统**:
    - ✨ **每日签到**: 用户每日签到领取积分（后台可关闭或调整奖励数）。
    - 💰 **积分抵扣**: 购买商品时可使用积分抵扣金额。
    - 🎁 **积分支付**: 若积分足够支付全款，无需跳转支付平台直接成交。
- **多语言与主题**:
    - 🌐 **中英切换**。
    - 🌓 **浅色/深色/跟随系统**。
    - ⏱️ **自动更新**: 支持 GitHub Actions 自动同步上游代码。
- **通知系统**:
    - 📧 **发货邮件**: 支持 Resend 发送订单发货通知邮件（可配置发件人、语言）；个人中心可设置默认收件邮箱。
    - 📢 **Telegram 通知**: 支持新订单 Telegram Bot 消息推送。
    - 📱 **Bark 通知**: 支持 Bark（iOS）推送新订单、退款、用户来信等管理员通知，可与 Telegram 同时使用。
    - 📮 **站内收件箱**: 用户可在个人中心查看发货/退款/管理员消息通知，并显示未读提示；可开启**桌面通知**（浏览器推送）。
    - 💬 **联系管理员**: 用户可向管理员发起站内消息。
    - 🌐 **LDC 导航**: 站点可自愿加入导航页，展示商城信息；导航页显示商店数目。

## 📐 商品规格（多规格）说明

若同一商品有多个规格（如月付/季付/年付），且不同规格价格与库存不同，可启用**多规格**功能：

1. **后台**：在「商品管理」中为每个规格**新建一条商品**（不同商品 ID），价格、库存、卡密各自独立。
2. **关联**：在编辑每条商品时，填写相同的 **规格组 ID**（如 `chatgpt`），以及该条对应的 **规格标签**（如 `月付`、`年付`）。
3. **前台**：首页会将该组合并为一条展示（价格区间、规格数）；点击进入详情页后出现规格选择器，切换规格即切换价格/库存/描述；下单后订单记录中会显示规格标签。
4. **卡密**：每个规格对应一个商品，卡密在「卡密管理」中按商品分别导入或配置 API。

## 🚀 部署指南

### 网页部署 (Workers Builds)

无需命令行，完全在 Cloudflare Dashboard 操作。

#### 1. 创建 D1 数据库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单 **Storage & Databases** → **D1**
3. 点击 **Create database**，输入名称：**`ldc-shop-next`**

> 💡 **推荐使用默认名称 `ldc-shop-next`**：项目的 `wrangler.json` 已配置自动绑定此名称的数据库，使用默认名称可以跳过手动绑定步骤。

#### 2. 连接 Git 仓库部署

1. Cloudflare Dashboard → **Workers & Pages** → **Create application**
2. 选择 **Connect to Git**，连接你的 GitHub/GitLab 仓库
3. 配置构建设置：
   - **Path**: `_workers_next`
   - **Build command**: `npm install && npx opennextjs-cloudflare build`
   - **Deploy command**: `npx wrangler deploy`

4. 点击 **Deploy**

#### 自动部署未触发？快速排查

如果你已经推送了代码但 Cloudflare 没有自动开始新构建，可按下面检查：

1. 确认项目类型是 **Workers Builds**（不是 Pages）。
2. 确认 Git 仓库监听分支与实际推送分支一致（例如都为 `main`）。
3. 确认改动发生在 **Path = `_workers_next`** 目录内（路径外改动可能不会触发此项目构建）。
4. 确认构建命令/部署命令仍为：
   - Build: `npm install && npx opennextjs-cloudflare build`
   - Deploy: `npx wrangler deploy`
5. 若以上都正确仍未触发，可在 Cloudflare Dashboard 里断开并重新连接一次 Git 仓库授权。

#### 3. 绑定 D1 数据库

**如果你使用了默认数据库名 `ldc-shop-next`**，数据库会自动绑定，可以跳过此步骤。

**如果你使用了其他数据库名**，需要手动绑定：

1. 部署后，进入项目 **Settings** → **Bindings**
2. 点击 **Add binding**
3. 选择 **D1 Database**
4. **Variable name**: `DB`（必须是这个名字）
5. 选择你创建的数据库
6. 保存

#### 4. 配置环境变量

进入项目 **Settings** → **Variables and Secrets**：

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `OAUTH_CLIENT_ID` | Secret | Linux DO Connect Client ID |
| `OAUTH_CLIENT_SECRET` | Secret | Linux DO Connect Client Secret |
| `GITHUB_ID` | Secret | GitHub OAuth App Client ID（可选，配置后启用 GitHub 登录） |
| `GITHUB_SECRET` | Secret | GitHub OAuth App Client Secret（可选，配置后启用 GitHub 登录） |
| `MERCHANT_ID` | Secret | EPay 商户 ID |
| `MERCHANT_KEY` | Secret | EPay 商户 Key |
| `AUTH_SECRET` | Secret | 随机字符串 (可用 `openssl rand -base64 32` 生成) |
| `ADMIN_USERS` | Secret | 管理员用户名列表（支持 Linux DO 用户名和 GitHub 用户名 `gh_GitHub用户名`），逗号分隔。例如: `zhangsan,gh_octocat` |
| `NEXT_PUBLIC_APP_URL` | **Text** | 你的 Workers 域名 (如 `https://ldc-shop.xxx.workers.dev`) |

> ⚠️ **重要**: `NEXT_PUBLIC_APP_URL` **必须**设置为 Text 类型，不能用 Secret，否则支付签名会失败！
> ⚠️ **重要**: 若 GitHub 用户需要管理员权限，`ADMIN_USERS` 中**必须**填写 `gh_GitHub用户名`（例如 `gh_octocat`），不能只写原始 GitHub 用户名。

**回调地址配置：**

假设你的 Workers 域名是 `https://ldc-shop.xxx.workers.dev`：

| 平台 | 配置项 | 地址 |
|------|--------|------|
| Linux DO Connect | 回调地址 (Callback URL) | `https://ldc-shop.xxx.workers.dev/api/auth/callback/linuxdo` |
| GitHub OAuth App | 回调地址 (Authorization callback URL) | `https://ldc-shop.xxx.workers.dev/api/auth/callback/github` |
| EPay / Linux DO Credit | 通知 URL (Notify URL) | `https://ldc-shop.xxx.workers.dev/api/notify` |
| EPay / Linux DO Credit | 回调 URL (Return URL) | `https://ldc-shop.xxx.workers.dev/callback` |

> GitHub 的 **Authorization callback URL** 固定填写为：`<你的站点完整 URL>/api/auth/callback/github`  
> 例如站点是 `https://shop.chatgpt.org.uk`，则填写 `https://shop.chatgpt.org.uk/api/auth/callback/github`。  
> 注意必须与 `NEXT_PUBLIC_APP_URL` 的协议和域名完全一致，且不要额外加尾部斜杠。

**GitHub OAuth App 创建步骤：**

1. 打开 [GitHub Developer Settings](https://github.com/settings/developers)。
2. 进入 **OAuth Apps**，点击 **New OAuth App**。
3. 按以下方式填写：
   - **Application name**: 自定义（例如 `LDC Shop`）
   - **Homepage URL**: 你的站点完整 URL（与 `NEXT_PUBLIC_APP_URL` 一致）
   - **Authorization callback URL**: `<你的站点完整 URL>/api/auth/callback/github`
4. 点击 **Register application**。
5. 在应用详情页复制 **Client ID**，并点击 **Generate a new client secret** 获取 **Client Secret**。
6. 将二者分别填入 Workers 环境变量：
   - `GITHUB_ID` = Client ID
   - `GITHUB_SECRET` = Client Secret（建议使用 Secret）

#### 5. 首次访问

访问你的 Workers 域名，首页会自动创建所有数据库表。

---

#### 6. 进入管理后台

1. **设置管理员**: 在环境变量 `ADMIN_USERS` 中配置管理员用户名（不区分大小写，多个用户用逗号分隔）。支持 Linux DO 用户名，以及 GitHub 登录用户名 `gh_GitHub用户名`。
2. **登录商城**: 使用该管理账号登录商城。
3. **访问入口**:
    - **顶部导航**: 登录后，顶部导航栏会出现 "管理后台" 链接（桌面端）。
    - **下拉菜单**: 点击右上角头像调出下拉菜单，可以看到 "管理后台" 选项。
    - **直接访问**: 也可以直接访问 `/admin` 路径（例如 `https://your-domain.workers.dev/admin`）。

---

## 💻 本地开发

本地开发使用 SQLite 文件模拟 D1。

1. **配置本地环境**
   复制 `.env.example` (如果有) 或直接创建 `.env.local`：
   ```bash
   LOCAL_DB_PATH=local.sqlite
   ```

2. **生成本地数据库**
   ```bash
   npx drizzle-kit push
   ```
   这会创建一个 `local.sqlite` 文件。

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   访问 `http://localhost:3000`。

## ⚙️ 环境变量说明

| 变量名 | 说明 |
|---|---|
| `OAUTH_CLIENT_ID` | Linux DO Connect Client ID（建议 Secret） |
| `OAUTH_CLIENT_SECRET` | Linux DO Connect Client Secret（Secret） |
| `GITHUB_ID` | GitHub OAuth App Client ID（可选，配置后启用 GitHub 登录） |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret（可选，配置后启用 GitHub 登录） |
| `MERCHANT_ID` | EPay 商户 ID（建议 Secret） |
| `MERCHANT_KEY` | EPay 商户 Key（Secret） |
| `AUTH_SECRET` | NextAuth 加密密钥（Secret） |
| `ADMIN_USERS` | 管理员用户名列表，支持 Linux DO 用户名和 GitHub `gh_GitHub用户名` 用户名，逗号分隔。例如: `zhangsan,gh_octocat` |
| `NEXT_PUBLIC_APP_URL` | 部署后的完整 URL (用于回调，必须 Text) |

> ⚠️ 使用 GitHub 登录时，系统用户名会自动加前缀 `gh_`；如需管理员权限，`ADMIN_USERS` 中**必须**填写这个带前缀的用户名（例如 `gh_octocat`），不能只写 `octocat`。

## 🔌 卡密自动补货 API 对接

在管理后台的 `卡密管理` 页面可为单个商品配置“卡密 API 自动补货”。

### 触发时机

- 启用时：会立即尝试拉取 1 条卡密。
- 手动拉取：点击“手动拉取 1 条”时拉取 1 条。
- 自动补货：订单成功发货后自动补 1 条（无需 Cron）。

### 请求规则

- 请求方法：`GET`
- 请求 URL：使用你在后台填写的 API URL，**原样请求**
- 不会自动追加/替换 `productId` 参数
- 可选请求头：
  - `Authorization: Bearer <token>`（仅在你配置了 Token 时发送）
- 固定请求头：
  - `Accept: application/json, text/plain;q=0.9, */*;q=0.8`

### 响应要求

接口每次请求返回 1 条可发货的卡密即可，支持以下格式：

1. 纯文本（`text/plain`）

```text
ABC-DEF-123
```

2. JSON 直接字段（任一字段名）

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

3. JSON 嵌套字段（支持 `data` / `result` / `item` 递归提取）

```json
{ "data": { "cardKey": "ABC-DEF-123" } }
```

```json
{ "result": { "item": { "code": "ABC-DEF-123" } } }
```

4. JSON 数组（会从前到后提取第一条可用卡密）

```json
[{ "cardKey": "ABC-DEF-123" }, { "cardKey": "XYZ-999-888" }]
```

### 返回码建议

- 成功：返回 `200`
- 失败（如无库存、鉴权失败、参数错误）：返回 `4xx/5xx`

建议你的 API 避免重复返回同一条卡密；若返回重复卡密，系统会因去重约束而拒绝入库。

## 📄 许可证
MIT
