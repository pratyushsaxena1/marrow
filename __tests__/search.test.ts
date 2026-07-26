import { EMPTY_QUERY, scoreCard, searchCards, statusOf, terms } from "../src/search";
import type { Card, CardState, Domain } from "../src/types";

const NOW = 1_700_000_000_000;

const mkCard = (over: Partial<Card> & { id: string }): Card => ({
  type: "concept",
  domain: "cs",
  topic: "topic",
  title: "title",
  body: "body",
  prompt: "prompt",
  answer: "answer",
  difficulty: 2,
  sources: ["https://example.com"],
  tags: [],
  ...over,
});

const mkState = (over: Partial<CardState> & { cardId: string }): CardState => ({
  status: "review",
  ease: 2.5,
  intervalDays: 3,
  dueAt: NOW + 1000,
  lapses: 0,
  reps: 3,
  lastSeenAt: NOW,
  ...over,
});

const deps = (cards: Card[], states: CardState[] = [], saved: string[] = []) => {
  const byId = new Map(states.map((s) => [s.cardId, s]));
  return { cards, stateOf: (id: string) => byId.get(id), saved: new Set(saved), now: NOW };
};

describe("terms", () => {
  it("lowercases and splits on whitespace, dropping empties", () => {
    expect(terms("  Hash   Table ")).toEqual(["hash", "table"]);
    expect(terms("")).toEqual([]);
    expect(terms("   ")).toEqual([]);
  });
});

describe("statusOf", () => {
  it("maps absent state to new, learning to learning, review to mastered", () => {
    expect(statusOf(undefined)).toBe("new");
    expect(statusOf(mkState({ cardId: "a", status: "learning" }))).toBe("learning");
    expect(statusOf(mkState({ cardId: "a", status: "review" }))).toBe("mastered");
  });
});

describe("scoreCard", () => {
  it("returns 0 when any term is missing (AND semantics)", () => {
    const c = mkCard({ id: "cs-0001", title: "Hash tables" });
    expect(scoreCard(c, ["hash"])).toBeGreaterThan(0);
    expect(scoreCard(c, ["hash", "quantum"])).toBe(0);
  });

  it("scores a title hit above a body-only hit", () => {
    const titled = mkCard({ id: "a", title: "Entropy explained", body: "unrelated words" });
    const buried = mkCard({ id: "b", title: "unrelated", body: "a note about entropy here" });
    expect(scoreCard(titled, ["entropy"])).toBeGreaterThan(scoreCard(buried, ["entropy"]));
  });

  it("scores a word-start hit above a mid-word hit in the same field", () => {
    const start = mkCard({ id: "a", title: "net present value" });
    const mid = mkCard({ id: "b", title: "subnet masks" });
    expect(scoreCard(start, ["net"])).toBeGreaterThan(scoreCard(mid, ["net"]));
  });
});

describe("searchCards", () => {
  const cards = [
    mkCard({ id: "cs-0001", domain: "cs", title: "Hash tables", tags: ["data-structures"] }),
    mkCard({ id: "fin-0001", domain: "finance", title: "Compound interest" }),
    mkCard({ id: "math-0001", domain: "math", title: "Bayes rule", body: "about interest rates" }),
  ];

  it("returns everything, in corpus order, for an empty query", () => {
    const out = searchCards(deps(cards), EMPTY_QUERY);
    expect(out.map((c) => c.id)).toEqual(["cs-0001", "fin-0001", "math-0001"]);
  });

  it("filters by domain", () => {
    const out = searchCards(deps(cards), { ...EMPTY_QUERY, domains: ["finance" as Domain] });
    expect(out.map((c) => c.id)).toEqual(["fin-0001"]);
  });

  it("ranks a title match above a body match for the same term", () => {
    const out = searchCards(deps(cards), { ...EMPTY_QUERY, text: "interest" });
    expect(out.map((c) => c.id)).toEqual(["fin-0001", "math-0001"]);
  });

  it("drops cards missing any search term", () => {
    const out = searchCards(deps(cards), { ...EMPTY_QUERY, text: "hash tables" });
    expect(out.map((c) => c.id)).toEqual(["cs-0001"]);
  });

  it("matches on tags", () => {
    const out = searchCards(deps(cards), { ...EMPTY_QUERY, text: "data-structures" });
    expect(out.map((c) => c.id)).toEqual(["cs-0001"]);
  });

  it("filters to new cards (no state)", () => {
    const states = [mkState({ cardId: "cs-0001" })];
    const out = searchCards(deps(cards, states), { ...EMPTY_QUERY, status: "new" });
    expect(out.map((c) => c.id)).toEqual(["fin-0001", "math-0001"]);
  });

  it("filters to mastered cards", () => {
    const states = [
      mkState({ cardId: "cs-0001", status: "review" }),
      mkState({ cardId: "fin-0001", status: "learning" }),
    ];
    const out = searchCards(deps(cards, states), { ...EMPTY_QUERY, status: "mastered" });
    expect(out.map((c) => c.id)).toEqual(["cs-0001"]);
  });

  it("filters to due cards, counting a card due exactly now", () => {
    const states = [
      mkState({ cardId: "cs-0001", dueAt: NOW }),
      mkState({ cardId: "fin-0001", dueAt: NOW + 1 }),
    ];
    const out = searchCards(deps(cards, states), { ...EMPTY_QUERY, status: "due" });
    expect(out.map((c) => c.id)).toEqual(["cs-0001"]);
  });

  it("filters to saved cards", () => {
    const out = searchCards(deps(cards, [], ["math-0001"]), { ...EMPTY_QUERY, savedOnly: true });
    expect(out.map((c) => c.id)).toEqual(["math-0001"]);
  });

  it("combines text, domain and saved filters", () => {
    const out = searchCards(deps(cards, [], ["fin-0001", "math-0001"]), {
      text: "interest",
      domains: ["math"],
      status: "all",
      savedOnly: true,
    });
    expect(out.map((c) => c.id)).toEqual(["math-0001"]);
  });
});
