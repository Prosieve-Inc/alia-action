import type { Octokit } from "@octokit/rest";
import type {
  PullRequestData,
  IssueData,
  CommentData,
  FileChange,
  CommitInfo,
} from "./types";

export async function fetchPullRequestData(
  _octokit: Octokit,
  _owner: string,
  _repo: string,
  _pullNumber: number,
): Promise<PullRequestData> {
  throw new Error("Not implemented");
}

export async function fetchIssueData(
  _octokit: Octokit,
  _owner: string,
  _repo: string,
  _issueNumber: number,
): Promise<IssueData> {
  throw new Error("Not implemented");
}

export async function fetchComments(
  _octokit: Octokit,
  _owner: string,
  _repo: string,
  _prOrIssueNumber: number,
  _isPullRequest: boolean,
): Promise<CommentData[]> {
  throw new Error("Not implemented");
}

export async function fetchFiles(
  _octokit: Octokit,
  _owner: string,
  _repo: string,
  _pullNumber: number,
): Promise<FileChange[]> {
  throw new Error("Not implemented");
}

export async function fetchCommits(
  _octokit: Octokit,
  _owner: string,
  _repo: string,
  _pullNumber: number,
): Promise<CommitInfo[]> {
  throw new Error("Not implemented");
}

export async function findMergedPR(
  _octokit: Octokit,
  _owner: string,
  _repo: string,
  _commitSha: string,
): Promise<number | null> {
  throw new Error("Not implemented");
}
