import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock createClient before importing the module under test
vi.mock("../../src/gateway/client.js", () => ({
  createClient: vi.fn(),
}));

import { runProxy } from "../../src/commands/run.js";
import { createClient } from "../../src/gateway/client.js";

const mockCreateClient = vi.mocked(createClient);

describe("runProxy", () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockCreateClient.mockReset();
    process.exitCode = originalExitCode;
  });

  it("should call client.proxyExec with correct tool and args", async () => {
    const mockProxyExec = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    mockCreateClient.mockResolvedValue({ proxyExec: mockProxyExec } as any);

    await runProxy("curl", ["-s", "https://example.com"]);

    expect(mockCreateClient).toHaveBeenCalledOnce();
    expect(mockProxyExec).toHaveBeenCalledWith("curl", ["-s", "https://example.com"]);
  });

  it("should write stdout to process.stdout", async () => {
    const mockProxyExec = vi.fn().mockResolvedValue({
      stdout: "hello world\n",
      stderr: "",
      exitCode: 0,
    });
    mockCreateClient.mockResolvedValue({ proxyExec: mockProxyExec } as any);

    await runProxy("echo", ["hello"]);

    expect(stdoutWriteSpy).toHaveBeenCalledWith("hello world\n");
  });

  it("should write stderr to process.stderr", async () => {
    const mockProxyExec = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "error: not found\n",
      exitCode: 1,
    });
    mockCreateClient.mockResolvedValue({ proxyExec: mockProxyExec } as any);

    await runProxy("curl", ["https://bad.url"]);

    expect(stderrWriteSpy).toHaveBeenCalledWith("error: not found\n");
  });

  it("should set process.exitCode from result", async () => {
    const mockProxyExec = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 42,
    });
    mockCreateClient.mockResolvedValue({ proxyExec: mockProxyExec } as any);

    await runProxy("false", []);

    expect(process.exitCode).toBe(42);
  });

  it("should not write stdout when empty", async () => {
    const mockProxyExec = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "some error",
      exitCode: 1,
    });
    mockCreateClient.mockResolvedValue({ proxyExec: mockProxyExec } as any);

    await runProxy("cmd", []);

    expect(stdoutWriteSpy).not.toHaveBeenCalled();
  });

  it("should not write stderr when empty", async () => {
    const mockProxyExec = vi.fn().mockResolvedValue({
      stdout: "output",
      stderr: "",
      exitCode: 0,
    });
    mockCreateClient.mockResolvedValue({ proxyExec: mockProxyExec } as any);

    await runProxy("cmd", []);

    expect(stderrWriteSpy).not.toHaveBeenCalled();
  });

  it("should handle both stdout and stderr together", async () => {
    const mockProxyExec = vi.fn().mockResolvedValue({
      stdout: "data output",
      stderr: "warning: deprecated",
      exitCode: 0,
    });
    mockCreateClient.mockResolvedValue({ proxyExec: mockProxyExec } as any);

    await runProxy("tool", ["--verbose"]);

    expect(stdoutWriteSpy).toHaveBeenCalledWith("data output");
    expect(stderrWriteSpy).toHaveBeenCalledWith("warning: deprecated");
    expect(process.exitCode).toBe(0);
  });
});
