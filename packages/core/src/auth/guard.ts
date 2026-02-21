import { verifyJwt } from "./jwt.js";
import type { AgentContext, AuthError, GuardOptions, NkmcInitOptions } from "./types.js";

export type VerifyResult =
  | { ok: true; agent: AgentContext }
  | { ok: false; error: AuthError };

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
    payload = await verifyJwt(token, initOptions.gatewayPublicKey);
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
