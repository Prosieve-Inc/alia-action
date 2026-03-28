import type { Octokit } from "@octokit/rest";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { fetchUserIdMap } from "../../github/data-fetcher";
import { log } from "../../utils/logger";

const SKIP_TAGS = new Set(["insight_type", "#text"]);

type ParsedNode = Record<string, unknown>;

function extractUsernamesFromTree(nodes: ParsedNode[]): string[] {
  const usernames: string[] = [];

  for (const node of nodes) {
    for (const key of Object.keys(node)) {
      if (SKIP_TAGS.has(key) || key === ":@") continue;

      const children = node[key] as ParsedNode[];
      for (const child of children) {
        const text = child["#text"] as string | undefined;
        if (!text) continue;

        const names = text
          .split(",")
          .map((n) => n.trim().replace(/^@/, ""))
          .filter(Boolean);
        usernames.push(...names);
      }
    }
  }

  return usernames;
}

function replaceUsernamesInTree(
  nodes: ParsedNode[],
  userIdMap: Map<string, number>,
): void {
  for (const node of nodes) {
    for (const key of Object.keys(node)) {
      if (SKIP_TAGS.has(key) || key === ":@") continue;

      const children = node[key] as ParsedNode[];
      for (const child of children) {
        const text = child["#text"] as string | undefined;
        if (!text) continue;

        const enriched = text
          .split(",")
          .map((n) => {
            const username = n.trim().replace(/^@/, "");
            if (!username) return n;
            const id = userIdMap.get(username);
            return id !== undefined ? `[${username},${id}]` : n.trim();
          })
          .join(",");

        child["#text"] = enriched;
      }
    }
  }
}

export async function enrichSummariesWithUserIds(
  summaries: string[],
  octokit: Octokit,
): Promise<string[]> {
  if (summaries.length === 0) return [];

  try {
    const parser = new XMLParser({ preserveOrder: true });
    const builder = new XMLBuilder({ preserveOrder: true });

    // Parse all summaries and collect unique usernames
    const allUsernames = new Set<string>();
    const parsedSummaries: ParsedNode[][] = [];

    for (const summary of summaries) {
      const wrapped = `<root>${summary}</root>`;
      const parsed = parser.parse(wrapped) as ParsedNode[];
      parsedSummaries.push(parsed);

      // The parsed structure is [{ root: [...children] }]
      const rootNode = parsed[0]!;
      const children = rootNode["root"] as ParsedNode[];
      if (children) {
        for (const username of extractUsernamesFromTree(children)) {
          allUsernames.add(username);
        }
      }
    }

    if (allUsernames.size === 0) return summaries;

    // Fetch user IDs
    const userIdMap = await fetchUserIdMap(octokit, [...allUsernames]);

    if (userIdMap.size === 0) return summaries;

    // Replace usernames with enriched format and rebuild
    const enriched: string[] = [];
    for (const parsed of parsedSummaries) {
      const rootNode = parsed[0]!;
      const children = rootNode["root"] as ParsedNode[];
      if (children) {
        replaceUsernamesInTree(children, userIdMap);
      }

      const xml = builder.build(parsed) as string;
      // Strip the wrapping <root> and </root>
      const result = xml.replace(/^<root>/, "").replace(/<\/root>$/, "");
      enriched.push(result);
    }

    return enriched;
  } catch (error) {
    log.warn(`Failed to enrich summaries with user IDs: ${error}`);
    return summaries;
  }
}
