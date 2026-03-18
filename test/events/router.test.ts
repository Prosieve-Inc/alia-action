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

// Mock event handlers
const mockHandleIssueComment = mock(() => Promise.resolve());
const mockHandlePullRequestClosed = mock(() => Promise.resolve());
const mockHandlePush = mock(() => Promise.resolve());

mock.module("../../src/events/issue-comment", () => ({
  handleIssueComment: mockHandleIssueComment,
}));
mock.module("../../src/events/pull-request-closed", () => ({
  handlePullRequestClosed: mockHandlePullRequestClosed,
}));
mock.module("../../src/events/push", () => ({
  handlePush: mockHandlePush,
}));

import { routeEvent } from "../../src/events/router";

const mockConfig: ActionConfig = {
  backendUrl: "https://api.example.com",
  authRoute: "/auth",
  insightsRoute: "/insights",
  aliaKey: "test-key",
  githubToken: "ghp_test",
};

describe("event router", () => {
  beforeEach(() => {
    mockHandleIssueComment.mockClear();
    mockHandlePullRequestClosed.mockClear();
    mockHandlePush.mockClear();
    mockCoreInfo.mockClear();
    mockCoreWarning.mockClear();
  });

  it("dispatches issue_comment to handleIssueComment", async () => {
    mockEventName = "issue_comment";
    mockPayload = { action: "created", issue: { number: 42 } };

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig);

    expect(mockHandleIssueComment).toHaveBeenCalledTimes(1);
    expect(mockHandlePullRequestClosed).not.toHaveBeenCalled();
    expect(mockHandlePush).not.toHaveBeenCalled();
  });

  it("dispatches pull_request closed to handlePullRequestClosed", async () => {
    mockEventName = "pull_request";
    mockPayload = { action: "closed", pull_request: { number: 42 } };

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig);

    expect(mockHandlePullRequestClosed).toHaveBeenCalledTimes(1);
    expect(mockHandleIssueComment).not.toHaveBeenCalled();
    expect(mockHandlePush).not.toHaveBeenCalled();
  });

  it("dispatches push to handlePush", async () => {
    mockEventName = "push";
    mockPayload = { ref: "refs/heads/main", after: "abc123" };

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig);

    expect(mockHandlePush).toHaveBeenCalledTimes(1);
    expect(mockHandleIssueComment).not.toHaveBeenCalled();
    expect(mockHandlePullRequestClosed).not.toHaveBeenCalled();
  });

  it("ignores pull_request events that are not closed", async () => {
    mockEventName = "pull_request";
    mockPayload = { action: "opened", pull_request: { number: 42 } };

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig);

    expect(mockHandlePullRequestClosed).not.toHaveBeenCalled();
    expect(mockHandleIssueComment).not.toHaveBeenCalled();
    expect(mockHandlePush).not.toHaveBeenCalled();
  });

  it("logs warning for unsupported events", async () => {
    mockEventName = "fork";
    mockPayload = {};

    const mockOctokit = {} as never;
    await routeEvent(mockOctokit, mockConfig);

    expect(mockCoreWarning).toHaveBeenCalled();
    expect(mockHandleIssueComment).not.toHaveBeenCalled();
    expect(mockHandlePullRequestClosed).not.toHaveBeenCalled();
    expect(mockHandlePush).not.toHaveBeenCalled();
  });
});
