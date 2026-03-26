import type {
  SDKResultSuccess,
  SDKResultError,
} from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { mkdtemp, readdir, rm, cp, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { EventContext } from "../github/types";
import { formatEventContext } from "../github/data-formatter";
import type { AliaClient } from "../services/alia-client";
import { log } from "../utils/logger";

// ── Types ──────────────────────────────────────────────────────────────

export type SkillType = "pr" | "push" | "dispatch";

export interface AnalysisResult {
  summaries: string[];
  cost: number;
  durationMs: number;
}

export interface InsightMetadata {
  event: string;
  owner: string;
  repo: string;
  [key: string]: unknown;
}

// ── Constants ──────────────────────────────────────────────────────────

/** Read-only tools auto-approved without permission prompts. */
const ALLOWED_TOOLS: string[] = [
  "Glob",
  "Grep",
  "LS",
  "Read",
  "Bash(git log:*)",
  "Bash(git diff:*)",
  "Bash(git status:*)",
  "Bash(git show:*)",
  "Bash(git blame:*)",
  "Bash(git branch:*)",
  "Bash(rtk:*)",
  "Skill",
  "Agent",
];

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    summaries: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["summaries"],
};

// ── Core Analysis ──────────────────────────────────────────────────────

export async function runClaudeAnalysis(
  skillType: SkillType,
  eventContext: EventContext,
  aliaClient: AliaClient,
): Promise<AnalysisResult> {
  const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "ANTHROPIC_VERTEX_PROJECT_ID is not set. Ensure google-github-actions/auth runs before this action.",
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "alia-skill-"));
  const installedPaths: string[] = [];

  try {
    // 1. Fetch and extract skill .zip
    const zipBuffer = await aliaClient.fetchSkillZip(skillType);
    await extractZip(zipBuffer, tempDir);

    // 2. Read PROMPT.md
    const promptPath = path.join(tempDir, "PROMPT.md");
    const systemPrompt = await readFile(promptPath, "utf-8");

    // 3. Install filesystem artifacts (skills + agents)
    const paths = await installFilesystemArtifacts(tempDir, cwd);
    installedPaths.push(...paths);

    // 4. Build prompt from event context
    const contextStr = formatEventContext(eventContext);
    const prompt = `Here is the event context:\n\n${contextStr}\n\nAnalyze and produce insights as JSON.`;

    log.info(`Running Claude analysis (type=${skillType})...`);

    // 5. Run SDK query
    let resultMessage: SDKResultSuccess | SDKResultError | undefined;

    for await (const message of query({
      prompt,
      options: {
        model: "claude-sonnet-4-6",
        allowedTools: ALLOWED_TOOLS,
        permissionMode: "bypassPermissions" as const,
        allowDangerouslySkipPermissions: true,
        systemPrompt,
        settingSources: ["project"],
        outputFormat: { type: "json_schema", schema: OUTPUT_SCHEMA },
        cwd,
        env: {
          ...(process.env as Record<string, string>),
          CLAUDE_CODE_USE_VERTEX: "1",
          ANTHROPIC_VERTEX_PROJECT_ID: projectId,
          CLOUD_ML_REGION: "global",
        },
      },
    })) {
      log.debug(`SDK message type: ${message.type}`);
      if (message.type === "result") {
        resultMessage = message as SDKResultSuccess | SDKResultError;
      }
    }

    if (!resultMessage) {
      throw new Error("No result message received from Claude SDK.");
    }

    // 6. Process result
    log.info(`Turns: ${resultMessage.num_turns}`);
    log.info(`Duration: ${(resultMessage.duration_ms / 1000).toFixed(1)}s`);
    log.info(`Cost: $${resultMessage.total_cost_usd.toFixed(4)}`);

    if (resultMessage.subtype !== "success") {
      const errorResult = resultMessage as SDKResultError;
      throw new Error(
        `Claude SDK error: ${errorResult.subtype} - ${errorResult.errors.join("; ")}`,
      );
    }

    const summaries = parseSummaries(resultMessage);

    return {
      summaries,
      cost: resultMessage.total_cost_usd,
      durationMs: resultMessage.duration_ms,
    };
  } finally {
    await cleanupArtifacts(installedPaths);
    await rm(tempDir, { recursive: true, force: true });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function extractZip(
  buffer: ArrayBuffer,
  targetDir: string,
): Promise<void> {
  const zipPath = path.join(targetDir, "skill.zip");
  await Bun.write(zipPath, buffer);

  const proc = Bun.spawn(["unzip", "-o", zipPath, "-d", targetDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to extract skill zip: ${stderr}`);
  }

  log.info("Skill files extracted.");
}

async function installFilesystemArtifacts(
  tempDir: string,
  cwd: string,
): Promise<string[]> {
  const installedPaths: string[] = [];

  // Install skills
  const skillsSource = path.join(tempDir, "skills");
  if (existsSync(skillsSource)) {
    const skillsTarget = path.join(cwd, ".claude", "skills");
    await mkdir(skillsTarget, { recursive: true });

    const entries = await readdir(skillsSource, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const src = path.join(skillsSource, entry.name);
      const dst = path.join(skillsTarget, entry.name);
      await cp(src, dst, { recursive: true });
      installedPaths.push(dst);
      log.info(`Installed skill: ${entry.name}`);
    }
  }

  // Install agents
  const agentsSource = path.join(tempDir, "agents");
  if (existsSync(agentsSource)) {
    const agentsTarget = path.join(cwd, ".claude", "agents");
    await mkdir(agentsTarget, { recursive: true });

    const entries = await readdir(agentsSource, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const src = path.join(agentsSource, entry.name);
      const dst = path.join(agentsTarget, entry.name);
      await cp(src, dst, { recursive: true });
      installedPaths.push(dst);
      log.info(`Installed agent: ${entry.name}`);
    }
  }

  return installedPaths;
}

async function cleanupArtifacts(paths: string[]): Promise<void> {
  for (const p of paths) {
    await rm(p, { recursive: true, force: true }).catch(() => {});
  }
}

function parseSummaries(result: SDKResultSuccess): string[] {
  // Prefer structured_output when outputFormat is used
  if (result.structured_output) {
    const output = result.structured_output as { summaries?: string[] };
    if (Array.isArray(output.summaries)) {
      return output.summaries;
    }
  }

  // Fallback: parse result text as JSON
  try {
    const parsed = JSON.parse(result.result) as { summaries?: string[] };
    if (Array.isArray(parsed.summaries)) {
      return parsed.summaries;
    }
  } catch {
    log.warn("Could not parse summaries from result text.");
  }

  return [];
}
