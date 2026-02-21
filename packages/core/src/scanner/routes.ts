export function extractRoutesRegex(
  content: string,
): { method: string; path: string; description: string }[] {
  const routes: { method: string; path: string; description: string }[] = [];
  // Match patterns: app.get("/path", ...) / router.post("/path", ...) / .get("/path")
  const regex =
    /\.\s*(get|post|put|patch|delete)\s*\(\s*["'`](\/[^"'`]*)["'`]/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    // Skip middleware-like paths
    if (path === "/" && method === "GET") continue;
    routes.push({ method, path, description: `${method} ${path}` });
  }
  return routes;
}
