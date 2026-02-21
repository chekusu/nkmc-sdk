# nkmc Examples

Runnable examples showing how to use the nkmc CLI to interact with the gateway.

## Prerequisites

```bash
npm install -g @nkmc/cli
```

## Authenticate

All examples require authentication. Run once:

```bash
nkmc auth
```

This saves a JWT token to `~/.nkmc/credentials.json` (valid for 24h).

## Run an Example

Each example has a `demo.sh` script:

```bash
cd 01-discover-apis
bash demo.sh
```

## Claude Code Integration

Each example includes a `CLAUDE.md` file. To use with Claude Code, copy it to your project directory or point Claude Code at the example directory.

## Examples

| # | Name | Description |
|---|------|-------------|
| 01 | [Discover APIs](./01-discover-apis/) | Explore all services available on the gateway |
| 02 | [Weather Alerts](./02-weather-alerts/) | Fetch weather forecast and alert data |
| 03 | [GitHub Explorer](./03-github-explorer/) | Browse GitHub repositories and issues |
