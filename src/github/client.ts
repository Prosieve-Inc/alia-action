import { Octokit } from "@octokit/rest";

export function createOctokitClient(token: string): Octokit {
  return new Octokit({
    auth: token,
    baseUrl: process.env.GITHUB_API_URL || "https://api.github.com",
  });
}
