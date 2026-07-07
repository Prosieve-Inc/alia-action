import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { ActionConfig } from "../../src/config/inputs";
import type { PullRequestData } from "../../src/github/types";

// Mock @actions/core
mock.module("@actions/core", () => ({
  info: mock(() => {}),
  warning: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
  group: mock((_name: string, fn: () => Promise<void>) => fn()),
  setFailed: mock(() => {}),
  getIDToken: mock(() => Promise.resolve("mock-oidc-token")),
}));

// Mock logger to avoid transitive @actions/core dependency
mock.module("../../src/utils/logger", () => ({
  log: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    group: mock((_name: string, fn: () => Promise<void>) => fn()),
    metadata: mock(() => {}),
  },
}));

const defaultPR: PullRequestData = {
  number: 42,
  title: "Test PR",
  body: "PR body",
  author: "testauthor",
  baseBranch: "main",
  headBranch: "feature",
  state: "closed",
  merged: true,
  mergedAt: "2026-01-15T10:00:00Z",
  labels: [],
  url: "https://github.com/owner/repo/pull/42",
};

const mockFetchPullRequestData = mock(() => Promise.resolve(defaultPR));
const mockFetchComments = mock(() => Promise.resolve([]));
const mockFetchFiles = mock(() => Promise.resolve([]));
const mockFetchCommits = mock(() => Promise.resolve([]));

mock.module("../../src/github/data-fetcher", () => ({
  fetchPullRequestData: mockFetchPullRequestData,
  fetchComments: mockFetchComments,
  fetchFiles: mockFetchFiles,
  fetchCommits: mockFetchCommits,
}));

let lastFormatArg: unknown = null;
const mockFormatEventContext = mock((ctx: unknown) => {
  lastFormatArg = ctx;
  return "Formatted context";
});
mock.module("../../src/github/data-formatter", () => ({
  formatEventContext: mockFormatEventContext,
}));

// Mock claude-analysis
const mockRunClaudeAnalysis = mock(() =>
  Promise.resolve({
    summaries: ["test insight"],
    cost: 0.01,
    durationMs: 1000,
  }),
);
mock.module("../../src/events/claude-analysis", () => ({
  runClaudeAnalysis: mockRunClaudeAnalysis,
}));

// Mock alia-client. Spread the real module so its `AliaClient` export survives
// this process-global mock (Bun does not scope or restore mock.module), otherwise
// other test files importing the real class break.
import * as actualAliaClientModule from "../../src/services/alia-client";
const mockSendInsights = mock(() => Promise.resolve());
mock.module("../../src/services/alia-client", () => ({
  ...actualAliaClientModule,
  fetchSkillZip: mock(() => Promise.resolve(new ArrayBuffer(0))),
  sendInsights: mockSendInsights,
}));

import type { AliaClient } from "../../src/services/alia-client";
import { handlePullRequestClosed } from "../../src/events/pull-request-closed";
import { createMockPullRequestPayload } from "../mock-context";

const mockConfig = {
  githubToken: "ghp_test",
  aliaBackendUrl: "https://backend.example.com",
  aliaSkillStoreRoute: "/api/skills",
  aliaSaveInsightsRoute: "/api/insights",
} as ActionConfig;

const mockAliaClient = {
  fetchSkillZip: mock(() => Promise.resolve(new ArrayBuffer(0))),
  sendInsights: mockSendInsights,
} as unknown as AliaClient;

describe("pull-request-closed handler", () => {
  beforeEach(() => {
    mockFetchPullRequestData.mockClear();
    mockFetchPullRequestData.mockImplementation(() =>
      Promise.resolve(defaultPR),
    );
    mockFetchComments.mockClear();
    mockFetchFiles.mockClear();
    mockFetchCommits.mockClear();
    mockFormatEventContext.mockClear();
    mockRunClaudeAnalysis.mockClear();
    mockSendInsights.mockClear();
    lastFormatArg = null;
  });

  it("fetches PR data, files, commits, and comments", async () => {
    const payload = createMockPullRequestPayload();
    const mockOctokit = {} as never;

    await handlePullRequestClosed(
      payload,
      mockOctokit,
      mockConfig,
      mockAliaClient,
    );

    expect(mockFetchPullRequestData).toHaveBeenCalledTimes(1);
    expect(mockFetchFiles).toHaveBeenCalledTimes(1);
    expect(mockFetchCommits).toHaveBeenCalledTimes(1);
    expect(mockFetchComments).toHaveBeenCalledTimes(1);
  });

  it("runs claude analysis and sends insights", async () => {
    const payload = createMockPullRequestPayload();
    const mockOctokit = {} as never;

    await handlePullRequestClosed(
      payload,
      mockOctokit,
      mockConfig,
      mockAliaClient,
    );

    expect(mockRunClaudeAnalysis).toHaveBeenCalledTimes(1);
    expect(mockSendInsights).toHaveBeenCalledTimes(1);
  });

  it("includes merged status in EventContext", async () => {
    const payload = createMockPullRequestPayload();
    const mockOctokit = {} as never;

    await handlePullRequestClosed(
      payload,
      mockOctokit,
      mockConfig,
      mockAliaClient,
    );

    expect(mockFormatEventContext).toHaveBeenCalledTimes(1);
    const contextArg = lastFormatArg as {
      pullRequest?: { merged: boolean };
    };
    expect(contextArg.pullRequest?.merged).toBe(true);
  });

  it("handles non-merged PR correctly", async () => {
    const nonMergedPR: PullRequestData = {
      ...defaultPR,
      merged: false,
      mergedAt: null,
    };
    mockFetchPullRequestData.mockImplementation(() =>
      Promise.resolve(nonMergedPR),
    );
    const payload = createMockPullRequestPayload({
      pull_request: {
        number: 42,
        title: "Test PR",
        body: "PR body",
        merged: false,
        merged_at: null,
        user: { login: "testauthor", id: 12345 },
        head: { ref: "feature" },
        base: { ref: "main" },
        labels: [],
        html_url: "https://github.com/owner/repo/pull/42",
      },
    });
    const mockOctokit = {} as never;

    await handlePullRequestClosed(
      payload,
      mockOctokit,
      mockConfig,
      mockAliaClient,
    );

    const contextArg = lastFormatArg as {
      pullRequest?: { merged: boolean };
    };
    expect(contextArg.pullRequest?.merged).toBe(false);
  });
});
