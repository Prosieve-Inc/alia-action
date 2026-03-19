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

// Mock @actions/github context
let mockEventName = "issue_comment";
let mockPayload: Record<string, unknown> = {};
mock.module("@actions/github", () => ({
  context: {
    get eventName() {
      return mockEventName;
    },
    get payload() {
      return mockPayload;
    },
  },
}));

// Mock all dependencies that handlers need so they run without errors
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
const mockFetchIssueData = mock(() =>
  Promise.resolve({
    number: 10,
    title: "Test Issue",
    body: "Issue body",
    author: "reporter",
    labels: [],
    url: "https://github.com/owner/repo/issues/10",
    isPullRequest: false,
  }),
);
const mockFetchComments = mock(() => Promise.resolve([]));
const mockFetchFiles = mock(() => Promise.resolve([]));
const mockFetchCommits = mock(() => Promise.resolve([]));
const mockFindMergedPR = mock(() => Promise.resolve(42 as number | null));

mock.module("../../src/github/data-fetcher", () => ({
  fetchPullRequestData: mockFetchPullRequestData,
  fetchIssueData: mockFetchIssueData,
  fetchComments: mockFetchComments,
  fetchFiles: mockFetchFiles,
  fetchCommits: mockFetchCommits,
  findMergedPR: mockFindMergedPR,
}));

mock.module("../../src/github/data-formatter", () => ({
  formatEventContext: mock(() => "Formatted context"),
}));

const mockAuth = mock(() =>
  Promise.resolve({ authorized: true, encryptedCredentials: "mock-creds" }),
);
const mockAnalysis = mock(() => Promise.resolve("Mock analysis result"));
const mockMockSubmission = mock(() => Promise.resolve());

mock.module("../../src/mocks/auth", () => ({
  mockAuth,
}));
mock.module("../../src/mocks/analysis", () => ({
  mockAnalysis,
}));
mock.module("../../src/mocks/submission", () => ({
  mockSubmission: mockMockSubmission,
}));

import { routeEvent } from "../../src/events/router";
import type { VertexCredentials } from "../../src/auth/types";

const mockConfig: ActionConfig = {
  backendUrl: "https://api.example.com",
  authRoute: "/auth",
  insightsRoute: "/insights",
  aliaKey: "test-key",
  githubToken: "ghp_test",
};

const mockCredentials: VertexCredentials = {
  privateKey: "test-private-key",
  serviceAccountEmail: "test@project.iam.gserviceaccount.com",
  projectId: "test-project",
  region: "us-central1",
};

describe("event router", () => {
  beforeEach(() => {
    mockFetchPullRequestData.mockClear();
    mockFetchIssueData.mockClear();
    mockFetchComments.mockClear();
    mockFetchFiles.mockClear();
    mockFetchCommits.mockClear();
    mockFindMergedPR.mockClear();
    mockAuth.mockClear();
    mockAnalysis.mockClear();
    mockMockSubmission.mockClear();
    mockCoreInfo.mockClear();
    mockCoreWarning.mockClear();
    // Reset findMergedPR to default
    mockFindMergedPR.mockImplementation(() =>
      Promise.resolve(42 as number | null),
    );
  });

  it("dispatches issue_comment to handleIssueComment", async () => {
    mockEventName = "issue_comment";
    mockPayload = {
      action: "created",
      issue: {
        number: 42,
        pull_request: {
          url: "https://api.github.com/repos/owner/repo/pulls/42",
        },
      },
      repository: { name: "test-repo", owner: { login: "owner" } },
    };

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig, mockCredentials);

    // Verify handler ran by checking it called fetchPullRequestData (PR comment path)
    expect(mockFetchPullRequestData).toHaveBeenCalledTimes(1);
  });

  it("dispatches pull_request closed to handlePullRequestClosed", async () => {
    mockEventName = "pull_request";
    mockPayload = {
      action: "closed",
      pull_request: {
        number: 42,
        merged: true,
        merge_commit_sha: "abc123",
      },
      repository: { name: "test-repo", owner: { login: "owner" } },
    };

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig, mockCredentials);

    // Verify handler ran by checking it called fetchPullRequestData
    expect(mockFetchPullRequestData).toHaveBeenCalledTimes(1);
    expect(mockFetchFiles).toHaveBeenCalledTimes(1);
  });

  it("dispatches push to handlePush", async () => {
    mockEventName = "push";
    mockPayload = {
      ref: "refs/heads/main",
      after: "abc123",
      repository: { name: "test-repo", owner: { login: "owner" } },
    };

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig, mockCredentials);

    // Verify push handler ran by checking it called findMergedPR
    expect(mockFindMergedPR).toHaveBeenCalledTimes(1);
  });

  it("ignores pull_request events that are not closed", async () => {
    mockEventName = "pull_request";
    mockPayload = {
      action: "opened",
      pull_request: { number: 42 },
      repository: { name: "test-repo", owner: { login: "owner" } },
    };

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig, mockCredentials);

    // None of the handler functions should have been called
    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
    expect(mockFindMergedPR).not.toHaveBeenCalled();
  });

  it("logs warning for unsupported events", async () => {
    mockEventName = "fork";
    mockPayload = {};

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig, mockCredentials);

    expect(mockCoreWarning).toHaveBeenCalled();
    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
    expect(mockFindMergedPR).not.toHaveBeenCalled();
  });
});
