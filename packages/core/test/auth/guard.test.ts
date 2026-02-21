import { describe, it, expect, beforeAll } from "vitest";
import { verifyRequest } from "../../src/auth/guard.js";
import { generateGatewayKeyPair, signJwt } from "../../src/auth/jwt.js";
import type { JWK } from "jose";

describe("verifyRequest", () => {
  let publicKey: JWK;
  let privateKey: JWK;
  let validToken: string;
  const siteId = "acme-store";

  beforeAll(async () => {
    const keys = await generateGatewayKeyPair();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    validToken = await signJwt(privateKey, {
      sub: "agent_001",
      roles: ["agent", "premium"],
      svc: siteId,
    });
  });

  it("should return agent context for valid token", async () => {
    const result = await verifyRequest(
      `Bearer ${validToken}`,
      { siteId, gatewayPublicKey: publicKey }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.agent.id).toBe("agent_001");
      expect(result.agent.roles).toEqual(["agent", "premium"]);
    }
  });

  it("should fail with NO_TOKEN when header is missing", async () => {
    const result = await verifyRequest(undefined, {
      siteId, gatewayPublicKey: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_TOKEN");
  });

  it("should fail with NO_TOKEN when header has wrong format", async () => {
    const result = await verifyRequest("Basic abc123", {
      siteId, gatewayPublicKey: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_TOKEN");
  });

  it("should fail with INVALID_TOKEN for bad JWT", async () => {
    const result = await verifyRequest("Bearer invalid.jwt.token", {
      siteId, gatewayPublicKey: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_TOKEN");
  });

  it("should fail with WRONG_SERVICE when svc doesn't match", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_001", roles: ["agent"], svc: "other-service",
    });
    const result = await verifyRequest(`Bearer ${token}`, {
      siteId, gatewayPublicKey: publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WRONG_SERVICE");
  });

  it("should pass role check when agent has required role", async () => {
    const result = await verifyRequest(`Bearer ${validToken}`, {
      siteId, gatewayPublicKey: publicKey,
    }, { roles: ["premium"] });
    expect(result.ok).toBe(true);
  });

  it("should fail with INSUFFICIENT_ROLE when agent lacks role", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_002", roles: ["agent"], svc: siteId,
    });
    const result = await verifyRequest(`Bearer ${token}`, {
      siteId, gatewayPublicKey: publicKey,
    }, { roles: ["premium"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INSUFFICIENT_ROLE");
  });

  it("should pass with no role restriction", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_003", roles: ["agent"], svc: siteId,
    });
    const result = await verifyRequest(`Bearer ${token}`, {
      siteId, gatewayPublicKey: publicKey,
    });
    expect(result.ok).toBe(true);
  });
});
