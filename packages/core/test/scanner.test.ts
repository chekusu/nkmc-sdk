import { describe, it, expect } from "vitest";
import {
  detectFrameworkFromDeps,
  hasNkmcSdk,
  extractRoutesRegex,
  extractPrismaModelNames,
} from "../src/scanner/index.js";

describe("detectFrameworkFromDeps", () => {
  it("should detect hono", () => {
    expect(detectFrameworkFromDeps({ hono: "^4.0.0" })).toBe("hono");
  });

  it("should detect next", () => {
    expect(detectFrameworkFromDeps({ next: "^15.0.0" })).toBe("next");
  });

  it("should detect express", () => {
    expect(detectFrameworkFromDeps({ express: "^4.0.0" })).toBe("express");
  });

  it("should detect fastify", () => {
    expect(detectFrameworkFromDeps({ fastify: "^5.0.0" })).toBe("fastify");
  });

  it("should detect hono via @hono/node-server", () => {
    expect(detectFrameworkFromDeps({ "@hono/node-server": "^1.0.0" })).toBe("hono");
  });

  it("should return null for unknown deps", () => {
    expect(detectFrameworkFromDeps({ lodash: "^4.0.0" })).toBeNull();
  });

  it("should return null for empty deps", () => {
    expect(detectFrameworkFromDeps({})).toBeNull();
  });
});

describe("hasNkmcSdk", () => {
  it("should return true when @nkmc/core is present", () => {
    expect(hasNkmcSdk({ "@nkmc/core": "workspace:*" })).toBe(true);
  });

  it("should return false when @nkmc/core is absent", () => {
    expect(hasNkmcSdk({ hono: "^4.0.0" })).toBe(false);
  });
});

describe("extractRoutesRegex", () => {
  it("should extract routes from app.method calls", () => {
    const code = `
      app.get("/api/users", handler);
      app.post("/api/users", handler);
      app.put("/api/users/:id", handler);
      app.delete("/api/users/:id", handler);
    `;
    const routes = extractRoutesRegex(code);
    expect(routes).toEqual([
      { method: "GET", path: "/api/users", description: "GET /api/users" },
      { method: "POST", path: "/api/users", description: "POST /api/users" },
      { method: "PUT", path: "/api/users/:id", description: "PUT /api/users/:id" },
      { method: "DELETE", path: "/api/users/:id", description: "DELETE /api/users/:id" },
    ]);
  });

  it("should skip GET / middleware-like paths", () => {
    const code = `app.get("/", handler);`;
    const routes = extractRoutesRegex(code);
    expect(routes).toEqual([]);
  });

  it("should handle router.method style", () => {
    const code = `router.post("/api/login", handler);`;
    const routes = extractRoutesRegex(code);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("POST");
    expect(routes[0].path).toBe("/api/login");
  });

  it("should return empty array for no matches", () => {
    expect(extractRoutesRegex("const x = 1;")).toEqual([]);
  });
});

describe("extractPrismaModelNames", () => {
  it("should extract model names from prisma schema", () => {
    const schema = `
      model User {
        id    String @id
        email String @unique
      }

      model Post {
        id      String @id
        title   String
        content String?
      }
    `;
    expect(extractPrismaModelNames(schema)).toEqual(["User", "Post"]);
  });

  it("should return empty array for no models", () => {
    const schema = `generator client { provider = "prisma-client-js" }`;
    expect(extractPrismaModelNames(schema)).toEqual([]);
  });
});
