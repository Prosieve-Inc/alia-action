import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

// Mock @actions/core before importing the module under test
const mockSetSecret = mock(() => {});
const mockSetFailed = mock(() => {});

mock.module("@actions/core", () => ({
  getInput: (name: string, _options?: { required?: boolean }) => {
    const envName = `INPUT_${name.toUpperCase().replace(/ /g, "_")}`;
    return process.env[envName] ?? "";
  },
  setSecret: mockSetSecret,
  setFailed: mockSetFailed,
}));

import { loadInputs } from "../../src/config/inputs.ts";

describe("loadInputs", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.INPUT_BACKEND_URL = "https://api.test.com";
    process.env.INPUT_AUTH_ROUTE = "/auth";
    process.env.INPUT_INSIGHTS_ROUTE = "/insights";
    process.env.INPUT_ALIA_KEY = "test-key-123";
    process.env.GITHUB_TOKEN = "ghp_testtoken";
    mockSetSecret.mockClear();
    mockSetFailed.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns ActionConfig with all fields when env vars are set", () => {
    const config = loadInputs();

    expect(config.backendUrl).toBe("https://api.test.com");
    expect(config.authRoute).toBe("/auth");
    expect(config.insightsRoute).toBe("/insights");
    expect(config.aliaKey).toBe("test-key-123");
    expect(config.githubToken).toBe("ghp_testtoken");
  });

  it("throws when GITHUB_TOKEN is missing from env", () => {
    delete process.env.GITHUB_TOKEN;

    expect(() => loadInputs()).toThrow("GITHUB_TOKEN");
  });

  it("calls core.setSecret for sensitive values", () => {
    loadInputs();

    expect(mockSetSecret).toHaveBeenCalledWith("test-key-123");
    expect(mockSetSecret).toHaveBeenCalledWith("https://api.test.com");
  });
});
