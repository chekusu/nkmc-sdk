[English](README.md) | **中文** | [日本語](README.ja.md)

# nkmc SDK

开放式 Agent API 网关 SDK。让 AI Agent 用 6 个类 Unix 命令发现和调用互联网上的任意 API，让开发者通过 DNS 验证注册自己的 API 供 Agent 发现。

| 包 | 说明 | npm |
|---|------|-----|
| [`@nkmc/cli`](packages/cli) | 面向 Agent 和开发者的命令行工具 | [![npm](https://img.shields.io/npm/v/@nkmc/cli)](https://www.npmjs.com/package/@nkmc/cli) |
| [`@nkmc/core`](packages/core) | 服务端 SDK — JWT 验证、中间件、skill 生成 | [![npm](https://img.shields.io/npm/v/@nkmc/core)](https://www.npmjs.com/package/@nkmc/core) |

## 面向 Agent

安装 CLI，开始浏览 API：

```bash
npm install -g @nkmc/cli

# 认证（token 有效期 24 小时）
nkmc auth

# 发现服务
nkmc ls /

# 搜索 API
nkmc grep "weather" /

# 探索某个服务
nkmc ls /api.weather.gov/
nkmc grep "forecast" /api.weather.gov/

# 阅读 API 规格文档
nkmc cat /api.weather.gov/skill.md
```

### 命令

| 命令 | 说明 | HTTP 等效 |
|------|------|-----------|
| `nkmc ls <path>` | 列出服务或目录内容 | `GET /fs/<path>/` |
| `nkmc cat <path>` | 读取文件或调用 GET 接口 | `GET /fs/<path>` |
| `nkmc grep <pattern> <path>` | 搜索服务或接口 | `GET /fs/<path>?q=<pattern>` |
| `nkmc write <path> [data]` | 向 POST 接口发送数据 | `POST /fs/<path>` |
| `nkmc rm <path>` | 删除资源 | `DELETE /fs/<path>` |
| `nkmc pipe <expr>` | 用 Unix 管道串联命令 | `GET` 然后 `POST` |

### 可用服务

网关上有 40+ 个 API 可供使用，包括：

**开发工具** — GitHub、GitLab、Vercel、Sentry、PagerDuty、CircleCI、Postman
**云与部署** — Cloudflare、DigitalOcean、Fly.io、Render
**AI 与机器学习** — OpenAI、OpenRouter、HuggingFace
**通信** — Slack、Discord、Twilio、Resend
**生产力** — Notion、Asana、Jira、Spotify
**数据库** — Supabase、Neon、Turso
**商业** — Stripe
**数据** — Wikipedia、Weather.gov、Datadog
**区块链** — Ethereum RPC（Ankr、Alchemy、Infura、Arbitrum、Optimism、Base、Polygon）

```bash
# 示例：查找并探索 API
nkmc grep "deploy" /
# api.github.com — GitHub v3 REST API
# api.cloudflare.com — Cloudflare API
# fly.io — Machines API

nkmc grep "email" /
# api.resend.com — Resend · 70 endpoints

nkmc grep "blockchain" /
# rpc.ankr.com — JSON-RPC · 13 endpoints
# arb1.arbitrum.io — JSON-RPC · 13 endpoints

nkmc ls /rpc.ankr.com/
# blocks/  balances/  transactions/  receipts/  logs/  ...

nkmc cat /rpc.ankr.com/balances/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045.json
```

## 面向开发者

注册你的 API，让 Agent 发现和使用它。

### 1. 安装

```bash
npm install @nkmc/core
npm install -g @nkmc/cli
```

### 2. 初始化与生成

```bash
# 检测框架，创建 nkmc.config.ts
nkmc init

# 扫描路由，生成 .well-known/skill.md
nkmc generate
```

### 3. 认领域名

```bash
# 请求 DNS 验证
nkmc claim api.example.com

# 添加 TXT 记录后验证
nkmc claim api.example.com --verify
```

### 4. 注册

```bash
nkmc register --domain api.example.com
```

### 5. 保护路由

```typescript
import { Nkmc } from "@nkmc/core";

const nkmc = Nkmc.init({
  siteId: "api.example.com",
  gatewayPublicKey: process.env.NKMC_PUBLIC_KEY,
});

// 验证所有 Agent 请求
app.use(nkmc.guard());

// 或按角色限制
app.use("/admin", nkmc.guard({ roles: ["premium"] }));
```

### 直接验证请求

```typescript
import { verifyRequest } from "@nkmc/core";

const result = await verifyRequest(
  req.headers.authorization,
  { siteId: "api.example.com", gatewayPublicKey: publicKey }
);

if (result.ok) {
  console.log(result.agent.id);    // Agent ID
  console.log(result.agent.roles); // ["agent"]
}
```

### 编程式生成 skill.md

```typescript
import { generateSkillMd } from "@nkmc/core";

const markdown = generateSkillMd({
  frontmatter: {
    name: "My API",
    gateway: "nkmc",
    version: "1.0",
    roles: ["agent"],
  },
  description: "My API — powered by nkmc.",
  schema: [
    {
      name: "Products",
      description: "产品目录",
      read: "agent",
      write: "agent",
      fields: [
        { name: "id", type: "string", description: "产品 ID" },
        { name: "name", type: "string", description: "产品名称" },
      ],
    },
  ],
  api: [
    { method: "GET", path: "/api/products", role: "agent", description: "列出所有产品" },
  ],
});
```

### 配置

```typescript
// nkmc.config.ts
import { defineConfig } from "@nkmc/core";

export default defineConfig({
  name: "my-api",
  version: "1.0",
  roles: ["agent", "premium"],
  framework: "hono",
  pricing: {
    "POST /api/orders": { cost: 0.05, token: "USDC" },
  },
});
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `NKMC_GATEWAY_URL` | 网关 URL（默认：`https://api.nkmc.ai`） |
| `NKMC_TOKEN` | Agent JWT 令牌（推荐使用 `nkmc auth`） |
| `NKMC_PUBLISH_TOKEN` | 注册用的发布令牌 |
| `NKMC_DOMAIN` | 服务的默认域名 |
| `NKMC_HOME` | 配置目录（默认：`~/.nkmc`） |

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test
```

## 链接

- **文档**：[nkmc.ai/docs](https://nkmc.ai/docs)
- **Agent 参考**：[nkmc.ai/agent.md](https://nkmc.ai/agent.md)
- **网关**：[api.nkmc.ai](https://api.nkmc.ai)

## 许可证

MIT
