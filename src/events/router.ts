import * as github from "@actions/github";
import type { PullRequestEvent, PushEvent } from "@octokit/webhooks-types";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";
import type { AliaClient } from "../services/alia-client";
import { handlePullRequestOpened } from "./pull-request-opened";
import { handlePullRequestClosed } from "./pull-request-closed";
import { handlePush } from "./push";
import { handleWorkflowDispatch } from "./workflow-dispatch";
import { log } from "../utils/logger";

export async function routeEvent(
  octokit: Octokit,
  config: ActionConfig,
  aliaClient: AliaClient,
): Promise<void> {
  const { eventName, payload } = github.context;

  switch (eventName) {
    case "pull_request": {
      const action = (payload as PullRequestEvent).action;
      if (action === "closed") {
        await handlePullRequestClosed(
          payload as PullRequestEvent,
          octokit,
          config,
          aliaClient,
        );
      } else if (
        ["opened", "reopened", "synchronize"].includes(action)
      ) {
        await handlePullRequestOpened(
          payload as PullRequestEvent,
          octokit,
          config,
          aliaClient,
        );
      } else {
        log.info(`Ignoring pull_request action: ${action}`);
      }
      break;
    }
    case "push":
      await handlePush(payload as PushEvent, octokit, config, aliaClient);
      break;
    case "workflow_dispatch":
      await handleWorkflowDispatch(config, aliaClient);
      break;
    default:
      log.warn(`Unsupported event: ${eventName}`);
  }
}
