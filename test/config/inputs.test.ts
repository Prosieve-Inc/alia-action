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

import { loadInputs } from "../../src/config/inputs.ts";

describe("loadInputs", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.INPUT_PROJECT_ID = "my-gcp-project";
    process.env.INPUT_REGION = "us-east5";
    process.env.GITHUB_TOKEN = "ghp_testtoken";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns ActionConfig with all fields when env vars are set", () => {
    const config = loadInputs();

    expect(config.vertexProjectId).toBe("my-gcp-project");
    expect(config.vertexRegion).toBe("us-east5");
    expect(config.githubToken).toBe("ghp_testtoken");
  });

  it("throws when GITHUB_TOKEN is missing from env", () => {
    delete process.env.GITHUB_TOKEN;

    expect(() => loadInputs()).toThrow("GITHUB_TOKEN");
  });
});
