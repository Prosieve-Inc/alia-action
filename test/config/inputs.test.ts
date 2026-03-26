import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

// Mock @actions/core before importing the module under test
mock.module("@actions/core", () => ({
  getInput: (name: string, _options?: { required?: boolean }) => {
    const envName = `INPUT_${name.toUpperCase().replace(/ /g, "_")}`;
    return process.env[envName] ?? "";
  },
  setSecret: mock(() => {}),
  setFailed: mock(() => {}),
}));

import { ActionConfig } from "../../src/config/inputs.ts";

describe("ActionConfig.fromEnv", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GITHUB_TOKEN = "ghp_testtoken";
    process.env.ALIA_BACKEND_URL = "https://backend.example.com";
    process.env.ALIA_SKILL_STORE_ROUTE = "/api/skills";
    process.env.ALIA_SAVE_INSIGHTS_ROUTE = "/api/insights";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns ActionConfig with all fields when env vars are set", () => {
    const config = ActionConfig.fromEnv();
    expect(config.githubToken).toBe("ghp_testtoken");
    expect(config.aliaBackendUrl).toBe("https://backend.example.com");
    expect(config.aliaSkillStoreRoute).toBe("/api/skills");
    expect(config.aliaSaveInsightsRoute).toBe("/api/insights");
  });

  it("throws when GITHUB_TOKEN is missing from env", () => {
    delete process.env.GITHUB_TOKEN;
    expect(() => ActionConfig.fromEnv()).toThrow("GITHUB_TOKEN");
  });

  it("throws when ALIA_BACKEND_URL is missing from env", () => {
    delete process.env.ALIA_BACKEND_URL;
    expect(() => ActionConfig.fromEnv()).toThrow("ALIA_BACKEND_URL");
  });

  it("throws when ALIA_SKILL_STORE_ROUTE is missing from env", () => {
    delete process.env.ALIA_SKILL_STORE_ROUTE;
    expect(() => ActionConfig.fromEnv()).toThrow("ALIA_SKILL_STORE_ROUTE");
  });

  it("throws when ALIA_SAVE_INSIGHTS_ROUTE is missing from env", () => {
    delete process.env.ALIA_SAVE_INSIGHTS_ROUTE;
    expect(() => ActionConfig.fromEnv()).toThrow("ALIA_SAVE_INSIGHTS_ROUTE");
  });
});
