import { describe, it, expect } from "vitest";
import { VERSION, defineConfig } from "@nkmc/core";
import type {
  SkillDefinition,
  SkillFrontmatter,
  SchemaTable,
  SchemaField,
  ApiEndpoint,
  PricingRule,
  NkmcConfig,
} from "@nkmc/core";

describe("Core Types", () => {
  it("should construct a valid SkillDefinition", () => {
    const skill: SkillDefinition = {
      frontmatter: {
        name: "Acme Store",
        gateway: "nkmc",
        version: "1.0",
        roles: ["agent", "premium"],
      },
      description: "An online store for agents.",
      schema: [
        {
          name: "products",
          description: "Product catalog.",
          read: "public",
          write: "premium",
          fields: [
            { name: "id", type: "string", description: "Product ID" },
            { name: "price", type: "number", description: "Price in USDC" },
          ],
        },
      ],
      api: [
        {
          method: "POST",
          path: "/api/checkout",
          role: "agent",
          pricing: { cost: 0.05, token: "USDC" },
          description: "Checkout the cart.",
          input: { cart_id: "string" },
          output: { order_id: "string" },
        },
      ],
    };

    expect(skill.frontmatter.name).toBe("Acme Store");
    expect(skill.schema).toHaveLength(1);
    expect(skill.api).toHaveLength(1);
    expect(skill.api[0].pricing?.cost).toBe(0.05);
  });

  it("should allow minimal SkillDefinition", () => {
    const skill: SkillDefinition = {
      frontmatter: {
        name: "Simple Service",
        gateway: "nkmc",
        version: "1.0",
        roles: ["agent"],
      },
      description: "A minimal service.",
      schema: [],
      api: [],
    };

    expect(skill.frontmatter.roles).toContain("agent");
    expect(skill.schema).toHaveLength(0);
  });
});

describe("VERSION", () => {
  it("should be a semver string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("defineConfig", () => {
  it("should return the same config object", () => {
    const config: NkmcConfig = {
      name: "test",
      version: "1.0",
      roles: ["agent"],
      framework: "hono",
    };
    expect(defineConfig(config)).toBe(config);
  });

  it("should accept config with all optional fields", () => {
    const config = defineConfig({
      name: "full",
      version: "2.0",
      roles: ["agent", "premium"],
      framework: "express",
      orm: "prisma",
      schemaPath: "prisma/schema.prisma",
      pricing: { "POST /api/orders": { cost: 0.05, token: "USDC" } },
      gatewayUrl: "https://api.nkmc.ai",
      domain: "myapi.com",
    });
    expect(config.name).toBe("full");
    expect(config.pricing?.["POST /api/orders"]?.cost).toBe(0.05);
  });
});
