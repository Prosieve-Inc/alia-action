import type { PushEvent } from "@octokit/webhooks-types";
import type { Octokit } from "@octokit/rest";
import type { ActionConfig } from "../config/inputs";
import type { EventContext } from "../github/types";
import {
  fetchPullRequestData,
  fetchComments,
  fetchFiles,
  fetchCommits,
  findMergedPR,
} from "../github/data-fetcher";
import { formatEventContext } from "../github/data-formatter";
import { log } from "../utils/logger";

export async function handlePush(
  payload: PushEvent,
  octokit: Octokit,
  _config: ActionConfig,
): Promise<void> {
  // Only process pushes to main branch
  if (payload.ref !== "refs/heads/main") {
    log.info(`Ignoring push to non-main branch: ${payload.ref}`);
    return;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const commitSha = payload.after;

  log.info(`Processing push to main: ${commitSha}`);

  // Trace push to merged PR
  const prNumber = await findMergedPR(octokit, owner, repo, commitSha);
  if (prNumber === null) {
    log.warn(
      `No merged PR found for push commit ${commitSha}. Skipping analysis.`,
    );
    return;
  }

  // Fetch full PR data like pull-request-closed handler
  const [pullRequest, files, commits, comments] = await Promise.all([
    fetchPullRequestData(octokit, owner, repo, prNumber),
    fetchFiles(octokit, owner, repo, prNumber),
    fetchCommits(octokit, owner, repo, prNumber),
    fetchComments(octokit, owner, repo, prNumber, true),
  ]);

  const context: EventContext = {
    eventName: "push",
    owner,
    repo,
    pullRequest,
    comments,
    files,
    commits,
  };

  log.info(formatEventContext(context));
  log.info(`push handler complete (PR #${prNumber})`);
}
