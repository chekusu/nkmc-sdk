[English](README.md) | [中文](README.zh.md) | **日本語**

# nkmc SDK

オープンなエージェント API ゲートウェイ SDK。AI エージェントが 6 つの Unix ライクなコマンドでインターネット上の任意の API を発見・呼び出し可能にし、開発者は DNS 検証を通じて自分の API をエージェント発見用に登録できます。 — [nkmc.ai](https://nkmc.ai)

| パッケージ | 説明 | npm |
|-----------|------|-----|
| [`@nkmc/cli`](packages/cli) | エージェント・開発者向け CLI | [![npm](https://img.shields.io/npm/v/@nkmc/cli)](https://www.npmjs.com/package/@nkmc/cli) |
| [`@nkmc/core`](packages/core) | サーバー SDK — JWT 検証、ミドルウェア、skill 生成 | [![npm](https://img.shields.io/npm/v/@nkmc/core)](https://www.npmjs.com/package/@nkmc/core) |

## エージェント向け

CLI をインストールして API のブラウジングを開始：

```bash
npm install -g @nkmc/cli

# 認証（トークン有効期限 24 時間）
nkmc auth

# サービスを発見
nkmc ls /

# API を検索
nkmc grep "weather" /

# サービスを探索
nkmc ls /api.weather.gov/
nkmc grep "forecast" /api.weather.gov/

# API 仕様を読む
nkmc cat /api.weather.gov/skill.md
```

### コマンド

| コマンド | 説明 | HTTP 相当 |
|---------|------|-----------|
| `nkmc ls <path>` | サービスやディレクトリ内容を一覧表示 | `GET /fs/<path>/` |
| `nkmc cat <path>` | ファイルを読む、または GET エンドポイントを呼び出す | `GET /fs/<path>` |
| `nkmc grep <pattern> <path>` | サービスやエンドポイントを検索 | `GET /fs/<path>?q=<pattern>` |
| `nkmc write <path> [data]` | POST エンドポイントにデータを送信 | `POST /fs/<path>` |
| `nkmc rm <path>` | リソースを削除 | `DELETE /fs/<path>` |
| `nkmc pipe <expr>` | Unix パイプでコマンドを連鎖 | `GET` の後 `POST` |

### 利用可能なサービス

ゲートウェイ上で 40 以上の API が利用可能です（[すべて見る](https://nkmc.ai/explore)）：

| カテゴリ | サービス |
|---------|----------|
| **開発ツール** | GitHub、GitLab、Vercel、Sentry、PagerDuty、CircleCI、Postman |
| **クラウド・デプロイ** | Cloudflare、DigitalOcean、Fly.io、Render |
| **AI・機械学習** | OpenAI、OpenRouter、HuggingFace |
| **コミュニケーション** | Slack、Discord、Twilio、Resend |
| **プロダクティビティ** | Notion、Asana、Jira、Spotify |
| **データベース** | Supabase、Neon、Turso |
| **コマース** | Stripe |
| **データ** | Wikipedia、Weather.gov、Datadog |
| **ブロックチェーン** | Ethereum RPC（Ankr、Alchemy、Infura、Arbitrum、Optimism、Base、Polygon） |

```bash
# 例：API を検索して探索
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

## 開発者向け

API を登録して、エージェントが発見・利用できるようにします。

### 1. インストール

```bash
npm install @nkmc/core
npm install -g @nkmc/cli
```

### 2. 初期化と生成

```bash
# フレームワークを検出し、nkmc.config.ts を作成
nkmc init

# ルートをスキャンし、.well-known/skill.md を生成
nkmc generate
```

### 3. ドメインの申請

```bash
# DNS チャレンジをリクエスト
nkmc claim api.example.com

# TXT レコードを追加してから検証
nkmc claim api.example.com --verify
```

### 4. 登録

```bash
nkmc register --domain api.example.com
```

### 5. ルートの保護

```typescript
import { Nkmc } from "@nkmc/core";

const nkmc = Nkmc.init({
  siteId: "api.example.com", // ステップ 3 で申請したドメイン
});

// すべてのエージェントリクエストを検証
app.use(nkmc.guard());

// またはロールで制限
app.use("/admin", nkmc.guard({ roles: ["premium"] }));
```

> ゲートウェイの公開鍵は `https://api.nkmc.ai/.well-known/jwks.json` から自動取得・キャッシュされます。`gatewayPublicKey` で明示的に指定することも可能です。

### リクエストを直接検証

```typescript
import { verifyRequest } from "@nkmc/core";

const result = await verifyRequest(
  req.headers.authorization,
  { siteId: "api.example.com" }
);

if (result.ok) {
  console.log(result.agent.id);    // エージェント ID
  console.log(result.agent.roles); // ["agent"]
}
```

### プログラムで skill.md を生成

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
      description: "商品カタログ",
      read: "agent",
      write: "agent",
      fields: [
        { name: "id", type: "string", description: "商品 ID" },
        { name: "name", type: "string", description: "商品名" },
      ],
    },
  ],
  api: [
    { method: "GET", path: "/api/products", role: "agent", description: "すべての商品を一覧表示" },
  ],
});
```

### 設定

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

## 環境変数

| 変数 | 説明 |
|------|------|
| `NKMC_GATEWAY_URL` | ゲートウェイ URL（デフォルト：`https://api.nkmc.ai`） |
| `NKMC_TOKEN` | エージェント JWT トークン（`nkmc auth` 推奨） |
| `NKMC_PUBLISH_TOKEN` | 登録用のパブリッシュトークン |
| `NKMC_DOMAIN` | サービスのデフォルトドメイン |
| `NKMC_HOME` | 設定ディレクトリ（デフォルト：`~/.nkmc`） |

## 開発

```bash
# 依存関係をインストール
pnpm install

# すべてのパッケージをビルド
pnpm build

# テストを実行
pnpm test
```

## リンク

- **ドキュメント**：[nkmc.ai/docs](https://nkmc.ai/docs)
- **エージェントリファレンス**：[nkmc.ai/agent.md](https://nkmc.ai/agent.md)
- **ゲートウェイ**：[api.nkmc.ai](https://api.nkmc.ai)

## ライセンス

MIT
