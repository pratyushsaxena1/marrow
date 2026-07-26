import { buildQuiz, summarize } from "../src/quiz";
import type { Card, CardState, Rng } from "../src/types";

const NOW = 1_700_000_000_000;

const mkCard = (id: string, domain: Card["domain"] = "cs"): Card => ({
  id,
  type: "concept",
  domain,
  topic: "t",
  title: `title ${id}`,
  body: "b",
  prompt: "p",
  answer: "a",
  difficulty: 2,
  sources: ["https://example.com"],
  tags: [],
});

const mkState = (cardId: string, dueAt: number): CardState => ({
  cardId,
  status: "review",
  ease: 2.5,
  intervalDays: 3,
  dueAt,
  lapses: 0,
  reps: 3,
  lastSeenAt: NOW,
});

// Deterministic rng that always picks index 0 in the Fisher-Yates swap, making the
// shuffle a fixed permutation so ordering assertions are stable.
const zeroRng: Rng = () => 0;

const deps = (cards: Card[], states: CardState[] = [], rng: Rng = zeroRng) => {
  const byId = new Map(states.map((s) => [s.cardId, s]));
  return { cards, stateOf: (id: string) => byId.get(id), now: NOW, rng };
};

describe("buildQuiz", () => {
  const cards = [mkCard("cs-1"), mkCard("cs-2"), mkCard("cs-3"), mkCard("fin-1", "finance")];

  it("returns at most `size` questions", () => {
    expect(buildQuiz(deps(cards), { size: 2, domains: [] })).toHaveLength(2);
  });

  it("returns everything available when size exceeds the pool", () => {
    expect(buildQuiz(deps(cards), { size: 99, domains: [] })).toHaveLength(4);
  });

  it("returns nothing for a non-positive size", () => {
    expect(buildQuiz(deps(cards), { size: 0, domains: [] })).toEqual([]);
  });

  it("restricts to the selected domains", () => {
    const out = buildQuiz(deps(cards), { size: 99, domains: ["finance"] });
    expect(out.map((c) => c.id)).toEqual(["fin-1"]);
  });

  it("treats an empty domain list as every domain", () => {
    const out = buildQuiz(deps(cards), { size: 99, domains: [] });
    expect(out.map((c) => c.id).sort()).toEqual(["cs-1", "cs-2", "cs-3", "fin-1"]);
  });

  it("puts due cards before seen-not-due cards before never-seen cards", () => {
    const states = [
      mkState("cs-1", NOW + 100_000), // seen, not due
      mkState("cs-2", NOW - 100_000), // due
    ];
    // cs-3 and fin-1 have no state, so they are the never-seen tier.
    const out = buildQuiz(deps(cards, states), { size: 4, domains: [] });
    expect(out[0].id).toBe("cs-2");
    expect(out[1].id).toBe("cs-1");
    expect(out.slice(2).map((c) => c.id).sort()).toEqual(["cs-3", "fin-1"]);
  });

  it("counts a card due exactly now as due", () => {
    const states = [mkState("cs-1", NOW + 100_000), mkState("cs-2", NOW)];
    const out = buildQuiz(deps(cards, states), { size: 4, domains: [] });
    expect(out[0].id).toBe("cs-2");
  });

  it("varies order between runs with a real rng", () => {
    const many = Array.from({ length: 30 }, (_, i) => mkCard(`cs-${i}`));
    const a = buildQuiz(deps(many, [], Math.random), { size: 30, domains: [] });
    const b = buildQuiz(deps(many, [], Math.random), { size: 30, domains: [] });
    expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id));
  });

  it("never repeats a card within one run", () => {
    const out = buildQuiz(deps(cards, [], Math.random), { size: 99, domains: [] });
    expect(new Set(out.map((c) => c.id)).size).toBe(out.length);
  });
});

describe("summarize", () => {
  it("counts correct answers and computes whole-percent accuracy", () => {
    const s = summarize([
      { cardId: "a", grade: "got" },
      { cardId: "b", grade: "missed" },
      { cardId: "c", grade: "got" },
      { cardId: "d", grade: "got" },
    ]);
    expect(s.total).toBe(4);
    expect(s.correct).toBe(3);
    expect(s.pct).toBe(75);
  });

  it("lists missed card ids in answer order", () => {
    const s = summarize([
      { cardId: "a", grade: "missed" },
      { cardId: "b", grade: "got" },
      { cardId: "c", grade: "missed" },
    ]);
    expect(s.missed).toEqual(["a", "c"]);
  });

  it("reports 0 rather than NaN for an empty run", () => {
    expect(summarize([])).toEqual({ total: 0, correct: 0, pct: 0, missed: [] });
  });
});
