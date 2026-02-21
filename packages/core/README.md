# @nkmc/core

Server-side SDK for the nkmc gateway. Verify agent JWT tokens, protect API routes with middleware, and generate `skill.md` files.

## Install

```bash
npm install @nkmc/core
```

## Quick Start

### Verify Agent Requests

```typescript
import { Nkmc } from "@nkmc/core";

const nkmc = Nkmc.init({
  siteId: "myapi.com",
  gatewayPublicKey: process.env.NKMC_PUBLIC_KEY,  // EdDSA JWK
});

// Express-style middleware
app.use(nkmc.guard());

// Or restrict to specific roles
app.use("/admin", nkmc.guard({ roles: ["premium"] }));
```

### Verify Requests Directly

```typescript
import { verifyRequest } from "@nkmc/core";

const result = await verifyRequest(
  req.headers.authorization,
  { siteId: "myapi.com", gatewayPublicKey: publicKey }
);

if (result.ok) {
  console.log(result.agent.id);    // agent ID
  console.log(result.agent.roles); // ["agent"]
} else {
  console.log(result.error.code);  // "NO_TOKEN" | "INVALID_TOKEN" | ...
}
```

## API

### `Nkmc`

```typescript
const nkmc = Nkmc.init(options: NkmcInitOptions);
const middleware = nkmc.guard(options?: GuardOptions);
```

- `NkmcInitOptions` — `{ siteId: string; gatewayPublicKey: JWK }`
- `GuardOptions` — `{ roles?: string[] }`

The middleware sets `req.nkmc` with the verified `AgentContext` (`{ id, roles }`), or responds with 401/403.

### `verifyRequest(authHeader, initOptions, guardOptions?)`

Low-level verification function. Returns a discriminated union:

```typescript
type VerifyResult =
  | { ok: true; agent: AgentContext }
  | { ok: false; error: AuthError };
```

Error codes: `NO_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `WRONG_SERVICE`, `INSUFFICIENT_ROLE`.

### JWT Functions

```typescript
import {
  signJwt,
  verifyJwt,
  signPublishToken,
  verifyPublishToken,
} from "@nkmc/core";

// Sign an agent JWT
const token = await signJwt(privateKey, {
  sub: "agent-123",
  roles: ["agent"],
  svc: "myapi.com",
}, { expiresIn: "15m" });

// Verify an agent JWT
const payload = await verifyJwt(token, publicKey);
// { sub, roles, svc, iss, iat, exp }

// Sign a publish token (for CLI registration)
const publishToken = await signPublishToken(privateKey, "myapi.com", {
  expiresIn: "90d",
});

// Verify a publish token
const claims = await verifyPublishToken(publishToken, publicKey);
// { sub, scope: "publish", iss, iat, exp }
```

### Skill Generation

```typescript
import { generateSkillMd } from "@nkmc/core";
import type { SkillDefinition } from "@nkmc/core";

const skill: SkillDefinition = {
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
    {
      method: "GET",
      path: "/api/products",
      role: "agent",
      description: "List all products",
    },
  ],
};

const markdown = generateSkillMd(skill);
// Outputs a markdown file with YAML frontmatter, schema docs, and API docs
```

### Configuration Helper

```typescript
import { defineConfig } from "@nkmc/core";
import type { NkmcConfig } from "@nkmc/core";

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

## Subpath Exports

```typescript
// Main SDK
import { Nkmc, verifyRequest, signJwt } from "@nkmc/core";

// Testing utilities
import { generateGatewayKeyPair, createTestToken } from "@nkmc/core/testing";

// Scanner utilities (framework detection, route extraction)
import { detectFrameworkFromDeps, extractRoutesRegex } from "@nkmc/core/scanner";
```

### `@nkmc/core/testing`

| Export | Description |
|--------|-------------|
| `generateGatewayKeyPair()` | Generate an EdDSA Ed25519 key pair for testing |
| `createTestToken(privateKey, payload, options?)` | Sign a test JWT (alias for `signJwt`) |

### `@nkmc/core/scanner`

| Export | Description |
|--------|-------------|
| `detectFrameworkFromDeps(deps)` | Detect framework from package.json dependencies |
| `hasNkmcSdk(deps)` | Check if @nkmc/core is in dependencies |
| `extractRoutesRegex(content)` | Extract routes from source code via regex |
| `extractPrismaModelNames(content)` | Extract Prisma model names from schema |

## Types

```typescript
import type {
  SkillDefinition,
  SkillFrontmatter,
  SchemaTable,
  SchemaField,
  ApiEndpoint,
  PricingRule,
  AccessRole,
  AgentContext,
  AuthError,
  NkmcInitOptions,
  GuardOptions,
  VerifyResult,
  NkmcJwtPayload,
  PublishTokenPayload,
  GatewayKeyPair,
  SignOptions,
  NkmcConfig,
} from "@nkmc/core";
```

## License

MIT
