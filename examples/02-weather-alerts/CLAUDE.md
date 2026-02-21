# Weather Alerts

You have the nkmc CLI installed. Authenticate first:

```bash
nkmc auth
```

Then use these commands to access weather data:

- `nkmc cat /api.weather.gov/skill.md` - understand the weather API
- `nkmc cat /api.weather.gov/alerts/active` - get active weather alerts
- `nkmc grep "forecast" /api.weather.gov/` - find forecast endpoints
- `nkmc cat /api.weather.gov/gridpoints/OKX/33,37/forecast` - get a specific forecast

## Task

1. Read the weather API's skill.md to understand available endpoints
2. Fetch the current active weather alerts
3. Look up the forecast for New York City (gridpoint OKX/33,37)
4. Summarize any severe weather warnings
