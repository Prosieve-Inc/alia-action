import type { EventContext } from "./types";

const MAX_FILES_DISPLAYED = 20;

export function formatEventContext(context: EventContext): string {
  const lines: string[] = [];

  lines.push(`Event: ${context.eventName}`);
  lines.push(`Repository: ${context.owner}/${context.repo}`);

  if (context.pullRequest) {
    const pr = context.pullRequest;
    lines.push(`PR #${pr.number}: ${pr.title}`);
    lines.push(`Author: ${pr.author}`);
    lines.push(`Status: ${pr.merged ? "merged" : pr.state}`);
    lines.push(`Branches: ${pr.headBranch} -> ${pr.baseBranch}`);
    if (pr.labels.length > 0) {
      lines.push(`Labels: ${pr.labels.join(", ")}`);
    }
    lines.push(`Files changed: ${context.files.length}`);
    lines.push(`Commits: ${context.commits.length}`);
  } else if (context.issue) {
    const issue = context.issue;
    lines.push(`Issue #${issue.number}: ${issue.title}`);
    lines.push(`Author: ${issue.author}`);
    if (issue.labels.length > 0) {
      lines.push(`Labels: ${issue.labels.join(", ")}`);
    }
  }

  lines.push(`Comments: ${context.comments.length}`);

  if (context.files.length > 0) {
    lines.push("");
    lines.push("Changed files:");
    const displayFiles = context.files.slice(0, MAX_FILES_DISPLAYED);
    for (const file of displayFiles) {
      lines.push(`  ${file.status} ${file.filename}`);
    }
    if (context.files.length > MAX_FILES_DISPLAYED) {
      const remaining = context.files.length - MAX_FILES_DISPLAYED;
      lines.push(`  ...and ${remaining} more`);
    }
  }

  return lines.join("\n");
}
