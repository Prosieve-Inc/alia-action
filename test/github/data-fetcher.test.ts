import { describe, expect, it, mock } from "bun:test";
import {
  fetchPullRequestData,
  fetchIssueData,
  fetchComments,
  fetchFiles,
  fetchCommits,
  findMergedPR,
} from "../../src/github/data-fetcher";

// Mock @actions/core to suppress logging in tests
mock.module("@actions/core", () => ({
  info: mock(() => {}),
  warning: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
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

function createMockOctokit(overrides: Record<string, unknown> = {}) {
  return {
    rest: {
      pulls: {
        get: mock(() =>
          Promise.resolve({
            data: {
              number: 42,
              title: "Add feature X",
              body: "This adds feature X",
              user: { login: "testauthor" },
              base: { ref: "main" },
              head: { ref: "feature-x" },
              merged: true,
              merged_at: "2026-01-15T10:00:00Z",
              labels: [{ name: "enhancement" }, { name: "reviewed" }],
              html_url: "https://github.com/owner/repo/pull/42",
            },
          }),
        ),
        listFiles: mock(() =>
          Promise.resolve({
            data: [
              {
                filename: "src/index.ts",
                status: "modified",
                additions: 10,
                deletions: 2,
                patch: "@@ -1,5 +1,13 @@",
              },
              {
                filename: "src/utils.ts",
                status: "added",
                additions: 25,
                deletions: 0,
                patch: "@@ -0,0 +1,25 @@",
              },
            ],
          }),
        ),
        listCommits: mock(() =>
          Promise.resolve({
            data: [
              {
                sha: "abc123",
                commit: {
                  message: "feat: add feature X",
                  author: { name: "Test User", date: "2026-01-14T09:00:00Z" },
                },
                author: { login: "testauthor" },
              },
              {
                sha: "def456",
                commit: {
                  message: "fix: address review comments",
                  author: { name: "Test User", date: "2026-01-15T08:00:00Z" },
                },
                author: { login: "testauthor" },
              },
            ],
          }),
        ),
        listReviewComments: mock(() =>
          Promise.resolve({
            data: [
              {
                id: 201,
                body: "Consider using a constant here",
                user: { login: "reviewer1" },
                created_at: "2026-01-14T12:00:00Z",
              },
            ],
          }),
        ),
        listReviews: mock(() =>
          Promise.resolve({
            data: [
              {
                id: 301,
                body: "Looks good overall",
                user: { login: "reviewer1" },
                submitted_at: "2026-01-14T14:00:00Z",
              },
              {
                id: 302,
                body: "",
                user: { login: "reviewer2" },
                submitted_at: "2026-01-14T15:00:00Z",
              },
            ],
          }),
        ),
      },
      issues: {
        get: mock(() =>
          Promise.resolve({
            data: {
              number: 10,
              title: "Bug report",
              body: "Something is broken",
              user: { login: "reporter" },
              labels: [{ name: "bug" }],
              html_url: "https://github.com/owner/repo/issues/10",
              pull_request: undefined,
            },
          }),
        ),
        listComments: mock(() =>
          Promise.resolve({
            data: [
              {
                id: 101,
                body: "I can reproduce this",
                user: { login: "helper" },
                created_at: "2026-01-14T10:00:00Z",
              },
              {
                id: 102,
                body: "Automated check passed",
                user: { login: "bot[bot]" },
                created_at: "2026-01-14T11:00:00Z",
              },
            ],
          }),
        ),
      },
      repos: {
        listPullRequestsAssociatedWithCommit: mock(() =>
          Promise.resolve({
            data: [
              {
                number: 42,
                title: "Add feature X",
                merged_at: "2026-01-15T10:00:00Z",
              },
              { number: 40, title: "Old PR", merged_at: null },
            ],
          }),
        ),
      },
      ...overrides,
    },
  } as unknown;
}

describe("data-fetcher", () => {
  describe("fetchPullRequestData", () => {
    it("returns PullRequestData with correct fields from Octokit pulls.get", async () => {
      const octokit = createMockOctokit();
      const result = await fetchPullRequestData(
        octokit as never,
        "owner",
        "repo",
        42,
      );

      expect(result.number).toBe(42);
      expect(result.title).toBe("Add feature X");
      expect(result.body).toBe("This adds feature X");
      expect(result.author).toBe("testauthor");
      expect(result.baseBranch).toBe("main");
      expect(result.headBranch).toBe("feature-x");
      expect(result.merged).toBe(true);
      expect(result.mergedAt).toBe("2026-01-15T10:00:00Z");
      expect(result.labels).toEqual(["enhancement", "reviewed"]);
      expect(result.url).toBe("https://github.com/owner/repo/pull/42");
    });
  });

  describe("fetchIssueData", () => {
    it("returns IssueData with isPullRequest=false when issue has no pull_request field", async () => {
      const octokit = createMockOctokit();
      const result = await fetchIssueData(
        octokit as never,
        "owner",
        "repo",
        10,
      );

      expect(result.number).toBe(10);
      expect(result.title).toBe("Bug report");
      expect(result.body).toBe("Something is broken");
      expect(result.author).toBe("reporter");
      expect(result.labels).toEqual(["bug"]);
      expect(result.url).toBe("https://github.com/owner/repo/issues/10");
      expect(result.isPullRequest).toBe(false);
    });

    it("returns IssueData with isPullRequest=true when issue has pull_request field", async () => {
      const octokit = createMockOctokit({
        issues: {
          get: mock(() =>
            Promise.resolve({
              data: {
                number: 42,
                title: "PR as issue",
                body: "PR body",
                user: { login: "author" },
                labels: [],
                html_url: "https://github.com/owner/repo/issues/42",
                pull_request: {
                  url: "https://api.github.com/repos/owner/repo/pulls/42",
                },
              },
            }),
          ),
          listComments: mock(() => Promise.resolve({ data: [] })),
        },
      });
      const result = await fetchIssueData(
        octokit as never,
        "owner",
        "repo",
        42,
      );

      expect(result.isPullRequest).toBe(true);
    });
  });

  describe("fetchComments", () => {
    it("returns combined issue comments, review comments, and reviews for PRs", async () => {
      const octokit = createMockOctokit();
      const result = await fetchComments(
        octokit as never,
        "owner",
        "repo",
        42,
        true,
      );

      // 2 issue comments + 1 review comment + 1 review (empty body review excluded)
      expect(result.length).toBe(4);

      const issueComments = result.filter((c) => c.type === "issue_comment");
      expect(issueComments.length).toBe(2);

      const reviewComments = result.filter((c) => c.type === "review_comment");
      expect(reviewComments.length).toBe(1);
      expect(reviewComments[0]!.body).toBe("Consider using a constant here");

      const reviews = result.filter((c) => c.type === "review");
      expect(reviews.length).toBe(1);
      expect(reviews[0]!.body).toBe("Looks good overall");
    });

    it("returns ALL comments including bot comments (no filtering)", async () => {
      const octokit = createMockOctokit();
      const result = await fetchComments(
        octokit as never,
        "owner",
        "repo",
        42,
        false,
      );

      // Only issue comments when isPullRequest=false
      expect(result.length).toBe(2);
      const botComment = result.find((c) => c.author === "bot[bot]");
      expect(botComment).toBeDefined();
      expect(botComment!.body).toBe("Automated check passed");
    });

    it("only fetches issue comments when isPullRequest is false", async () => {
      const octokit = createMockOctokit();
      const result = await fetchComments(
        octokit as never,
        "owner",
        "repo",
        10,
        false,
      );

      // Should only have issue comments, no review comments or reviews
      expect(result.every((c) => c.type === "issue_comment")).toBe(true);
    });
  });

  describe("fetchFiles", () => {
    it("returns FileChange[] from Octokit pulls.listFiles response", async () => {
      const octokit = createMockOctokit();
      const result = await fetchFiles(octokit as never, "owner", "repo", 42);

      expect(result.length).toBe(2);
      expect(result[0]!.filename).toBe("src/index.ts");
      expect(result[0]!.status).toBe("modified");
      expect(result[0]!.additions).toBe(10);
      expect(result[0]!.deletions).toBe(2);
      expect(result[0]!.patch).toBe("@@ -1,5 +1,13 @@");

      expect(result[1]!.filename).toBe("src/utils.ts");
      expect(result[1]!.status).toBe("added");
      expect(result[1]!.additions).toBe(25);
      expect(result[1]!.deletions).toBe(0);
    });
  });

  describe("fetchCommits", () => {
    it("returns CommitInfo[] from Octokit pulls.listCommits response", async () => {
      const octokit = createMockOctokit();
      const result = await fetchCommits(octokit as never, "owner", "repo", 42);

      expect(result.length).toBe(2);
      expect(result[0]!.sha).toBe("abc123");
      expect(result[0]!.message).toBe("feat: add feature X");
      expect(result[0]!.author).toBe("Test User");
      expect(result[0]!.date).toBe("2026-01-14T09:00:00Z");

      expect(result[1]!.sha).toBe("def456");
      expect(result[1]!.message).toBe("fix: address review comments");
    });
  });

  describe("findMergedPR", () => {
    it("returns PR number when a merged PR is associated with the commit SHA", async () => {
      const octokit = createMockOctokit();
      const result = await findMergedPR(
        octokit as never,
        "owner",
        "repo",
        "abc123",
      );

      expect(result).toBe(42);
    });

    it("returns null when no merged PR found for the commit", async () => {
      const octokit = createMockOctokit({
        repos: {
          listPullRequestsAssociatedWithCommit: mock(() =>
            Promise.resolve({
              data: [{ number: 40, title: "Open PR", merged_at: null }],
            }),
          ),
        },
      });
      const result = await findMergedPR(
        octokit as never,
        "owner",
        "repo",
        "xyz789",
      );

      expect(result).toBeNull();
    });
  });
});
