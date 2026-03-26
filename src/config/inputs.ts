function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export class ActionConfig {
  readonly githubToken: string;
  readonly aliaBackendUrl: string;
  readonly aliaSkillStoreRoute: string;
  readonly aliaSaveInsightsRoute: string;

  private constructor(
    githubToken: string,
    aliaBackendUrl: string,
    aliaSkillStoreRoute: string,
    aliaSaveInsightsRoute: string,
  ) {
    this.githubToken = githubToken;
    this.aliaBackendUrl = aliaBackendUrl;
    this.aliaSkillStoreRoute = aliaSkillStoreRoute;
    this.aliaSaveInsightsRoute = aliaSaveInsightsRoute;
  }

  static fromEnv(): ActionConfig {
    return new ActionConfig(
      requireEnv("GITHUB_TOKEN"),
      requireEnv("ALIA_BACKEND_URL"),
      requireEnv("ALIA_SKILL_STORE_ROUTE"),
      requireEnv("ALIA_SAVE_INSIGHTS_ROUTE"),
    );
  }
}
