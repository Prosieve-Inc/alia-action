import * as core from "@actions/core";
import type { ActionConfig } from "../config/inputs";

export class ServiceConfig {
  constructor(readonly config: ActionConfig) {}

  async getOidcToken(): Promise<string> {
    return core.getIDToken(this.config.aliaBackendUrl);
  }

  buildUrl(route: string): string {
    return `${this.config.aliaBackendUrl}${route}`;
  }
}
