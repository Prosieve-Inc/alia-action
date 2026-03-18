import type {
  IssueCommentEvent,
  PullRequestEvent,
  PushEvent,
} from "@octokit/webhooks-types";

export function createMockIssueCommentPayload(
  overrides: Record<string, unknown> = {},
): IssueCommentEvent {
  const base = {
    action: "created" as const,
    issue: {
      number: 42,
      title: "Test PR",
      body: "Test body",
      pull_request: {
        url: "https://api.github.com/repos/Prosieve-Inc/test-repo/pulls/42",
      },
      user: { login: "testuser", id: 12345 },
      labels: [],
      state: "open",
      ...(overrides.issue as Record<string, unknown>),
    },
    comment: {
      id: 1,
      body: "Test comment",
      user: { login: "commenter", id: 67890 },
      created_at: "2026-01-01T00:00:00Z",
      ...(overrides.comment as Record<string, unknown>),
    },
    repository: {
      name: "test-repo",
      full_name: "Prosieve-Inc/test-repo",
      owner: { login: "Prosieve-Inc" },
      ...(overrides.repository as Record<string, unknown>),
    },
    sender: { login: "commenter", id: 67890 },
    ...overrides,
  };
  return base as unknown as IssueCommentEvent;
}

export function createMockPullRequestPayload(
  overrides: Record<string, unknown> = {},
): PullRequestEvent {
  const base = {
    action: "closed" as const,
    number: 42,
    pull_request: {
      number: 42,
      title: "Test PR",
      body: "Test PR body",
      merged: true,
      merged_at: "2026-01-01T00:00:00Z",
      user: { login: "testuser", id: 12345 },
      head: { ref: "feature-branch" },
      base: { ref: "main" },
      labels: [],
      html_url: "https://github.com/Prosieve-Inc/test-repo/pull/42",
      ...(overrides.pull_request as Record<string, unknown>),
    },
    repository: {
      name: "test-repo",
      full_name: "Prosieve-Inc/test-repo",
      owner: { login: "Prosieve-Inc" },
      ...(overrides.repository as Record<string, unknown>),
    },
    sender: { login: "testuser", id: 12345 },
    ...overrides,
  };
  return base as unknown as PullRequestEvent;
}

export function createMockPushPayload(
  overrides: Record<string, unknown> = {},
): PushEvent {
  const base = {
    ref: "refs/heads/main",
    after: "abc123def456",
    before: "000000000000",
    created: false,
    deleted: false,
    forced: false,
    compare:
      "https://github.com/Prosieve-Inc/test-repo/compare/000000...abc123",
    head_commit: {
      id: "abc123def456",
      message: "Merge pull request #42",
      author: {
        name: "testuser",
        email: "test@example.com",
        username: "testuser",
      },
      timestamp: "2026-01-01T00:00:00Z",
    },
    commits: [
      {
        id: "abc123def456",
        message: "Merge pull request #42",
        author: {
          name: "testuser",
          email: "test@example.com",
          username: "testuser",
        },
        timestamp: "2026-01-01T00:00:00Z",
      },
    ],
    repository: {
      name: "test-repo",
      full_name: "Prosieve-Inc/test-repo",
      owner: { login: "Prosieve-Inc" },
      ...(overrides.repository as Record<string, unknown>),
    },
    sender: { login: "testuser", id: 12345 },
    ...overrides,
  };
  return base as unknown as PushEvent;
}
