import { describe, expect, it } from "bun:test";
import { formatEventContext } from "../../src/github/data-formatter";
import type { EventContext } from "../../src/github/types";

describe("data-formatter", () => {
  describe("formatEventContext", () => {
    it("includes PR number, title, author, and merged status for PR events", () => {
      const context: EventContext = {
        eventName: "pull_request",
        owner: "Prosieve-Inc",
        repo: "test-repo",
        pullRequest: {
          number: 42,
          title: "Add feature X",
          body: "This adds feature X",
          author: "testauthor",
          baseBranch: "main",
          headBranch: "feature-x",
          state: "closed",
          merged: true,
          mergedAt: "2026-01-15T10:00:00Z",
          labels: ["enhancement"],
          url: "https://github.com/Prosieve-Inc/test-repo/pull/42",
        },
        comments: [
          {
            id: 1,
            body: "LGTM",
            author: "reviewer",
            createdAt: "2026-01-14T10:00:00Z",
            type: "issue_comment",
          },
        ],
        files: [
          {
            filename: "src/index.ts",
            status: "modified",
            additions: 10,
            deletions: 2,
          },
          {
            filename: "src/utils.ts",
            status: "added",
            additions: 25,
            deletions: 0,
          },
        ],
        commits: [
          {
            sha: "abc123",
            message: "feat: add feature",
            author: "testauthor",
            date: "2026-01-14T09:00:00Z",
          },
        ],
      };

      const result = formatEventContext(context);

      expect(result).toContain("#42");
      expect(result).toContain("Add feature X");
      expect(result).toContain("testauthor");
      expect(result).toContain("merged");
      expect(result).toContain("main");
      expect(result).toContain("feature-x");
    });

    it("includes file count and commit count", () => {
      const context: EventContext = {
        eventName: "pull_request",
        owner: "Prosieve-Inc",
        repo: "test-repo",
        pullRequest: {
          number: 42,
          title: "Add feature X",
          body: null,
          author: "testauthor",
          baseBranch: "main",
          headBranch: "feature-x",
          state: "open",
          merged: false,
          mergedAt: null,
          labels: [],
          url: "https://github.com/Prosieve-Inc/test-repo/pull/42",
        },
        comments: [],
        files: [
          {
            filename: "src/a.ts",
            status: "modified",
            additions: 1,
            deletions: 1,
          },
          {
            filename: "src/b.ts",
            status: "added",
            additions: 10,
            deletions: 0,
          },
          {
            filename: "src/c.ts",
            status: "removed",
            additions: 0,
            deletions: 5,
          },
        ],
        commits: [
          {
            sha: "abc",
            message: "commit 1",
            author: "a",
            date: "2026-01-01T00:00:00Z",
          },
          {
            sha: "def",
            message: "commit 2",
            author: "b",
            date: "2026-01-02T00:00:00Z",
          },
        ],
      };

      const result = formatEventContext(context);

      expect(result).toContain("3"); // file count
      expect(result).toContain("2"); // commit count
    });

    it("includes issue number and title for issue events", () => {
      const context: EventContext = {
        eventName: "issue_comment",
        owner: "Prosieve-Inc",
        repo: "test-repo",
        issue: {
          number: 10,
          title: "Bug report",
          body: "Something broken",
          author: "reporter",
          labels: ["bug"],
          url: "https://github.com/Prosieve-Inc/test-repo/issues/10",
          isPullRequest: false,
        },
        comments: [
          {
            id: 1,
            body: "Investigating",
            author: "dev",
            createdAt: "2026-01-01T00:00:00Z",
            type: "issue_comment",
          },
        ],
        files: [],
        commits: [],
      };

      const result = formatEventContext(context);

      expect(result).toContain("#10");
      expect(result).toContain("Bug report");
      expect(result).toContain("reporter");
    });

    it("truncates file list when more than 20 files", () => {
      const files = Array.from({ length: 25 }, (_, i) => ({
        filename: `src/file-${i}.ts`,
        status: "modified" as const,
        additions: 1,
        deletions: 1,
      }));

      const context: EventContext = {
        eventName: "pull_request",
        owner: "owner",
        repo: "repo",
        pullRequest: {
          number: 1,
          title: "Big PR",
          body: null,
          author: "dev",
          baseBranch: "main",
          headBranch: "big-change",
          state: "open",
          merged: false,
          mergedAt: null,
          labels: [],
          url: "https://github.com/owner/repo/pull/1",
        },
        comments: [],
        files,
        commits: [],
      };

      const result = formatEventContext(context);

      expect(result).toContain("and 5 more");
    });
  });
});
