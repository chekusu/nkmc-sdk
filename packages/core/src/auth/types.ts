import type { JWK } from "jose";

export interface AgentContext {
  id: string;
  roles: string[];
}

export interface GuardOptions {
  roles?: string[];
}

export interface NkmcInitOptions {
  siteId: string;
  /** EdDSA public key (JWK). If omitted, auto-fetched from gateway JWKS endpoint. */
  gatewayPublicKey?: JWK;
  /** Gateway base URL (default: https://api.nkmc.ai) */
  gatewayUrl?: string;
}

export type AuthError =
  | { code: "NO_TOKEN"; message: string }
  | { code: "INVALID_TOKEN"; message: string }
  | { code: "TOKEN_EXPIRED"; message: string }
  | { code: "WRONG_SERVICE"; message: string }
  | { code: "INSUFFICIENT_ROLE"; message: string };
