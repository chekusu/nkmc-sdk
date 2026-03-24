import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient } from "../../src/gateway/client.js";

describe("GatewayClient admin methods", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    process.env.NKMC_ADMIN_TOKEN = "admin-secret-token";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockFetch.mockReset();
    process.env = { ...originalEnv };
  });

  // --- Peer management ---

  describe("addPeer", () => {
    it("should PUT to /admin/federation/peers/:id with admin token", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await client.addPeer("peer-1", {
        name: "Partner Gateway",
        url: "https://partner.example.com",
        sharedSecret: "s3cret",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/admin/federation/peers/peer-1",
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer admin-secret-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Partner Gateway",
            url: "https://partner.example.com",
            sharedSecret: "s3cret",
          }),
        },
      );
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        text: () => Promise.resolve("Peer already exists"),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(
        client.addPeer("peer-1", {
          name: "X",
          url: "https://x.com",
          sharedSecret: "s",
        }),
      ).rejects.toThrow("Add peer failed 409");
    });
  });

  describe("listPeers", () => {
    it("should GET /admin/federation/peers", async () => {
      const peersData = {
        peers: [
          { id: "peer-1", name: "Partner", url: "https://p.com", status: "active" },
        ],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(peersData),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      const result = await client.listPeers();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/admin/federation/peers",
        {
          headers: {
            Authorization: "Bearer admin-secret-token",
          },
        },
      );
      expect(result.peers).toHaveLength(1);
      expect(result.peers[0].id).toBe("peer-1");
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal error"),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(client.listPeers()).rejects.toThrow("List peers failed 500");
    });
  });

  describe("deletePeer", () => {
    it("should DELETE /admin/federation/peers/:id", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await client.deletePeer("peer-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/admin/federation/peers/peer-1",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer admin-secret-token",
          },
        },
      );
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Peer not found"),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(client.deletePeer("nonexistent")).rejects.toThrow(
        "Delete peer failed 404",
      );
    });
  });

  // --- Lending rules ---

  describe("setRule", () => {
    it("should PUT to /admin/federation/rules/:domain", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await client.setRule("api.openai.com", {
        allow: true,
        peers: "*",
        pricing: { mode: "free" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/admin/federation/rules/api.openai.com",
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer admin-secret-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            allow: true,
            peers: "*",
            pricing: { mode: "free" },
          }),
        },
      );
    });

    it("should send rule with specific peers and pricing", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await client.setRule("api.anthropic.com", {
        allow: true,
        peers: ["peer-1", "peer-2"],
        pricing: { mode: "per-request", amount: 0.01 },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.allow).toBe(true);
      expect(body.peers).toEqual(["peer-1", "peer-2"]);
      expect(body.pricing).toEqual({ mode: "per-request", amount: 0.01 });
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Invalid rule"),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(
        client.setRule("bad.com", { allow: true }),
      ).rejects.toThrow("Set rule failed 400");
    });
  });

  describe("listRules", () => {
    it("should GET /admin/federation/rules", async () => {
      const rulesData = {
        rules: [
          {
            domain: "api.openai.com",
            allow: true,
            peers: "*" as const,
            pricing: { mode: "free" },
          },
        ],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(rulesData),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      const result = await client.listRules();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/admin/federation/rules",
        {
          headers: {
            Authorization: "Bearer admin-secret-token",
          },
        },
      );
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].domain).toBe("api.openai.com");
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(client.listRules()).rejects.toThrow("List rules failed 401");
    });
  });

  describe("deleteRule", () => {
    it("should DELETE /admin/federation/rules/:domain", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await client.deleteRule("api.openai.com");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gw.example.com/admin/federation/rules/api.openai.com",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer admin-secret-token",
          },
        },
      );
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Rule not found"),
      });

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(client.deleteRule("nonexistent.com")).rejects.toThrow(
        "Delete rule failed 404",
      );
    });
  });

  // --- Admin token requirement ---

  describe("admin token requirement", () => {
    it("should throw if NKMC_ADMIN_TOKEN is not set for addPeer", async () => {
      delete process.env.NKMC_ADMIN_TOKEN;

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(
        client.addPeer("peer-1", {
          name: "X",
          url: "https://x.com",
          sharedSecret: "s",
        }),
      ).rejects.toThrow("NKMC_ADMIN_TOKEN env var required");
    });

    it("should throw if NKMC_ADMIN_TOKEN is not set for listPeers", async () => {
      delete process.env.NKMC_ADMIN_TOKEN;

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(client.listPeers()).rejects.toThrow(
        "NKMC_ADMIN_TOKEN env var required",
      );
    });

    it("should throw if NKMC_ADMIN_TOKEN is not set for deletePeer", async () => {
      delete process.env.NKMC_ADMIN_TOKEN;

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(client.deletePeer("peer-1")).rejects.toThrow(
        "NKMC_ADMIN_TOKEN env var required",
      );
    });

    it("should throw if NKMC_ADMIN_TOKEN is not set for setRule", async () => {
      delete process.env.NKMC_ADMIN_TOKEN;

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(
        client.setRule("api.openai.com", { allow: true }),
      ).rejects.toThrow("NKMC_ADMIN_TOKEN env var required");
    });

    it("should throw if NKMC_ADMIN_TOKEN is not set for listRules", async () => {
      delete process.env.NKMC_ADMIN_TOKEN;

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(client.listRules()).rejects.toThrow(
        "NKMC_ADMIN_TOKEN env var required",
      );
    });

    it("should throw if NKMC_ADMIN_TOKEN is not set for deleteRule", async () => {
      delete process.env.NKMC_ADMIN_TOKEN;

      const client = new GatewayClient("https://gw.example.com", "user-jwt");
      await expect(client.deleteRule("api.openai.com")).rejects.toThrow(
        "NKMC_ADMIN_TOKEN env var required",
      );
    });
  });

  // --- URL handling ---

  describe("URL handling", () => {
    it("should strip trailing slash from gateway URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ peers: [] }),
      });

      const client = new GatewayClient("https://gw.example.com/", "user-jwt");
      await client.listPeers();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://gw.example.com/admin/federation/peers");
    });
  });
});
