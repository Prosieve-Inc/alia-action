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

      // Extract repository identification from context and webhook payload
      const repoFullName = `${github.context.repo.owner}/${github.context.repo.repo}`;
      const repoId = github.context.payload.repository?.id;
      log.debug(`Payload keys: ${Object.keys(github.context.payload).join(", ")}`);
      log.debug(`organization: ${JSON.stringify(github.context.payload.organization, null, 2)}`);
      log.debug(`repository: ${JSON.stringify(github.context.payload.repository, null, 2)}`);
      if (!repoId) {
        throw new ActionError(
          [
            "Missing repository ID -- no 'repository.id' in webhook payload.",
            "Verify your GitHub App setup:",
            `  1. App is installed: https://github.com/organizations/${github.context.repo.owner}/settings/installations`,
            "  2. This repo is included (if using 'selected repositories')",
            "  3. App subscribes to: issue_comment, pull_request, push",
            "  4. Enable debug logging (ACTIONS_STEP_DEBUG=true) and check 'Payload keys' output",
          ].join("\n"),
          true,
        );
      }

      // Authenticate once and decrypt credentials
      const authResult = await authenticate(config, repoFullName, repoId);
      const decryptedJson = decryptCredentials(
        authResult.encryptedCredentials,
        config.aliaKey,
      );
      const credentials: VertexCredentials = {
        privateKey: decryptedJson,
        serviceAccountEmail: "teste@teste.com",
        projectId: "teste",
        region: "teste",
      };

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
