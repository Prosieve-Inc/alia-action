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

const mockAuth = mock(() =>
  Promise.resolve({ authorized: true, encryptedCredentials: "mock-creds" }),
);
const mockAnalysis = mock(() => Promise.resolve("Mock analysis result"));
const mockSubmission = mock(() => Promise.resolve());

mock.module("../../src/mocks/auth", () => ({
  mockAuth,
}));
mock.module("../../src/mocks/analysis", () => ({
  mockAnalysis,
}));
mock.module("../../src/mocks/submission", () => ({
  mockSubmission,
}));

import { handlePush } from "../../src/events/push";
import { createMockPushPayload } from "../mock-context";
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

describe("push handler", () => {
  beforeEach(() => {
    mockFindMergedPR.mockClear();
    mockFetchPullRequestData.mockClear();
    mockFetchComments.mockClear();
    mockFetchFiles.mockClear();
    mockFetchCommits.mockClear();
    mockAuth.mockClear();
    mockAnalysis.mockClear();
    mockSubmission.mockClear();
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

    await handlePush(payload, mockOctokit, mockConfig, mockCredentials);

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

    await handlePush(payload, mockOctokit, mockConfig, mockCredentials);

    expect(mockFetchPullRequestData).toHaveBeenCalledTimes(1);
    expect(mockFetchFiles).toHaveBeenCalledTimes(1);
    expect(mockFetchCommits).toHaveBeenCalledTimes(1);
    expect(mockFetchComments).toHaveBeenCalledTimes(1);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockAnalysis).toHaveBeenCalledTimes(1);
    expect(mockSubmission).toHaveBeenCalledTimes(1);
  });

  it("logs warning and exits cleanly when no merged PR found", async () => {
    mockFindMergedPR.mockImplementation(() =>
      Promise.resolve(null as number | null),
    );
    const payload = createMockPushPayload();
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig, mockCredentials);

    // Should NOT fetch PR data or run pipeline
    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockAnalysis).not.toHaveBeenCalled();
    expect(mockSubmission).not.toHaveBeenCalled();
  });

  it("skips non-main branch pushes", async () => {
    const payload = createMockPushPayload({
      ref: "refs/heads/feature-branch",
    });
    const mockOctokit = {} as never;

    await handlePush(payload, mockOctokit, mockConfig, mockCredentials);

    expect(mockFindMergedPR).not.toHaveBeenCalled();
    expect(mockFetchPullRequestData).not.toHaveBeenCalled();
  });
});
