import { describe, expect, it, mock, beforeEach } from "bun:test";

// Mock @actions/core
mock.module("@actions/core", () => ({
  info: mock(() => {}),
  warning: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
  group: mock((_name: string, fn: () => Promise<void>) => fn()),
  setFailed: mock(() => {}),
  getIDToken: mock(() => Promise.resolve("mock-oidc-token")),
}));

// Mock logger
const mockLogWarn = mock(() => {});
mock.module("../../../src/utils/logger", () => ({
  log: {
    info: mock(() => {}),
    warn: mockLogWarn,
    error: mock(() => {}),
    debug: mock(() => {}),
    group: mock((_name: string, fn: () => Promise<void>) => fn()),
    metadata: mock(() => {}),
  },
}));

// Mock data-fetcher — only fetchUserIdMap is used by enrich-users
const mockFetchUserIdMap = mock(() =>
  Promise.resolve(new Map<string, number>()),
);
mock.module("../../../src/github/data-fetcher", () => ({
  fetchUserIdMap: mockFetchUserIdMap,
}));

import { enrichSummariesWithUserIds } from "../../../src/events/common/enrich-users";

const mockOctokit = {} as never;

describe("enrich-users", () => {
  beforeEach(() => {
    mockLogWarn.mockClear();
    mockFetchUserIdMap.mockClear();
    mockFetchUserIdMap.mockImplementation(() =>
      Promise.resolve(new Map<string, number>()),
    );
  });

  describe("enrichSummariesWithUserIds", () => {
    it("enriches a single user in an <actor> tag", async () => {
      mockFetchUserIdMap.mockImplementation(() =>
        Promise.resolve(new Map([["testuser", 12345]])),
      );
      const summaries = [
        "Some insight text\n<insight_type>\nproject_insight\n</insight_type>\n<actor>\n@testuser\n</actor>",
      ];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result[0]).toContain("[testuser,12345]");
      expect(result[0]).toContain("project_insight");
      expect(result[0]).toContain("Some insight text");
    });

    it("enriches multiple comma-separated users in <mentioned> tag", async () => {
      mockFetchUserIdMap.mockImplementation(() =>
        Promise.resolve(new Map([["user1", 111], ["user2", 222]])),
      );
      const summaries = [
        "Insight\n<insight_type>\nperson_insight\n</insight_type>\n<actor>\n@user1\n</actor>\n<mentioned>\n@user1,@user2\n</mentioned>",
      ];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result[0]).toContain("[user1,111]");
      expect(result[0]).toContain("[user2,222]");
    });

    it("does NOT modify <insight_type> tag content", async () => {
      mockFetchUserIdMap.mockImplementation(() =>
        Promise.resolve(new Map([["testuser", 12345]])),
      );
      const summaries = [
        "Text\n<insight_type>\nproject_insight\n</insight_type>\n<actor>\n@testuser\n</actor>",
      ];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result[0]).toContain("project_insight");
      expect(result[0]).not.toContain("[project_insight");
    });

    it("handles usernames without @ prefix", async () => {
      mockFetchUserIdMap.mockImplementation(() =>
        Promise.resolve(new Map([["plainuser", 99999]])),
      );
      const summaries = [
        "Text\n<actor>\nplainuser\n</actor>",
      ];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result[0]).toContain("[plainuser,99999]");
    });

    it("deduplicates usernames — passes unique list to fetchUserIdMap", async () => {
      mockFetchUserIdMap.mockImplementation(() =>
        Promise.resolve(new Map([["shareduser", 555]])),
      );
      const summaries = [
        "First\n<actor>\n@shareduser\n</actor>",
        "Second\n<actor>\n@shareduser\n</actor>",
      ];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result[0]).toContain("[shareduser,555]");
      expect(result[1]).toContain("[shareduser,555]");
      // fetchUserIdMap should be called once with the deduplicated list
      expect(mockFetchUserIdMap).toHaveBeenCalledTimes(1);
      const callArgs = mockFetchUserIdMap.mock.calls[0] as unknown[];
      expect(callArgs[1]).toEqual(["shareduser"]);
    });

    it("leaves username unchanged when lookup fails and logs warning", async () => {
      mockFetchUserIdMap.mockImplementation(() =>
        Promise.resolve(new Map([["gooduser", 111]])),
      );
      const summaries = [
        "Text\n<actor>\n@gooduser\n</actor>\n<mentioned>\n@baduser\n</mentioned>",
      ];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result[0]).toContain("[gooduser,111]");
      expect(result[0]).toContain("@baduser");
    });

    it("returns empty array for empty input", async () => {
      const result = await enrichSummariesWithUserIds([], mockOctokit);

      expect(result).toEqual([]);
      expect(mockFetchUserIdMap).not.toHaveBeenCalled();
    });

    it("returns summary unchanged when no XML tags present", async () => {
      const summaries = ["Just plain text with no tags"];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result[0]).toBe("Just plain text with no tags");
      expect(mockFetchUserIdMap).not.toHaveBeenCalled();
    });

    it("handles whitespace around commas in user lists", async () => {
      mockFetchUserIdMap.mockImplementation(() =>
        Promise.resolve(new Map([["a", 1], ["b", 2], ["c", 3]])),
      );
      const summaries = [
        "Text\n<mentioned>\n@a, @b , @c\n</mentioned>",
      ];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result[0]).toContain("[a,1]");
      expect(result[0]).toContain("[b,2]");
      expect(result[0]).toContain("[c,3]");
    });

    it("returns original summaries when all lookups fail", async () => {
      mockFetchUserIdMap.mockImplementation(() =>
        Promise.resolve(new Map<string, number>()),
      );
      const summaries = [
        "Text\n<actor>\n@failuser\n</actor>",
      ];

      const result = await enrichSummariesWithUserIds(summaries, mockOctokit);

      expect(result).toEqual(summaries);
    });
  });
});
