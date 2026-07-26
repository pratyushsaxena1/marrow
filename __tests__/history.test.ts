import {
  accuracy,
  currentStreak,
  dailyCounts,
  reviewsToday,
  startOfDay,
  windowStart,
} from "../src/stats";
import type { Grade, ReviewLogEntry } from "../src/types";

// A fixed local noon, so shifting by whole days never lands near a midnight boundary.
const NOW = new Date(2026, 6, 26, 12, 0, 0).getTime();

/** `daysAgo` local days before NOW, at local noon. */
const at = (daysAgo: number): number => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
};

const entry = (daysAgo: number, grade: Grade = "got"): ReviewLogEntry => ({
  cardId: `c-${daysAgo}`,
  grade,
  at: at(daysAgo),
});

describe("startOfDay", () => {
  it("returns local midnight of the containing day", () => {
    const d = new Date(startOfDay(NOW));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(new Date(NOW).getDate());
  });

  it("is stable across two times on the same day", () => {
    const morning = new Date(2026, 6, 26, 1, 30).getTime();
    const night = new Date(2026, 6, 26, 23, 45).getTime();
    expect(startOfDay(morning)).toBe(startOfDay(night));
  });
});

describe("dailyCounts", () => {
  it("returns exactly `days` buckets, oldest first, ending today", () => {
    const buckets = dailyCounts([], NOW, 7);
    expect(buckets).toHaveLength(7);
    expect(buckets[6].dayStart).toBe(startOfDay(NOW));
    expect(buckets[0].dayStart).toBeLessThan(buckets[6].dayStart);
  });

  it("counts entries into their local day", () => {
    const log = [entry(0), entry(0), entry(2)];
    const buckets = dailyCounts(log, NOW, 7);
    expect(buckets[6].count).toBe(2); // today
    expect(buckets[4].count).toBe(1); // two days ago
    expect(buckets[5].count).toBe(0);
  });

  it("keeps empty days present with count 0", () => {
    const buckets = dailyCounts([entry(0)], NOW, 5);
    expect(buckets.map((b) => b.count)).toEqual([0, 0, 0, 0, 1]);
  });

  it("ignores entries older than the window", () => {
    const buckets = dailyCounts([entry(30)], NOW, 7);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("ignores future-dated entries", () => {
    const future = { cardId: "x", grade: "got" as Grade, at: at(-3) };
    const buckets = dailyCounts([future], NOW, 7);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("reviewsToday", () => {
  it("counts only entries in today's local day", () => {
    expect(reviewsToday([entry(0), entry(0), entry(1)], NOW)).toBe(2);
  });

  it("is 0 with an empty log", () => {
    expect(reviewsToday([], NOW)).toBe(0);
  });
});

describe("currentStreak", () => {
  it("is 0 with no reviews", () => {
    expect(currentStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(currentStreak([entry(0), entry(1), entry(2)], NOW)).toBe(3);
  });

  it("counts a day once no matter how many reviews it holds", () => {
    expect(currentStreak([entry(0), entry(0), entry(0), entry(1)], NOW)).toBe(2);
  });

  it("keeps yesterday's streak alive when today has no reviews yet", () => {
    expect(currentStreak([entry(1), entry(2), entry(3)], NOW)).toBe(3);
  });

  it("is 0 once both today and yesterday are empty", () => {
    expect(currentStreak([entry(2), entry(3)], NOW)).toBe(0);
  });

  it("stops at the first gap", () => {
    expect(currentStreak([entry(0), entry(1), entry(3), entry(4)], NOW)).toBe(2);
  });
});

describe("accuracy", () => {
  it("computes whole-percent accuracy", () => {
    const log = [entry(0, "got"), entry(1, "got"), entry(2, "got"), entry(3, "missed")];
    expect(accuracy(log)).toEqual({ reviews: 4, correct: 3, pct: 75 });
  });

  it("returns 0 rather than NaN for an empty log", () => {
    expect(accuracy([])).toEqual({ reviews: 0, correct: 0, pct: 0 });
  });
});

describe("windowStart", () => {
  it("is early enough to include the oldest bucket dailyCounts will render", () => {
    const buckets = dailyCounts([], NOW, 28);
    expect(windowStart(NOW, 28)).toBeLessThanOrEqual(buckets[0].dayStart);
  });
});
