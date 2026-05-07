import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { ActionConfig } from "../../src/config/inputs";

// Mock @actions/core
const mockCoreInfo = mock(() => {});
const mockCoreWarning = mock(() => {});
mock.module("@actions/core", () => ({
  info: mockCoreInfo,
  warning: mockCoreWarning,
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

const mockFetchPullRequestData = mock(() =>
  Promise.resolve({
    number: 42,
    title: "Test PR",
    body: "PR body",
    author: "testauthor",
    baseBranch: "main",
    headBranch: "feature",
    merged: true,
    mergedAt: "2026-01-15T10:00:00Z",
    labels: [],
    url: "https://github.com/owner/repo/pull/42",
  }),
);
const mockFetchComments = mock(() => Promise.resolve([]));
const mockFetchFiles = mock(() => Promise.resolve([]));
const mockFetchCommits = mock(() => Promise.resolve([]));
const mockFindMergedPR = mock(() => Promise.resolve(42 as number | null));

mock.module("../../src/github/data-fetcher", () => ({
  fetchPullRequestData: mockFetchPullRequestData,
  fetchComments: mockFetchComments,
  fetchFiles: mockFetchFiles,
  fetchCommits: mockFetchCommits,
  findMergedPR: mockFindMergedPR,
}));

const mockFormatEventContext = mock(() => "Formatted context");
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

// Mock alia-client
const mockSendInsights = mock(() => Promise.resolve());
mock.module("../../src/services/alia-client", () => ({
  fetchSkillZip: mock(() => Promise.resolve(new ArrayBuffer(0))),
  sendInsights: mockSendInsights,
}));

import type { AliaClient } from "../../src/services/alia-client";
import { handlePush } from "../../src/events/push";
import { createMockPushPayload } from "../mock-context";

const mockConfig = {
  githubToken: "test-token",
  aliaBackendUrl: "https://backend.example.com",
  aliaSkillStoreRoute: "/api/skills",
  aliaSaveInsightsRoute: "/api/insights",
} as ActionConfig;

const mockAliaClient = {
  fetchSkillZip: mock(() => Promise.resolve(new ArrayBuffer(0))),
  sendInsights: mockSendInsights,
} as unknown as AliaClient;

describe("push handler", () => {
  beforeEach(() => {
    mockFindMergedPR.mockClear();
    mockFetchPullRequestData.mockClear();
    mockFetchComments.mockClear();
    mockFetchFiles.mockClear();
    mockFetchCommits.mockClear();
    mockFormatEventContext.mockClear();
    mockRunClaudeAnalysis.mockClear();
    mockSendInsights.mockClear();
    mockCoreInfo.mockClear();
    mockCoreWarning.mockClear();
    // Reset to default returning 42
    mockFindMergedPR.mockImplementation(() =>
      Promise.resolve(42 as number | null),
    );
  });

  it("calls findMergedPR with the head commit SHA", async () => {
    const payload = createMockPushPayload();
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig, mockAliaClient);

    expect(mockFindMergedPR).toHaveBeenCalledWith(
      mockOctokit,
      "Prosieve-Inc",
      "test-repo",
      "abc123def456",
    );
  });

  it("skips analysis when push comes from a merged PR", async () => {
    const payload = createMockPushPayload();
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig, mockAliaClient);

    // Merged PR found → skip, handled by pull_request closed event
    expect(mockRunClaudeAnalysis).not.toHaveBeenCalled();
    expect(mockSendInsights).not.toHaveBeenCalled();
  });

  it("runs analysis on standalone push commits", async () => {
    mockFindMergedPR.mockImplementation(() =>
      Promise.resolve(null as number | null),
    );
    const payload = createMockPushPayload();
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig, mockAliaClient);

    expect(mockRunClaudeAnalysis).toHaveBeenCalledTimes(1);
    expect(mockSendInsights).toHaveBeenCalledTimes(1);
  });

  it("skips non-main branch pushes", async () => {
    const payload = createMockPushPayload({
      ref: "refs/heads/feature-branch",
    });
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig, mockAliaClient);

    expect(mockFindMergedPR).not.toHaveBeenCalled();
    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
    expect(mockRunClaudeAnalysis).not.toHaveBeenCalled();
  });
});
