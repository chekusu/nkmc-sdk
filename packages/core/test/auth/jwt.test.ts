import { describe, it, expect } from "vitest";
import { generateGatewayKeyPair, signJwt, verifyJwt } from "../../src/auth/jwt.js";

describe("JWT Module", () => {
  it("should generate an Ed25519 key pair in JWK format", async () => {
    const { publicKey, privateKey } = await generateGatewayKeyPair();
    expect(publicKey.kty).toBe("OKP");
    expect(publicKey.crv).toBe("Ed25519");
    expect(publicKey.d).toBeUndefined();
    expect(privateKey.kty).toBe("OKP");
    expect(privateKey.d).toBeDefined();
  });

  it("should sign and verify a JWT", async () => {
    const { publicKey, privateKey } = await generateGatewayKeyPair();

    const token = await signJwt(privateKey, {
      sub: "agent_001",
      roles: ["agent"],
      svc: "acme-store",
    });

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const payload = await verifyJwt(token, publicKey);
    expect(payload.sub).toBe("agent_001");
    expect(payload.roles).toEqual(["agent"]);
    expect(payload.svc).toBe("acme-store");
    expect(payload.iss).toBe("nkmc-gateway");
  });

  it("should reject JWT signed with wrong key", async () => {
    const keys1 = await generateGatewayKeyPair();
    const keys2 = await generateGatewayKeyPair();

    const token = await signJwt(keys1.privateKey, {
      sub: "agent_001",
      roles: ["agent"],
      svc: "test",
    });

    await expect(verifyJwt(token, keys2.publicKey)).rejects.toThrow();
  });

  it("should reject expired JWT", async () => {
    const { publicKey, privateKey } = await generateGatewayKeyPair();

    const token = await signJwt(privateKey, {
      sub: "agent_001",
      roles: ["agent"],
      svc: "test",
    }, { expiresIn: "0s" });

    await new Promise((r) => setTimeout(r, 1100));

    await expect(verifyJwt(token, publicKey)).rejects.toThrow();
  });

  it("should support custom expiration", async () => {
    const { publicKey, privateKey } = await generateGatewayKeyPair();

    const token = await signJwt(privateKey, {
      sub: "agent_001",
      roles: ["agent"],
      svc: "test",
    }, { expiresIn: "1h" });

    const payload = await verifyJwt(token, publicKey);
    expect(payload.exp! - payload.iat!).toBe(3600);
  });
});
