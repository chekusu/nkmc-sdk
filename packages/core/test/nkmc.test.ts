import { describe, it, expect, beforeAll } from "vitest";
import { Nkmc } from "../src/nkmc.js";
import { generateGatewayKeyPair, signJwt } from "../src/auth/jwt.js";
import type { JWK } from "jose";

function createMockReq(headers: Record<string, string> = {}) {
  return { headers, nkmc: undefined as any };
}

function createMockRes() {
  let statusCode = 200;
  let body: any;
  return {
    status(code: number) { statusCode = code; return this; },
    json(data: any) { body = data; return this; },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

describe("Nkmc", () => {
  let publicKey: JWK;
  let privateKey: JWK;
  let nk: Nkmc;
  const siteId = "test-service";

  beforeAll(async () => {
    const keys = await generateGatewayKeyPair();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    nk = Nkmc.init({ siteId, gatewayPublicKey: publicKey });
  });

  it("should create instance with init()", () => {
    expect(nk).toBeInstanceOf(Nkmc);
  });

  it("guard() should pass valid request and inject agent context", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_001", roles: ["agent"], svc: siteId,
    });
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    let nextCalled = false;
    await nk.guard()(req as any, res as any, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.nkmc).toEqual({ id: "agent_001", roles: ["agent"] });
  });

  it("guard() should reject request without token", async () => {
    const req = createMockReq();
    const res = createMockRes();
    let nextCalled = false;
    await nk.guard()(req as any, res as any, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("guard() should reject request with wrong role", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_002", roles: ["agent"], svc: siteId,
    });
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    let nextCalled = false;
    await nk.guard({ roles: ["premium"] })(req as any, res as any, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("guard() should return 401 for invalid token", async () => {
    const req = createMockReq({ authorization: "Bearer bad.token.here" });
    const res = createMockRes();
    let nextCalled = false;
    await nk.guard()(req as any, res as any, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("guard() should return 403 for wrong service", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_003", roles: ["agent"], svc: "other-service",
    });
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    let nextCalled = false;
    await nk.guard()(req as any, res as any, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
