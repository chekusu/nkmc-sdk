# @nkmc/cli

Command-line tool for the nkmc gateway. Scan your API, generate a `skill.md`, register it with the gateway, and interact with registered services as an agent.

## Install

```bash
npm install -g @nkmc/cli
```

## Quick Start

```bash
# Authenticate with the gateway (saves token to ~/.nkmc/credentials.json)
nkmc auth

# List services on the gateway
nkmc ls /

# Read a service's skill.md
nkmc cat /api.weather.gov/skill.md
```

## Commands

### `nkmc auth`

Authenticate with the gateway. Fetches a JWT token (valid 24h) and saves it locally.

```bash
nkmc auth
nkmc auth --gateway-url https://your-gateway.example.com
```

After authenticating, all `ls`/`cat`/`grep`/`write`/`rm` commands work without setting environment variables.

### `nkmc init [dir]`

Detect your project's framework and generate a `nkmc.config.ts` configuration file.

```bash
nkmc init
```

Supports Hono, Express, Fastify, and Next.js. Detects Prisma and Drizzle ORMs.

### `nkmc generate [dir]`

Scan your project and generate `.well-known/skill.md`.

```bash
nkmc generate
nkmc generate --register --gateway-url https://api.nkmc.ai --domain myapi.com
```

Options:
- `--register` — Register with the gateway after generating
- `--gateway-url <url>` — Gateway URL for registration
- `--token <token>` — Auth token for registration
- `--domain <domain>` — Domain name for the service

### `nkmc claim <domain>`

Claim domain ownership via DNS TXT record verification.

```bash
# Step 1: Request a DNS challenge
nkmc claim myapi.com --gateway-url https://api.nkmc.ai

# Step 2: Add the TXT record to your DNS, then verify
nkmc claim myapi.com --gateway-url https://api.nkmc.ai --verify
```

On success, a publish token is saved to `~/.nkmc/credentials.json` for that domain.

### `nkmc register`

Register your `skill.md` with the gateway.

```bash
nkmc register --gateway-url https://api.nkmc.ai --domain myapi.com
```

The token is resolved in this order:
1. `--token` flag
2. `NKMC_PUBLISH_TOKEN` env var
3. Saved publish token from `nkmc claim`

### `nkmc ls <path>`

List files/services on the gateway.

```bash
nkmc ls /                          # List all services
nkmc ls /api.weather.gov/          # List contents of a service
```

### `nkmc cat <path>`

Read a file from the gateway.

```bash
nkmc cat /api.weather.gov/skill.md
nkmc cat /api.weather.gov/alerts/active
```

### `nkmc grep <pattern> <path>`

Search across services on the gateway.

```bash
nkmc grep "weather" /
nkmc grep "forecast" /api.weather.gov/
```

### `nkmc write <path> <data>`

Write data to a path on the gateway.

### `nkmc rm <path>`

Remove a file on the gateway.

## Authentication

The CLI resolves credentials in this order:

1. `NKMC_TOKEN` / `NKMC_GATEWAY_URL` environment variables
2. Saved agent token from `nkmc auth` (`~/.nkmc/credentials.json`)
3. Default gateway URL: `https://api.nkmc.ai`

## Configuration Directory

Credentials are stored in `~/.nkmc/credentials.json` (permissions `0600`). Override the directory with the `NKMC_HOME` environment variable.

## Workflow: Registering Your API

```bash
# 1. Initialize config
nkmc init

# 2. Generate skill.md
nkmc generate

# 3. Claim your domain
nkmc claim myapi.com --gateway-url https://api.nkmc.ai
# ... add DNS TXT record ...
nkmc claim myapi.com --gateway-url https://api.nkmc.ai --verify

# 4. Register with the gateway
nkmc register --gateway-url https://api.nkmc.ai --domain myapi.com
```

## License

MIT
