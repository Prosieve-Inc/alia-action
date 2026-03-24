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

import { handlePullRequestClosed } from "../../src/events/pull-request-closed";
import { createMockPullRequestPayload } from "../mock-context";

const mockConfig: ActionConfig = {
  githubToken: "ghp_test",
};

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
    lastFormatArg = null;
  });

  it("fetches PR data, files, commits, and comments", async () => {
    const payload = createMockPullRequestPayload();
    const mockOctokit = {} as never;

    await handlePullRequestClosed(payload, mockOctokit, mockConfig);

    expect(mockFetchPullRequestData).toHaveBeenCalledTimes(1);
    expect(mockFetchFiles).toHaveBeenCalledTimes(1);
    expect(mockFetchCommits).toHaveBeenCalledTimes(1);
    expect(mockFetchComments).toHaveBeenCalledTimes(1);
  });

  it("includes merged status in EventContext", async () => {
    const payload = createMockPullRequestPayload();
    const mockOctokit = {} as never;

    await handlePullRequestClosed(payload, mockOctokit, mockConfig);

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

    await handlePullRequestClosed(payload, mockOctokit, mockConfig);

    const contextArg = lastFormatArg as {
      pullRequest?: { merged: boolean };
    };
    expect(contextArg.pullRequest?.merged).toBe(false);
  });
});
