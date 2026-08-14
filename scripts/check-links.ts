/**
 * Verifies every source URL in the corpus actually resolves.
 *
 * The corpus is the app's claim to being trustworthy, and a citation pointing at a
 * page that does not exist is worse than no citation. This is a build-time check only.
 * The app itself never makes a network request; see CLAUDE.md.
 *
 * Run with: npm run check-links
 */
import * as fs from "fs";
import * as path from "path";
import { DOMAINS } from "../src/constants";
import type { Card } from "../src/types";

const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;

/** url -> the card ids citing it, so a failure names the cards that need fixing. */
const citations = new Map<string, string[]>();

for (const domain of DOMAINS) {
  const cards = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "corpus", `${domain}.json`), "utf8"),
  ) as Card[];
  for (const c of cards)
    for (const url of c.sources)
      citations.set(url, [...(citations.get(url) ?? []), c.id]);
}

type Result = { url: string; ok: boolean; detail: string };

/** HEAD first, since it is cheap. Some hosts reject HEAD but serve GET, so fall back
 *  rather than reporting a working page as broken. */
async function check(url: string): Promise<Result> {
  for (const method of ["HEAD", "GET"] as const) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        // A browser user-agent, because several perfectly live hosts (NOAA, BLS)
        // return 403 to anything that identifies itself as a script. Without this
        // the check reports working citations as broken, which is worse than useless.
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,*/*",
        },
      });
      if (res.ok) return { url, ok: true, detail: String(res.status) };
      if (method === "GET") return { url, ok: false, detail: `HTTP ${res.status}` };
    } catch (err) {
      if (method === "GET")
        return { url, ok: false, detail: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timer);
    }
  }
  return { url, ok: false, detail: "unreachable" };
}

async function main(): Promise<void> {
  const urls = [...citations.keys()];
  const results: Result[] = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      results.push(await check(url));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const bad = results.filter((r) => !r.ok);
  console.log(`checked ${urls.length} unique source URLs, ${bad.length} failing`);
  for (const r of bad)
    console.error(`  ${r.detail}  ${r.url}\n    cited by: ${citations.get(r.url)!.join(", ")}`);
  process.exit(bad.length > 0 ? 1 : 0);
}

void main();
