import * as core from "@actions/core";
import * as github from "@actions/github";
import type {
  IssueCommentEvent,
  PullRequestEvent,
  PushEvent,
} from "@octokit/webhooks-types";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";
import { handleIssueComment } from "./issue-comment";
import { handlePullRequestClosed } from "./pull-request-closed";
import { handlePush } from "./push";

export async function routeEvent(
  octokit: Octokit,
  config: ActionConfig,
): Promise<void> {
  const { eventName, payload } = github.context;

  switch (eventName) {
    case "issue_comment":
      await handleIssueComment(payload as IssueCommentEvent, octokit, config);
      break;
    case "pull_request":
      if ((payload as PullRequestEvent).action === "closed") {
        await handlePullRequestClosed(
          payload as PullRequestEvent,
          octokit,
          config,
        );
      } else {
        core.info(
          `Ignoring pull_request action: ${(payload as PullRequestEvent).action}`,
        );
      }
      break;
    case "push":
      await handlePush(payload as PushEvent, octokit, config);
      break;
    default:
      core.warning(`Unsupported event: ${eventName}`);
  }
}
