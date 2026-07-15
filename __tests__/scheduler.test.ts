import { initialState, review, isDue } from "../src/scheduler";
import { DAY_MS, EASE_INITIAL, EASE_MAX, EASE_MIN } from "../src/constants";
import type { CardState } from "../src/types";

const NOW = 1_700_000_000_000;
const noFuzz = () => 0.5; // 0.9 + 0.5*0.2 = 1.0 exactly

describe("initialState", () => {
  it("schedules a passive read one day out with no reps", () => {
    const s = initialState("cs-0001", NOW, noFuzz);
    expect(s.cardId).toBe("cs-0001");
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);
    expect(s.ease).toBe(EASE_INITIAL);
    expect(s.status).toBe("learning");
    expect(s.intervalDays).toBeCloseTo(1);
    expect(s.dueAt).toBe(NOW + DAY_MS);
    expect(s.lastSeenAt).toBe(NOW);
  });
});

describe("review", () => {
  it("walks the ladder 1 -> 3 -> interval*ease on success", () => {
    const a = initialState("cs-0001", NOW, noFuzz);
    const b = review(a, "got", NOW + DAY_MS, noFuzz);
    expect(b.intervalDays).toBeCloseTo(3);
    expect(b.reps).toBe(1);
    expect(b.ease).toBeCloseTo(2.6);
    expect(b.status).toBe("learning");

    const c = review(b, "got", NOW + 4 * DAY_MS, noFuzz);
    expect(c.intervalDays).toBeCloseTo(3 * 2.7);
    expect(c.reps).toBe(2);
    expect(c.status).toBe("review");
  });

  it("puzzle nailed on sight starts at 3 days, not 1", () => {
    const s = review(initialState("math-0001", NOW, noFuzz), "got", NOW, noFuzz);
    expect(s.intervalDays).toBeCloseTo(3);
  });

  it("resets to one day and drops ease on a miss", () => {
    const a = initialState("cs-0001", NOW, noFuzz);
    const b = review(a, "got", NOW, noFuzz);
    const c = review(b, "got", NOW, noFuzz);
    const d = review(c, "missed", NOW, noFuzz);
    expect(d.intervalDays).toBeCloseTo(1);
    expect(d.reps).toBe(0);
    expect(d.lapses).toBe(1);
    expect(d.status).toBe("learning");
    expect(d.ease).toBeCloseTo(c.ease - 0.2);
  });

  it("clamps ease at the floor after repeated misses", () => {
    let s = initialState("cs-0001", NOW, noFuzz);
    for (let i = 0; i < 20; i++) s = review(s, "missed", NOW, noFuzz);
    expect(s.ease).toBe(EASE_MIN);
  });

  it("clamps ease at the ceiling after repeated successes", () => {
    let s = initialState("cs-0001", NOW, noFuzz);
    for (let i = 0; i < 20; i++) s = review(s, "got", NOW, noFuzz);
    expect(s.ease).toBe(EASE_MAX);
  });

  it("fuzzes intervals within +/-10% and never outside it", () => {
    const lo = review(initialState("x", NOW, () => 0), "got", NOW, () => 0);
    const hi = review(initialState("x", NOW, () => 0.999999), "got", NOW, () => 0.999999);
    expect(lo.intervalDays).toBeCloseTo(2.7, 5);
    expect(hi.intervalDays).toBeGreaterThan(3.29);
    expect(hi.intervalDays).toBeLessThanOrEqual(3.3);
  });

  it("derives dueAt from the fuzzed interval", () => {
    const s = review(initialState("x", NOW, noFuzz), "got", NOW, noFuzz);
    expect(s.dueAt).toBe(NOW + Math.round(s.intervalDays * DAY_MS));
  });

  it("does not mutate the input state", () => {
    const a = initialState("cs-0001", NOW, noFuzz);
    const snapshot: CardState = { ...a };
    review(a, "got", NOW, noFuzz);
    expect(a).toEqual(snapshot);
  });
});

describe("isDue", () => {
  it("is due exactly at and after dueAt, not before", () => {
    const s = initialState("cs-0001", NOW, noFuzz);
    expect(isDue(s, s.dueAt - 1)).toBe(false);
    expect(isDue(s, s.dueAt)).toBe(true);
    expect(isDue(s, s.dueAt + DAY_MS)).toBe(true);
  });
});
