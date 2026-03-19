import * as github from "@actions/github";
import { loadInputs } from "./config/inputs";
import { createOctokitClient } from "./github/client";
import { authenticate } from "./auth/client";
import { decryptCredentials } from "./auth/crypto";
import { routeEvent } from "./events/router";
import { ActionError, handleError } from "./utils/errors";
import { log } from "./utils/logger";
import type { VertexCredentials } from "./auth/types";

async function run(): Promise<void> {
  try {
    await log.group("Alia Action", async () => {
      const config = loadInputs();
      log.info(`Event: ${github.context.eventName}`);
      log.info(
        `Repo: ${github.context.repo.owner}/${github.context.repo.repo}`,
      );

      // Extract installation ID from webhook payload
      const installationId = (
        github.context.payload as { installation?: { id?: number } }
      ).installation?.id;
      if (!installationId) {
        throw new ActionError(
          "Missing installation ID -- GitHub App is not installed on this repository",
          true,
        );
      }

      // Authenticate once and decrypt credentials
      const authResult = await authenticate(config, installationId);
      const decryptedJson = decryptCredentials(
        authResult.encryptedCredentials,
        config.aliaKey,
      );
      const credentials: VertexCredentials = JSON.parse(decryptedJson);

      const octokit = createOctokitClient(config.githubToken);
      await routeEvent(octokit, config, credentials);

      log.info("Alia Action completed successfully");
    });
  } catch (error) {
    handleError(error);
  }
}

if (import.meta.main) {
  run();
}
