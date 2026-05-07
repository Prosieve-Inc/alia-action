import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { ActionConfig } from "../../src/config/inputs";
import type { AliaClient } from "../../src/services/alia-client";

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

// Mock logger
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

// Mock @actions/github context
let mockEventName = "push";
let mockPayload: Record<string, unknown> = {};
mock.module("@actions/github", () => ({
  context: {
    get eventName() {
      return mockEventName;
    },
    get payload() {
      return mockPayload;
    },
    repo: { owner: "owner", repo: "test-repo" },
    ref: "refs/heads/main",
  },
}));

// Mock data-fetcher
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

mock.module("../../src/github/data-formatter", () => ({
  formatEventContext: mock(() => "Formatted context"),
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

import { routeEvent } from "../../src/events/router";

const mockConfig = {
  githubToken: "test-token",
  aliaBackendUrl: "https://backend.example.com",
  aliaSkillStoreRoute: "/api/skills",
  aliaSaveInsightsRoute: "/api/insights",
} as ActionConfig;

const mockSendInsights = mock(() => Promise.resolve());
const mockAliaClient = {
  fetchSkillZip: mock(() => Promise.resolve(new ArrayBuffer(0))),
  sendInsights: mockSendInsights,
} as unknown as AliaClient;

describe("event router", () => {
  beforeEach(() => {
    mockFetchPullRequestData.mockClear();
    mockFetchComments.mockClear();
    mockFetchFiles.mockClear();
    mockFetchCommits.mockClear();
    mockFindMergedPR.mockClear();
    mockRunClaudeAnalysis.mockClear();
    mockSendInsights.mockClear();
    mockCoreInfo.mockClear();
    mockCoreWarning.mockClear();
    mockFindMergedPR.mockImplementation(() =>
      Promise.resolve(42 as number | null),
    );
  });

  it("dispatches pull_request opened to handlePullRequestOpened", async () => {
    mockEventName = "pull_request";
    mockPayload = {
      action: "opened",
      pull_request: { number: 42 },
      repository: { name: "test-repo", owner: { login: "owner" } },
    };

    await routeEvent({} as never, mockConfig, mockAliaClient);

    expect(mockFetchPullRequestData).toHaveBeenCalledTimes(1);
    expect(mockRunClaudeAnalysis).toHaveBeenCalledTimes(1);
  });

  it("dispatches pull_request closed to handlePullRequestClosed", async () => {
    mockEventName = "pull_request";
    mockPayload = {
      action: "closed",
      pull_request: { number: 42, merged: true, merge_commit_sha: "abc123" },
      repository: { name: "test-repo", owner: { login: "owner" } },
    };

    await routeEvent({} as never, mockConfig, mockAliaClient);

    expect(mockFetchPullRequestData).toHaveBeenCalledTimes(1);
    expect(mockFetchFiles).toHaveBeenCalledTimes(1);
    expect(mockRunClaudeAnalysis).toHaveBeenCalledTimes(1);
  });

  it("dispatches push to handlePush", async () => {
    mockEventName = "push";
    mockPayload = {
      ref: "refs/heads/main",
      after: "abc123",
      repository: { name: "test-repo", owner: { login: "owner" } },
    };

    await routeEvent({} as never, mockConfig, mockAliaClient);

    expect(mockFindMergedPR).toHaveBeenCalledTimes(1);
  });

  it("dispatches workflow_dispatch to handleWorkflowDispatch", async () => {
    mockEventName = "workflow_dispatch";
    mockPayload = {};

    await routeEvent({} as never, mockConfig, mockAliaClient);

    expect(mockRunClaudeAnalysis).toHaveBeenCalledTimes(1);
    expect(mockSendInsights).toHaveBeenCalledTimes(1);
  });

  it("ignores unsupported pull_request actions", async () => {
    mockEventName = "pull_request";
    mockPayload = {
      action: "labeled",
      pull_request: { number: 42 },
      repository: { name: "test-repo", owner: { login: "owner" } },
    };

    await routeEvent({} as never, mockConfig, mockAliaClient);

    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
    expect(mockRunClaudeAnalysis).not.toHaveBeenCalled();
  });

  it("does not call any handler for unsupported events", async () => {
    mockEventName = "fork";
    mockPayload = {};

    await routeEvent({} as never, mockConfig, mockAliaClient);

    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
    expect(mockFindMergedPR).not.toHaveBeenCalled();
    expect(mockRunClaudeAnalysis).not.toHaveBeenCalled();
  });
});
