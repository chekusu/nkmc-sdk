# Discover APIs

You have the nkmc CLI installed. Authenticate first:

```bash
nkmc auth
```

Then use these commands to explore:

- `nkmc ls /` - list all registered services
- `nkmc grep "<keyword>" /` - search across all services
- `nkmc cat /<service>/skill.md` - read a service's capabilities

## Task

1. Run `nkmc ls /` to see all available services
2. Pick an interesting service and read its `skill.md`
3. Use `nkmc grep` to find services related to "weather"
4. Summarize what APIs are available on the gateway
