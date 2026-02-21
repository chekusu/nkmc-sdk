import { SignJWT, jwtVerify, generateKeyPair, exportJWK, importJWK } from "jose";
import type { JWK } from "jose";

export interface NkmcJwtPayload {
  sub: string;
  roles: string[];
  svc: string;
  iss: string;
  iat: number;
  exp: number;
}

export interface GatewayKeyPair {
  publicKey: JWK;
  privateKey: JWK;
}

export interface SignOptions {
  expiresIn?: string;
}

const ISSUER = "nkmc-gateway";
const DEFAULT_EXPIRY = "15m";

export async function generateGatewayKeyPair(): Promise<GatewayKeyPair> {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });

  const pubJwk = await exportJWK(publicKey);
  const privJwk = await exportJWK(privateKey);

  return {
    publicKey: { ...pubJwk, kty: "OKP", crv: "Ed25519" },
    privateKey: { ...privJwk, kty: "OKP", crv: "Ed25519" },
  };
}

export async function signJwt(
  privateKey: JWK,
  payload: { sub: string; roles: string[]; svc: string },
  options?: SignOptions
): Promise<string> {
  const { sub, roles, svc } = payload;
  const key = (await importJWK(privateKey, "EdDSA")) as CryptoKey;

  return new SignJWT({ sub, roles, svc })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(options?.expiresIn || DEFAULT_EXPIRY)
    .sign(key);
}

export async function verifyJwt(
  token: string,
  publicKey: JWK
): Promise<NkmcJwtPayload> {
  const key = (await importJWK(publicKey, "EdDSA")) as CryptoKey;

  const { payload } = await jwtVerify(token, key, {
    issuer: ISSUER,
  });

  return {
    sub: payload.sub as string,
    roles: payload.roles as string[],
    svc: payload.svc as string,
    iss: payload.iss as string,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}
