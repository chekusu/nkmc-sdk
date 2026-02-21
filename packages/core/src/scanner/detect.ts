const FRAMEWORK_PACKAGES: Record<string, string> = {
  hono: "hono",
  next: "next",
  express: "express",
  fastify: "fastify",
  "@hono/node-server": "hono",
};

export function detectFrameworkFromDeps(
  deps: Record<string, string>,
): string | null {
  for (const [pkg, fw] of Object.entries(FRAMEWORK_PACKAGES)) {
    if (pkg in deps) return fw;
  }
  return null;
}

export function hasNkmcSdk(deps: Record<string, string>): boolean {
  return "@nkmc/core" in deps;
}
