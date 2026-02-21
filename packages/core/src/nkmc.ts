import type { JWK } from "jose";
import { verifyRequest } from "./auth/guard.js";
import type { AgentContext, GuardOptions, NkmcInitOptions } from "./auth/types.js";

interface NkmcRequest {
  headers: Record<string, string | string[] | undefined>;
  nkmc?: AgentContext;
}

interface NkmcResponse {
  status(code: number): NkmcResponse;
  json(body: unknown): NkmcResponse;
}

type NextFunction = (err?: unknown) => void;
type Middleware = (req: NkmcRequest, res: NkmcResponse, next: NextFunction) => void;

export class Nkmc {
  private options: NkmcInitOptions;

  private constructor(options: NkmcInitOptions) {
    this.options = options;
  }

  static init(options: NkmcInitOptions): Nkmc {
    return new Nkmc(options);
  }

  guard(guardOptions?: GuardOptions): Middleware {
    const initOptions = this.options;

    return async (req, res, next) => {
      const authHeader = req.headers.authorization as string | undefined;
      const result = await verifyRequest(authHeader, initOptions, guardOptions);

      if (!result.ok) {
        const status = result.error.code === "INSUFFICIENT_ROLE" || result.error.code === "WRONG_SERVICE"
          ? 403
          : 401;
        res.status(status).json({ error: result.error.code, message: result.error.message });
        return;
      }

      req.nkmc = result.agent;
      next();
    };
  }
}
