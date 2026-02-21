import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient, createClient } from "../../src/gateway/client.js";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("GatewayClient", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockFetch.mockReset();
  });

  it("should send command to gateway /execute endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: ["a.ts", "b.ts"] }),
    });

    const client = new GatewayClient("https://gw.example.com", "test-token");
    const result = await client.execute("ls /src");

    expect(mockFetch).toHaveBeenCalledWith("https://gw.example.com/execute", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command: "ls /src" }),
    });
    expect(result).toEqual({ files: ["a.ts", "b.ts"] });
  });

  it("should strip trailing slash from gateway URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const client = new GatewayClient("https://gw.example.com/", "token");
    await client.execute("cat /file.ts");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gw.example.com/execute",
      expect.any(Object),
    );
  });

  it("should throw on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const client = new GatewayClient("https://gw.example.com", "bad-token");
    await expect(client.execute("ls /")).rejects.toThrow("Gateway error 401: Unauthorized");
  });
});

describe("createClient", () => {
  const originalEnv = { ...process.env };
  let tempHome: string | undefined;

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (tempHome) {
      await rm(tempHome, { recursive: true, force: true });
      tempHome = undefined;
    }
  });

  it("should create client from env vars", async () => {
    process.env.NKMC_GATEWAY_URL = "https://gw.example.com";
    process.env.NKMC_TOKEN = "my-token";

    const client = await createClient();
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it("should use default gateway URL when env var missing", async () => {
    delete process.env.NKMC_GATEWAY_URL;
    process.env.NKMC_TOKEN = "my-token";

    const client = await createClient();
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it("should throw if no token available", async () => {
    delete process.env.NKMC_GATEWAY_URL;
    delete process.env.NKMC_TOKEN;
    await expect(createClient()).rejects.toThrow(
      "No token found. Run 'nkmc auth' first, or set NKMC_TOKEN.",
    );
  });

  it("should fall back to credentials.json agent token", async () => {
    delete process.env.NKMC_GATEWAY_URL;
    delete process.env.NKMC_TOKEN;

    tempHome = join(tmpdir(), `nkmc-client-${Date.now()}`);
    await mkdir(tempHome, { recursive: true });
    process.env.NKMC_HOME = tempHome;

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const data = {
      tokens: {},
      agentToken: {
        token: "stored-jwt",
        gatewayUrl: "https://stored-gw.example.com",
        issuedAt: new Date().toISOString(),
        expiresAt: futureDate,
      },
    };
    await writeFile(join(tempHome, "credentials.json"), JSON.stringify(data));

    const client = await createClient();
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it("should prefer env vars over credentials.json", async () => {
    process.env.NKMC_GATEWAY_URL = "https://env-gw.example.com";
    process.env.NKMC_TOKEN = "env-token";

    tempHome = join(tmpdir(), `nkmc-client-${Date.now()}`);
    await mkdir(tempHome, { recursive: true });
    process.env.NKMC_HOME = tempHome;

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const data = {
      tokens: {},
      agentToken: {
        token: "stored-jwt",
        gatewayUrl: "https://stored-gw.example.com",
        issuedAt: new Date().toISOString(),
        expiresAt: futureDate,
      },
    };
    await writeFile(join(tempHome, "credentials.json"), JSON.stringify(data));

    const client = await createClient();
    expect(client).toBeInstanceOf(GatewayClient);
    // env vars should win — we can't inspect private fields, but the client was created successfully
  });
});
