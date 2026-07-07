import type { SkillType, InsightMetadata } from "../events/claude-analysis";
import type { ServiceConfig } from "./config";
import { ActionError } from "../utils/errors";
import { log } from "../utils/logger";

export class AliaClient {
  constructor(private readonly serviceConfig: ServiceConfig) {}

  /**
   * Fetches the skill .zip from the Alia backend skill store.
   */
  async fetchSkillZip(skillType: SkillType): Promise<ArrayBuffer> {
    const idToken = await this.serviceConfig.getOidcToken();
    const { aliaSkillStoreRoute } = this.serviceConfig.config;
    const url = `${this.serviceConfig.buildUrl(aliaSkillStoreRoute)}?type=${skillType}`;
    log.info(`Fetching skill .zip from ${url}...`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!response.ok) {
      // A 404 means the skill store has no skill configured for this event
      // type. That is a valid "nothing to analyze" state, not an infrastructure
      // failure — surface it as a non-fatal warning so the workflow succeeds
      // instead of blocking the PR.
      if (response.status === 404) {
        throw new ActionError(
          `No skill configured for type "${skillType}" (skill store returned 404); skipping analysis.`,
          false,
        );
      }
      throw new Error(
        `Failed to fetch skill zip: ${response.status} ${response.statusText}`,
      );
    }

    return response.arrayBuffer();
  }

  /**
   * Sends analysis insights to the Alia backend.
   */
  async sendInsights(
    metadata: InsightMetadata,
    summaries: string[],
  ): Promise<void> {
    const idToken = await this.serviceConfig.getOidcToken();
    const { aliaSaveInsightsRoute } = this.serviceConfig.config;
    const url = this.serviceConfig.buildUrl(aliaSaveInsightsRoute);

    log.info(`Sending ${summaries.length} insights to ${url}...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ metadata, summaries }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Failed to send insights: ${response.status} ${response.statusText} - ${body}`,
      );
    }

    log.info("Insights sent successfully.");
  }
}
