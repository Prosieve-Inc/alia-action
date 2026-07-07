import { describe, expect, it, afterEach } from "bun:test";
import { AliaClient } from "../../src/services/alia-client";
import { ActionError } from "../../src/utils/errors";
import type { ServiceConfig } from "../../src/services/config";

const stubServiceConfig = {
  config: { aliaSkillStoreRoute: "/skills" },
  getOidcToken: async () => "mock-token",
  buildUrl: (route: string) => `https://backend.test${route}`,
} as unknown as ServiceConfig;

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchStatus(status: number) {
  globalThis.fetch = (async () =>
    new Response(status === 200 ? new ArrayBuffer(4) : "body", {
      status,
    })) as unknown as typeof fetch;
}

describe("AliaClient.fetchSkillZip", () => {
  it("treats a 404 (no skill configured for this event) as a non-fatal skip", async () => {
    mockFetchStatus(404);
    const client = new AliaClient(stubServiceConfig);

    let caught: unknown;
    try {
      await client.fetchSkillZip("pr");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ActionError);
    expect((caught as ActionError).fatal).toBe(false);
  });

  it("keeps other non-OK responses fatal", async () => {
    mockFetchStatus(500);
    const client = new AliaClient(stubServiceConfig);

    let caught: unknown;
    try {
      await client.fetchSkillZip("pr");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const isFatal =
      !(caught instanceof ActionError) ||
      (caught as ActionError).fatal === true;
    expect(isFatal).toBe(true);
  });

  it("returns the zip bytes on success", async () => {
    mockFetchStatus(200);
    const client = new AliaClient(stubServiceConfig);

    const buffer = await client.fetchSkillZip("pr");

    expect(buffer.byteLength).toBe(4);
  });
});
