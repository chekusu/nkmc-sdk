import { describe, it, expect } from "vitest";
import { createTestToken, generateGatewayKeyPair } from "../src/testing.js";
import { verifyJwt } from "../src/auth/jwt.js";

describe("Testing Utilities", () => {
  it("should generate key pair and create test token", async () => {
    const { publicKey, privateKey } = await generateGatewayKeyPair();

    const token = await createTestToken(privateKey, {
      sub: "test_agent",
      roles: ["agent", "premium"],
      svc: "test-service",
    });

    expect(typeof token).toBe("string");

    const payload = await verifyJwt(token, publicKey);
    expect(payload.sub).toBe("test_agent");
    expect(payload.roles).toEqual(["agent", "premium"]);
    expect(payload.svc).toBe("test-service");
  });

  it("should work end-to-end with Nkmc class", async () => {
    const { Nkmc } = await import("../src/nkmc.js");
    const { publicKey, privateKey } = await generateGatewayKeyPair();

    const nk = Nkmc.init({
      siteId: "my-app",
      gatewayPublicKey: publicKey,
    });

    const token = await createTestToken(privateKey, {
      sub: "agent_e2e",
      roles: ["agent"],
      svc: "my-app",
    });

    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res: any = { status: () => res, json: () => res };

    let nextCalled = false;
    await nk.guard()(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.nkmc.id).toBe("agent_e2e");
  });
});
