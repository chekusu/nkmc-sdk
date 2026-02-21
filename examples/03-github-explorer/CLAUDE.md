# GitHub Explorer

You have the nkmc CLI installed. Authenticate first:

```bash
nkmc auth
```

Then use these commands to explore GitHub data:

- `nkmc cat /api.github.com/skill.md` - understand the GitHub API
- `nkmc ls /api.github.com/` - list available GitHub endpoints
- `nkmc cat /api.github.com/repos/<owner>/<repo>` - get repository info
- `nkmc grep "issues" /api.github.com/` - search for issue-related endpoints

## Task

1. Read the GitHub API's skill.md to see what's available
2. List the top-level GitHub API endpoints
3. Look up the `anthropics/claude-code` repository
4. Search for issue-related data in the GitHub API
