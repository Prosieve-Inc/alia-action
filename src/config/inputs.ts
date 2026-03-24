export interface ActionConfig {
  githubToken: string;
}

export function loadInputs(): ActionConfig {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  return { githubToken };
}
