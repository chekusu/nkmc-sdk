import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runClaim } from "../../src/commands/claim.js";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runClaim", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;
  let tempHome: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const savedNkmcHome = process.env.NKMC_HOME;

  beforeEach(async () => {
    globalThis.fetch = mockFetch;
    tempHome = join(tmpdir(), `nkmc-claim-${Date.now()}`);
    await mkdir(tempHome, { recursive: true });
    process.env.NKMC_HOME = tempHome;
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockFetch.mockReset();
    vi.restoreAllMocks();
    if (savedNkmcHome === undefined) {
      delete process.env.NKMC_HOME;
    } else {
      process.env.NKMC_HOME = savedNkmcHome;
    }
    await rm(tempHome, { recursive: true, force: true });
  });

  describe("challenge mode (without --verify)", () => {
    it("should POST to /domains/challenge and print instructions", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          domain: "api.example.com",
          txtRecord: "_nkmc.api.example.com",
          txtValue: "nkmc-verify=abc123",
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }),
      });

      await runClaim({
        gatewayUrl: "https://gw.example.com",
        domain: "api.example.com",
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://gw.example.com/domains/challenge");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual({ domain: "api.example.com" });

      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("_nkmc.api.example.com");
      expect(output).toContain("nkmc-verify=abc123");
      expect(output).toContain("--verify");
    });

    it("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"error":"Invalid domain"}',
      });

      await expect(
        runClaim({
          gatewayUrl: "https://gw.example.com",
          domain: "bad",
        }),
      ).rejects.toThrow("Challenge request failed (400)");
    });

    it("should strip trailing slash from gateway URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          domain: "api.example.com",
          txtRecord: "_nkmc.api.example.com",
          txtValue: "nkmc-verify=xyz",
          expiresAt: Date.now() + 1000000,
        }),
      });

      await runClaim({
        gatewayUrl: "https://gw.example.com/",
        domain: "api.example.com",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://gw.example.com/domains/challenge");
    });
  });

  describe("verify mode (with --verify)", () => {
    it("should POST to /domains/verify and save token on success", async () => {
      const payload = {
        sub: "api.example.com",
        scope: "publish",
        iss: "nkmc-gateway",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
      };
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
        "base64url",
      );
      const fakeToken = `eyJhbGciOiJFZERTQSJ9.${payloadB64}.fakesig`;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          domain: "api.example.com",
          publishToken: fakeToken,
        }),
      });

      await runClaim({
        gatewayUrl: "https://gw.example.com",
        domain: "api.example.com",
        verify: true,
      });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://gw.example.com/domains/verify");
      expect(opts.method).toBe("POST");

      const credPath = join(tempHome, "credentials.json");
      const creds = JSON.parse(await readFile(credPath, "utf-8"));
      expect(creds.tokens["api.example.com"].publishToken).toBe(fakeToken);

      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("verified successfully");
    });

    it("should print troubleshooting on verification failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "DNS TXT record not found",
        }),
      });

      await runClaim({
        gatewayUrl: "https://gw.example.com",
        domain: "api.example.com",
        verify: true,
      });

      const errorOutput = consoleErrorSpy.mock.calls
        .map((c) => c[0])
        .join("\n");
      expect(errorOutput).toContain("DNS TXT record not found");

      const logOutput = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(logOutput).toContain("dig TXT");
      expect(logOutput).toContain("propagation");
    });
  });
});
