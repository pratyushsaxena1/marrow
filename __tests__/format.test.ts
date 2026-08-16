import { difficultyLabel, loadSelectedLevels, nextReviewLabel, weekdayInitial } from "../src/format";
import { related } from "../src/search";
import { DAY_MS } from "../src/constants";
import type { Card } from "../src/types";

const NOW = 1_700_000_000_000;

describe("nextReviewLabel", () => {
  it("reports a past or exactly-now due time as due", () => {
    expect(nextReviewLabel(NOW - 1, NOW)).toBe("Due now");
    expect(nextReviewLabel(NOW, NOW)).toBe("Due now");
  });

  it("uses minutes under an hour, never rounding down to zero", () => {
    expect(nextReviewLabel(NOW + 25 * 60_000, NOW)).toBe("Due in 25 minutes");
    expect(nextReviewLabel(NOW + 1000, NOW)).toBe("Due in 1 minute");
  });

  it("uses hours under a day", () => {
    expect(nextReviewLabel(NOW + 5 * 3_600_000, NOW)).toBe("Due in 5 hours");
    expect(nextReviewLabel(NOW + 3_600_000, NOW)).toBe("Due in 1 hour");
  });

  it("uses days beyond a day, singular at exactly one", () => {
    expect(nextReviewLabel(NOW + DAY_MS, NOW)).toBe("Due in 1 day");
    expect(nextReviewLabel(NOW + 12 * DAY_MS, NOW)).toBe("Due in 12 days");
  });
});

describe("difficultyLabel", () => {
  it("names each level and falls back for an unknown one", () => {
    expect(difficultyLabel(1)).toBe("High school");
    expect(difficultyLabel(2)).toBe("Undergrad");
    expect(difficultyLabel(3)).toBe("Graduate+");
    expect(difficultyLabel(9)).toBe("Undergrad");
  });
});

describe("loadSelectedLevels", () => {
  it("reads a stored selection", () => {
    expect(loadSelectedLevels("[1,3]")).toEqual([1, 3]);
  });

  it("degrades to every level for missing, malformed or foreign values", () => {
    expect(loadSelectedLevels(null)).toEqual([]);
    expect(loadSelectedLevels("not json")).toEqual([]);
    expect(loadSelectedLevels('{"a":1}')).toEqual([]);
    expect(loadSelectedLevels("[9,2]")).toEqual([2]);
  });
});

describe("weekdayInitial", () => {
  it("returns the initial of the local weekday", () => {
    expect(weekdayInitial(new Date(2026, 6, 26).getTime())).toBe("S"); // Sunday
    expect(weekdayInitial(new Date(2026, 6, 27).getTime())).toBe("M");
  });
});

const mkCard = (over: Partial<Card> & { id: string }): Card => ({
  type: "concept",
  domain: "cs",
  topic: "topic",
  title: "t",
  body: "b",
  prompt: "p",
  answer: "a",
  difficulty: 2,
  sources: ["https://example.com"],
  tags: [],
  ...over,
});

describe("related", () => {
  const base = mkCard({ id: "a", topic: "hash tables", tags: ["data-structures"] });
  const sameTopic = mkCard({ id: "b", topic: "hash tables", tags: [] });
  const sharedTag = mkCard({ id: "c", topic: "trees", tags: ["data-structures"] });
  const sameDomainOnly = mkCard({ id: "d", topic: "networking", tags: ["tcp"] });
  const unrelated = mkCard({ id: "e", domain: "finance", topic: "bonds", tags: ["rates"] });

  const all = [base, sameTopic, sharedTag, sameDomainOnly, unrelated];

  it("never includes the card itself", () => {
    expect(related(base, all, 10).map((c) => c.id)).not.toContain("a");
  });

  it("ranks a shared topic above a shared tag", () => {
    expect(related(base, all, 10).map((c) => c.id).slice(0, 2)).toEqual(["b", "c"]);
  });

  it("excludes cards that only share a subject", () => {
    expect(related(base, all, 10).map((c) => c.id)).not.toContain("d");
  });

  it("excludes cards with nothing in common", () => {
    expect(related(base, all, 10).map((c) => c.id)).not.toContain("e");
  });

  it("respects the limit", () => {
    expect(related(base, all, 1)).toHaveLength(1);
    expect(related(base, all, 0)).toEqual([]);
  });
});
