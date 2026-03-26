export interface PullRequestData {
  number: number;
  title: string;
  body: string | null;
  author: string;
  baseBranch: string;
  headBranch: string;
  state: "open" | "closed";
  merged: boolean;
  mergedAt: string | null;
  labels: string[];
  url: string;
}

export interface IssueData {
  number: number;
  title: string;
  body: string | null;
  author: string;
  labels: string[];
  url: string;
  isPullRequest: boolean;
}

export interface CommentData {
  id: number;
  body: string;
  author: string;
  createdAt: string;
  type: "issue_comment" | "review_comment" | "review";
}

export interface FileChange {
  filename: string;
  status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface EventContext {
  eventName: string;
  owner: string;
  repo: string;
  pullRequest?: PullRequestData;
  issue?: IssueData;
  comments: CommentData[];
  files: FileChange[];
  commits: CommitInfo[];
}
