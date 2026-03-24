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

import { handlePush } from "../../src/events/push";
import { createMockPushPayload } from "../mock-context";

const mockConfig: ActionConfig = {
  githubToken: "ghp_test",
};

describe("push handler", () => {
  beforeEach(() => {
    mockFindMergedPR.mockClear();
    mockFetchPullRequestData.mockClear();
    mockFetchComments.mockClear();
    mockFetchFiles.mockClear();
    mockFetchCommits.mockClear();
    mockFormatEventContext.mockClear();
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

    await handlePush(payload, mockOctokit, mockConfig);

    expect(mockFindMergedPR).toHaveBeenCalledWith(
      mockOctokit,
      "Prosieve-Inc",
      "test-repo",
      "abc123def456",
    );
  });

  it("fetches full PR data when merged PR is found", async () => {
    const payload = createMockPushPayload();
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig);

    expect(mockFetchPullRequestData).toHaveBeenCalledTimes(1);
    expect(mockFetchFiles).toHaveBeenCalledTimes(1);
    expect(mockFetchCommits).toHaveBeenCalledTimes(1);
    expect(mockFetchComments).toHaveBeenCalledTimes(1);
  });

  it("logs warning and exits cleanly when no merged PR found", async () => {
    mockFindMergedPR.mockImplementation(() =>
      Promise.resolve(null as number | null),
    );
    const payload = createMockPushPayload();
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig);

    // Should NOT fetch PR data
    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
  });

  it("skips non-main branch pushes", async () => {
    const payload = createMockPushPayload({
      ref: "refs/heads/feature-branch",
    });
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig);

    expect(mockFindMergedPR).not.toHaveBeenCalled();
    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
  });
});
