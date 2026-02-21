import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient } from "../../src/gateway/client.js";

describe("GatewayClient BYOK methods", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockFetch.mockReset();
  });

  describe("uploadByok", () => {
    it("should PUT to /byok/:domain with auth payload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const client = new GatewayClient("https://gw.example.com", "test-jwt");
      await client.uploadByok("api.openai.com", {
        type: "bearer",
        token: "sk-test",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/byok/api.openai.com",
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer test-jwt",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth: { type: "bearer", token: "sk-test" },
          }),
        },
      );
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      const client = new GatewayClient("https://gw.example.com", "bad-jwt");
      await expect(
        client.uploadByok("api.openai.com", { type: "bearer", token: "sk" }),
      ).rejects.toThrow("BYOK upload failed 403");
    });
  });

  describe("listByok", () => {
    it("should GET /byok and return domains", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ domains: ["api.openai.com", "api.github.com"] }),
      });

      const client = new GatewayClient("https://gw.example.com", "test-jwt");
      const result = await client.listByok();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/byok",
        { headers: { Authorization: "Bearer test-jwt" } },
      );
      expect(result.domains).toEqual(["api.openai.com", "api.github.com"]);
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const client = new GatewayClient("https://gw.example.com", "bad-jwt");
      await expect(client.listByok()).rejects.toThrow("BYOK list failed 401");
    });
  });

  describe("deleteByok", () => {
    it("should DELETE /byok/:domain", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const client = new GatewayClient("https://gw.example.com", "test-jwt");
      await client.deleteByok("api.openai.com");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/byok/api.openai.com",
        {
          method: "DELETE",
          headers: { Authorization: "Bearer test-jwt" },
        },
      );
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      const client = new GatewayClient("https://gw.example.com", "jwt");
      await expect(client.deleteByok("api.openai.com")).rejects.toThrow(
        "BYOK delete failed 404",
      );
    });
  });

  describe("uploadByok with api-key auth", () => {
    it("should send api-key type auth payload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const client = new GatewayClient("https://gw.example.com", "test-jwt");
      await client.uploadByok("api.anthropic.com", {
        type: "api-key",
        header: "x-api-key",
        key: "sk-ant-test",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.auth).toEqual({
        type: "api-key",
        header: "x-api-key",
        key: "sk-ant-test",
      });
    });
  });
});
