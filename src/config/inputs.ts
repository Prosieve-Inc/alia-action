import * as core from "@actions/core";

export interface ActionConfig {
  githubToken: string;
  vertexProjectId: string;
  vertexRegion: string;
}

export function loadInputs(): ActionConfig {
  const vertexProjectId = core.getInput("project_id", { required: true });
  const vertexRegion = core.getInput("region", { required: true });

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  return { githubToken, vertexProjectId, vertexRegion };
}
