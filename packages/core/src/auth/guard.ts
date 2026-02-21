import type { JWK } from "jose";
import { verifyJwt } from "./jwt.js";
import type { AgentContext, AuthError, GuardOptions, NkmcInitOptions } from "./types.js";

const DEFAULT_GATEWAY_URL = "https://api.nkmc.ai";

export type VerifyResult =
  | { ok: true; agent: AgentContext }
  | { ok: false; error: AuthError };

/** Cached public key per gateway URL */
const jwksCache = new Map<string, JWK>();

export async function resolvePublicKey(options: NkmcInitOptions): Promise<JWK> {
  if (options.gatewayPublicKey) return options.gatewayPublicKey;

  const gatewayUrl = (options.gatewayUrl || DEFAULT_GATEWAY_URL).replace(/\/$/, "");
  const cached = jwksCache.get(gatewayUrl);
  if (cached) return cached;

  const res = await globalThis.fetch(`${gatewayUrl}/.well-known/jwks.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch gateway JWKS: ${res.status}`);
  }
  const { keys } = (await res.json()) as { keys: JWK[] };
  if (!keys || keys.length === 0) {
    throw new Error("No keys found in gateway JWKS response");
  }
  const key = keys[0];
  jwksCache.set(gatewayUrl, key);
  return key;
}

export async function verifyRequest(
  authHeader: string | undefined,
  initOptions: NkmcInitOptions,
  guardOptions?: GuardOptions
): Promise<VerifyResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      error: { code: "NO_TOKEN", message: "Missing or invalid Authorization header" },
    };
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    const publicKey = await resolvePublicKey(initOptions);
    payload = await verifyJwt(token, publicKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    if (message.includes("exp") || message.includes("expired")) {
      return {
        ok: false,
        error: { code: "TOKEN_EXPIRED", message: "Token has expired" },
      };
    }
    return {
      ok: false,
      error: { code: "INVALID_TOKEN", message },
    };
  }

  if (payload.svc !== initOptions.siteId) {
    return {
      ok: false,
      error: {
        code: "WRONG_SERVICE",
        message: `Token is for service "${payload.svc}", not "${initOptions.siteId}"`,
      },
    };
  }

  if (guardOptions?.roles && guardOptions.roles.length > 0) {
    const hasRole = guardOptions.roles.some((r) => payload.roles.includes(r));
    if (!hasRole) {
      return {
        ok: false,
        error: {
          code: "INSUFFICIENT_ROLE",
          message: `Requires one of: ${guardOptions.roles.join(", ")}`,
        },
      };
    }
  }

  return {
    ok: true,
    agent: { id: payload.sub, roles: payload.roles },
  };
}
