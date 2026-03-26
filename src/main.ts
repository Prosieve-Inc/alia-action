import * as github from "@actions/github";
import { ActionConfig } from "./config/inputs";
import { createOctokitClient } from "./github/client";
import { ServiceConfig } from "./services/config";
import { AliaClient } from "./services/alia-client";
// import { handleClaudeTest } from "./events/claude-test";
import { routeEvent } from "./events/router";
import { handleError } from "./utils/errors";
import { log } from "./utils/logger";

async function run(): Promise<void> {
  try {
    await log.group("Alia Action", async () => {
      const config = ActionConfig.fromEnv();
      log.info(`Event: ${github.context.eventName}`);
      log.info(
        `Repo: ${github.context.repo.owner}/${github.context.repo.repo}`,
      );

      // Run Claude SDK test (hard-coded proof-of-concept)
      // await log.group("Claude SDK Test", async () => {
      //   await handleClaudeTest();
      // });

      const octokit = createOctokitClient(config.githubToken);
      const serviceConfig = new ServiceConfig(config);
      const aliaClient = new AliaClient(serviceConfig);
      await routeEvent(octokit, config, aliaClient);

      log.info("Alia Action completed successfully");
    });
  } catch (error) {
    handleError(error);
  }
}

if (import.meta.main) {
  run();
}
