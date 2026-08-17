import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Card, Domain } from "../src/types";

const DOMAINS: Domain[] = ["cs", "finance", "math", "science"];
const OUT_DIR = join(__dirname, "..", "targets", "widget", "assets");
export const WIDGET_CARDS_PATH = join(OUT_DIR, "cards.json");

/** The five fields the widget renders. Answers, prompts, sources, tags and topic are
 *  left behind: no layout shows them, and shipping them would inflate the payload. */
type WidgetCard = Pick<Card, "id" | "domain" | "title" | "body" | "difficulty">;

/** Returns the exact bytes the committed file should hold. Kept pure so a test can
 *  compare against the file without writing to disk. */
export function buildWidgetCards(): string {
  const cards: WidgetCard[] = [];
  for (const domain of DOMAINS) {
    const raw = readFileSync(join(__dirname, "..", "corpus", `${domain}.json`), "utf8");
    for (const card of JSON.parse(raw) as Card[]) {
      cards.push({
        id: card.id,
        domain: card.domain,
        title: card.title,
        body: card.body,
        difficulty: card.difficulty,
      });
    }
  }
  cards.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `${JSON.stringify(cards)}\n`;
}

if (require.main === module) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(WIDGET_CARDS_PATH, buildWidgetCards());
  console.log(`Wrote ${WIDGET_CARDS_PATH}`);
}
