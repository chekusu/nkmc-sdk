export class GatewayClient {
  constructor(
    private gatewayUrl: string,
    private token: string,
  ) {}

  private baseUrl(): string {
    return this.gatewayUrl.replace(/\/$/, "");
  }

  async execute(command: string): Promise<unknown> {
    const url = `${this.baseUrl()}/execute`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gateway error ${res.status}: ${body}`);
    }
    return res.json();
  }

  // --- BYOK methods ---

  async uploadByok(
    domain: string,
    auth: { type: string; token?: string; header?: string; key?: string },
  ): Promise<void> {
    const url = `${this.baseUrl()}/byok/${domain}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ auth }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`BYOK upload failed ${res.status}: ${body}`);
    }
  }

  async listByok(): Promise<{ domains: string[] }> {
    const url = `${this.baseUrl()}/byok`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`BYOK list failed ${res.status}: ${body}`);
    }
    return res.json() as Promise<{ domains: string[] }>;
  }

  async deleteByok(domain: string): Promise<void> {
    const url = `${this.baseUrl()}/byok/${domain}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`BYOK delete failed ${res.status}: ${body}`);
    }
  }
}

export async function createClient(): Promise<GatewayClient> {
  const { getAgentToken } = await import("../credentials.js");
  const stored = await getAgentToken();

  const gatewayUrl =
    process.env.NKMC_GATEWAY_URL ?? stored?.gatewayUrl ?? "https://api.nkmc.ai";

  const token = process.env.NKMC_TOKEN ?? stored?.token ?? null;

  if (!token) {
    throw new Error(
      "No token found. Run 'nkmc auth' first, or set NKMC_TOKEN.",
    );
  }

  return new GatewayClient(gatewayUrl, token);
}
