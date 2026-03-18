import * as github from "@actions/github";
import { loadInputs } from "./config/inputs";
import { createOctokitClient } from "./github/client";
import { routeEvent } from "./events/router";
import { handleError } from "./utils/errors";
import { log } from "./utils/logger";

async function run(): Promise<void> {
  try {
    await log.group("Alia Action", async () => {
      const config = loadInputs();
      log.info(`Event: ${github.context.eventName}`);
      log.info(
        `Repo: ${github.context.repo.owner}/${github.context.repo.repo}`,
      );

      const octokit = createOctokitClient(config.githubToken);
      await routeEvent(octokit, config);

      log.info("Alia Action completed successfully");
    });
  } catch (error) {
    handleError(error);
  }
}

if (import.meta.main) {
  run();
}
