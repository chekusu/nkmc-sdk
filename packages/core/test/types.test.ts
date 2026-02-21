import { describe, it, expect } from "vitest";
import type {
  SkillDefinition,
  SkillFrontmatter,
  SchemaTable,
  SchemaField,
  ApiEndpoint,
  PricingRule,
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
