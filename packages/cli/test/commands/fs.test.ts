import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient, createClient } from "../../src/gateway/client.js";

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

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should create client from env vars", () => {
    process.env.NKMC_GATEWAY_URL = "https://gw.example.com";
    process.env.NKMC_TOKEN = "my-token";

    const client = createClient();
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it("should throw if NKMC_GATEWAY_URL is missing", () => {
    delete process.env.NKMC_GATEWAY_URL;
    process.env.NKMC_TOKEN = "my-token";
    expect(() => createClient()).toThrow("NKMC_GATEWAY_URL is required");
  });

  it("should throw if NKMC_TOKEN is missing", () => {
    process.env.NKMC_GATEWAY_URL = "https://gw.example.com";
    delete process.env.NKMC_TOKEN;
    expect(() => createClient()).toThrow("NKMC_TOKEN is required");
  });
});
