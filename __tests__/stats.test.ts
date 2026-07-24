import { computeStats } from "../src/stats";
import type { CardState, Domain } from "../src/types";
import { DOMAINS } from "../src/constants";

const NOW = 1_700_000_000_000;

const mkState = (
  cardId: string, dueAt: number, status: "learning" | "review" = "review",
): CardState => ({
  cardId, status, ease: 2.5, intervalDays: 1, dueAt, lapses: 0, reps: 2,
  lastSeenAt: dueAt,
});

// Fake corpus counts and a fixed id -> domain map. "orphan-0" resolves to undefined,
// standing in for a card_state row whose corpus card no longer exists.
const totals: Record<Domain, number> = { cs: 10, finance: 5, math: 8, science: 3 };
const domainMap: Record<string, Domain> = {
  "cs-0": "cs", "cs-1": "cs", "math-0": "math", "science-0": "science",
};
const domainOf = (id: string): Domain | undefined => domainMap[id];

describe("computeStats", () => {
  it("counts learned as the number of card_state rows", () => {
    const states = [mkState("cs-0", NOW), mkState("cs-1", NOW), mkState("math-0", NOW)];
    const stats = computeStats({ states, now: NOW, domainOf, totals });
    expect(stats.learned).toBe(3);
  });

  it("counts mastered as rows whose status is review", () => {
    const states = [
      mkState("cs-0", NOW, "review"),
      mkState("cs-1", NOW, "learning"),
      mkState("math-0", NOW, "review"),
    ];
    const stats = computeStats({ states, now: NOW, domainOf, totals });
    expect(stats.mastered).toBe(2);
  });

  it("counts dueToday including a card due exactly at now (boundary)", () => {
    const states = [
      mkState("cs-0", NOW - 1000),   // past due
      mkState("cs-1", NOW),          // due exactly now
      mkState("math-0", NOW + 1000), // not yet due
    ];
    const stats = computeStats({ states, now: NOW, domainOf, totals });
    expect(stats.dueToday).toBe(2);
  });

  it("reports per-domain seen from resolved ids and total from corpus counts", () => {
    const states = [mkState("cs-0", NOW), mkState("cs-1", NOW), mkState("math-0", NOW)];
    const stats = computeStats({ states, now: NOW, domainOf, totals });
    expect(stats.perDomain.cs).toEqual({ seen: 2, total: 10 });
    expect(stats.perDomain.math).toEqual({ seen: 1, total: 8 });
    expect(stats.perDomain.science).toEqual({ seen: 0, total: 3 });
    expect(stats.perDomain.finance).toEqual({ seen: 0, total: 5 });
  });

  it("initializes every domain even with no states", () => {
    const stats = computeStats({ states: [], now: NOW, domainOf, totals });
    expect(Object.keys(stats.perDomain).sort()).toEqual([...DOMAINS].sort());
    for (const d of DOMAINS) expect(stats.perDomain[d].seen).toBe(0);
  });

  it("counts an orphaned id in learned/mastered/dueToday but not in any perDomain.seen", () => {
    const states = [
      mkState("cs-0", NOW - 1000, "review"),
      mkState("orphan-0", NOW - 1000, "review"),
    ];
    const stats = computeStats({ states, now: NOW, domainOf, totals });
    expect(stats.learned).toBe(2);
    expect(stats.mastered).toBe(2);
    expect(stats.dueToday).toBe(2);
    const totalSeen = DOMAINS.reduce((n, d) => n + stats.perDomain[d].seen, 0);
    expect(totalSeen).toBe(1); // only cs-0 lands in a domain
  });
});
