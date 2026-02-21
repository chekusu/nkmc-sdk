# nkmc SDK

Open agent API gateway SDK. Let AI agents discover and call any API on the internet with 6 Unix-like commands, and let developers register their APIs for agent discovery.

| Package | Description | npm |
|---------|-------------|-----|
| [`@nkmc/cli`](packages/cli) | CLI for agents and developers | [![npm](https://img.shields.io/npm/v/@nkmc/cli)](https://www.npmjs.com/package/@nkmc/cli) |
| [`@nkmc/core`](packages/core) | Server SDK — JWT verification, middleware, skill generation | [![npm](https://img.shields.io/npm/v/@nkmc/core)](https://www.npmjs.com/package/@nkmc/core) |

## For Agents

Install the CLI and start browsing APIs:

```bash
npm install -g @nkmc/cli

# Authenticate (token valid 24h)
nkmc auth

# Discover services
nkmc ls /

# Search for APIs
nkmc grep "weather" /

# Explore a service
nkmc ls /api.weather.gov/
nkmc grep "forecast" /api.weather.gov/

# Read the API spec
nkmc cat /api.weather.gov/skill.md
```

### Commands

| Command | Description | HTTP Equivalent |
|---------|-------------|-----------------|
| `nkmc ls <path>` | List services or directory contents | `GET /fs/<path>/` |
| `nkmc cat <path>` | Read a file or call a GET endpoint | `GET /fs/<path>` |
| `nkmc grep <pattern> <path>` | Search services or endpoints | `GET /fs/<path>?q=<pattern>` |
| `nkmc write <path> [data]` | Send data to a POST endpoint | `POST /fs/<path>` |
| `nkmc rm <path>` | Delete a resource | `DELETE /fs/<path>` |
| `nkmc pipe <expr>` | Chain commands with Unix pipes | `GET` then `POST` |

### Available Services

40+ APIs are available on the gateway, including:

**Developer Tools** — GitHub, GitLab, Vercel, Sentry, PagerDuty, CircleCI, Postman
**Cloud & Deployment** — Cloudflare, DigitalOcean, Fly.io, Render
**AI & ML** — OpenAI, OpenRouter, HuggingFace
**Communication** — Slack, Discord, Twilio, Resend
**Productivity** — Notion, Asana, Jira, Spotify
**Database** — Supabase, Neon, Turso
**Commerce** — Stripe
**Data** — Wikipedia, Weather.gov, Datadog
**Blockchain** — Ethereum RPC (Ankr, Alchemy, Infura, Arbitrum, Optimism, Base, Polygon)

```bash
# Example: find and explore APIs
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

## For Developers

Register your API so agents can discover and use it.

### 1. Install

```bash
npm install @nkmc/core
npm install -g @nkmc/cli
```

### 2. Initialize & Generate

```bash
# Detect framework, create nkmc.config.ts
nkmc init

# Scan routes and generate .well-known/skill.md
nkmc generate
```

### 3. Claim Your Domain

```bash
# Request a DNS challenge
nkmc claim api.example.com

# Add the TXT record to your DNS, then verify
nkmc claim api.example.com --verify
```

### 4. Register

```bash
nkmc register --domain api.example.com
```

### 5. Protect Your Routes

```typescript
import { Nkmc } from "@nkmc/core";

const nkmc = Nkmc.init({
  siteId: "api.example.com",
  gatewayPublicKey: process.env.NKMC_PUBLIC_KEY,
});

// Verify all agent requests
app.use(nkmc.guard());

// Or restrict by role
app.use("/admin", nkmc.guard({ roles: ["premium"] }));
```

### Verify Requests Directly

```typescript
import { verifyRequest } from "@nkmc/core";

const result = await verifyRequest(
  req.headers.authorization,
  { siteId: "api.example.com", gatewayPublicKey: publicKey }
);

if (result.ok) {
  console.log(result.agent.id);    // agent ID
  console.log(result.agent.roles); // ["agent"]
}
```

### Generate skill.md Programmatically

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
      description: "Product catalog",
      read: "agent",
      write: "agent",
      fields: [
        { name: "id", type: "string", description: "Product ID" },
        { name: "name", type: "string", description: "Product name" },
      ],
    },
  ],
  api: [
    { method: "GET", path: "/api/products", role: "agent", description: "List all products" },
  ],
});
```

### Configuration

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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NKMC_GATEWAY_URL` | Gateway URL (default: `https://api.nkmc.ai`) |
| `NKMC_TOKEN` | Agent JWT token (prefer `nkmc auth` instead) |
| `NKMC_PUBLISH_TOKEN` | Publish token for registration |
| `NKMC_DOMAIN` | Default domain for the service |
| `NKMC_HOME` | Config directory (default: `~/.nkmc`) |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Links

- **Docs**: [nkmc.ai/docs](https://nkmc.ai/docs)
- **Agent Reference**: [nkmc.ai/agent.md](https://nkmc.ai/agent.md)
- **Gateway**: [api.nkmc.ai](https://api.nkmc.ai)

## License

MIT
