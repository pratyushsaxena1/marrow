import { readFileSync } from "fs";
import { buildWidgetCards, WIDGET_CARDS_PATH } from "../scripts/build-widget-cards";
import { loadCorpus } from "../src/corpus";

describe("widget card data", () => {
  it("matches the committed file, so a corpus edit cannot ship stale widget data", () => {
    const committed = readFileSync(WIDGET_CARDS_PATH, "utf8");
    expect(committed).toBe(buildWidgetCards());
  });

  it("carries every card, trimmed to the fields the widget renders", () => {
    const cards: unknown = JSON.parse(buildWidgetCards());
    expect(Array.isArray(cards)).toBe(true);
    const list = cards as Record<string, unknown>[];
    expect(list).toHaveLength(loadCorpus().length);
    expect(Object.keys(list[0]).sort()).toEqual(
      ["body", "difficulty", "domain", "id", "title"],
    );
  });

  it("is sorted by id, so the widget's pool order does not depend on file order", () => {
    const list = JSON.parse(buildWidgetCards()) as { id: string }[];
    const ids = list.map((c) => c.id);
    expect(ids).toEqual([...ids].sort());
  });
});
