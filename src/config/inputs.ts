import * as core from "@actions/core";

export interface ActionConfig {
  backendUrl: string;
  authRoute: string;
  insightsRoute: string;
  aliaKey: string;
  githubToken: string;
}

export function loadInputs(): ActionConfig {
  const backendUrl = core.getInput("backend_url", { required: true });
  const authRoute = core.getInput("auth_route", { required: true });
  const insightsRoute = core.getInput("insights_route", { required: true });
  const aliaKey = core.getInput("alia_key", { required: true });

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  core.setSecret(aliaKey);
  core.setSecret(backendUrl);

  return { backendUrl, authRoute, insightsRoute, aliaKey, githubToken };
}
