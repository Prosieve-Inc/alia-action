import type { PullRequestEvent } from "@octokit/webhooks-types";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";
import type { EventContext } from "../github/types";
import {
  fetchPullRequestData,
  fetchComments,
  fetchFiles,
  fetchCommits,
} from "../github/data-fetcher";
import { formatEventContext } from "../github/data-formatter";
import { log } from "../utils/logger";

export async function handlePullRequestClosed(
  payload: PullRequestEvent,
  octokit: Octokit,
  _config: ActionConfig,
): Promise<void> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const prNumber = payload.pull_request.number;

  log.info(
    `Processing pull_request closed event for #${prNumber} (merged: ${payload.pull_request.merged})`,
  );

  const [pullRequest, files, commits, comments] = await Promise.all([
    fetchPullRequestData(octokit, owner, repo, prNumber),
    fetchFiles(octokit, owner, repo, prNumber),
    fetchCommits(octokit, owner, repo, prNumber),
    fetchComments(octokit, owner, repo, prNumber, true),
  ]);

  const context: EventContext = {
    eventName: "pull_request",
    owner,
    repo,
    pullRequest,
    comments,
    files,
    commits,
  };

  log.info(formatEventContext(context));
  log.info(`pull_request handler complete (merged: ${pullRequest.merged})`);
}
