import type { Octokit } from "@octokit/rest";
import type {
  PullRequestData,
  IssueData,
  CommentData,
  FileChange,
  CommitInfo,
} from "./types";
import { log } from "../utils/logger";

export async function fetchPullRequestData(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequestData> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body,
    author: data.user?.login ?? "unknown",
    baseBranch: data.base.ref,
    headBranch: data.head.ref,
    state: data.state as "open" | "closed",
    merged: data.merged,
    mergedAt: data.merged_at,
    labels: data.labels.map((l) => l.name ?? ""),
    url: data.html_url,
  };
}

export async function fetchIssueData(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueData> {
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    author: data.user?.login ?? "unknown",
    labels: data.labels.map((l) =>
      typeof l === "string" ? l : (l.name ?? ""),
    ),
    url: data.html_url,
    isPullRequest: !!data.pull_request,
  };
}

export async function fetchComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prOrIssueNumber: number,
  isPullRequest: boolean,
): Promise<CommentData[]> {
  const comments: CommentData[] = [];

  // Always fetch issue comments (conversation comments on both PRs and issues)
  const { data: issueComments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prOrIssueNumber,
    per_page: 100,
  });

  for (const c of issueComments) {
    comments.push({
      id: c.id,
      body: c.body ?? "",
      author: c.user?.login ?? "unknown",
      createdAt: c.created_at,
      type: "issue_comment",
    });
  }

  if (isPullRequest) {
    // Fetch inline code review comments
    const { data: reviewComments } =
      await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prOrIssueNumber,
        per_page: 100,
      });

    for (const c of reviewComments) {
      comments.push({
        id: c.id,
        body: c.body,
        author: c.user?.login ?? "unknown",
        createdAt: c.created_at,
        type: "review_comment",
      });
    }

    // Fetch review bodies (approve/request changes/comment)
    const { data: reviews } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prOrIssueNumber,
      per_page: 100,
    });

    for (const r of reviews) {
      // Only include reviews with non-empty body
      if (r.body) {
        comments.push({
          id: r.id,
          body: r.body,
          author: r.user?.login ?? "unknown",
          createdAt: r.submitted_at ?? "",
          type: "review",
        });
      }
    }
  }

  // Do NOT filter out bot comments -- locked decision: AI sees the full conversation
  return comments;
}

export async function fetchFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<FileChange[]> {
  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return data.map((f) => ({
    filename: f.filename,
    status: f.status as FileChange["status"],
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}

export async function fetchCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<CommitInfo[]> {
  const { data } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name ?? c.author?.login ?? "unknown",
    date: c.commit.author?.date ?? "",
  }));
}

export async function fetchUserIdMap(
  octokit: Octokit,
  usernames: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const results = await Promise.allSettled(
    usernames.map((username) =>
      octokit.rest.users.getByUsername({ username }),
    ),
  );

  for (let i = 0; i < usernames.length; i++) {
    const result = results[i]!;
    if (result.status === "fulfilled") {
      map.set(usernames[i]!, result.value.data.id);
    } else {
      log.warn(
        `Failed to fetch user ID for "${usernames[i]}": ${result.reason}`,
      );
    }
  }

  return map;
}

export async function findMergedPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  commitSha: string,
): Promise<number | null> {
  const { data: pulls } =
    await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: commitSha,
    });

  const mergedPR = pulls.find((pr) => pr.merged_at !== null);
  if (mergedPR) {
    log.info(`Push traces to merged PR #${mergedPR.number}: ${mergedPR.title}`);
    return mergedPR.number;
  }

  log.warn(`No merged PR found for commit ${commitSha}`);
  return null;
}
