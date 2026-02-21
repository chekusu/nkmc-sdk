import { describe, it, expect, beforeAll } from "vitest";
import { Nkmc } from "../../src/nkmc.js";
import { generateGatewayKeyPair, signJwt } from "../../src/auth/jwt.js";
import type { JWK } from "jose";

describe("Auth Integration", () => {
  let publicKey: JWK;
  let privateKey: JWK;
  let nk: Nkmc;
  const siteId = "integration-test";

  beforeAll(async () => {
    const keys = await generateGatewayKeyPair();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    nk = Nkmc.init({ siteId, gatewayPublicKey: publicKey });
  });

  function mockReq(headers: Record<string, string> = {}): any {
    return { headers };
  }

  function mockRes(): any {
    let statusCode = 200;
    let body: any;
    const res: any = {
      status(c: number) { statusCode = c; return res; },
      json(d: any) { body = d; return res; },
    };
    Object.defineProperty(res, "statusCode", { get: () => statusCode });
    Object.defineProperty(res, "body", { get: () => body });
    return res;
  }

  it("full happy path: agent authenticates and accesses protected route", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_integration",
      roles: ["agent", "premium"],
      svc: siteId,
    });

    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();

    let agentCtx: any;
    await nk.guard({ roles: ["premium"] })(req, res, () => {
      agentCtx = req.nkmc;
    });

    expect(agentCtx).toBeDefined();
    expect(agentCtx.id).toBe("agent_integration");
    expect(agentCtx.roles).toContain("premium");
  });

  it("agent without required role is rejected", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_basic",
      roles: ["agent"],
      svc: siteId,
    });

    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();

    let nextCalled = false;
    await nk.guard({ roles: ["premium"] })(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("INSUFFICIENT_ROLE");
  });

  it("unauthenticated request is rejected", async () => {
    const req = mockReq();
    const res = mockRes();

    let nextCalled = false;
    await nk.guard()(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("NO_TOKEN");
  });

  it("token for wrong service is rejected", async () => {
    const token = await signJwt(privateKey, {
      sub: "agent_wrong_svc",
      roles: ["agent"],
      svc: "wrong-service",
    });

    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();

    let nextCalled = false;
    await nk.guard()(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("WRONG_SERVICE");
  });
});
