import { createSession, nextChunk } from "../src/feed";
import type { Card, CardState, Domain, FeedItem } from "../src/types";
import { DOMAINS, REVIEW_CAP_PER_SESSION } from "../src/constants";

const NOW = 1_700_000_000_000;
const mid = () => 0.5;

const mkCard = (id: string, domain: Domain, type: "concept" | "puzzle" = "concept"): Card => ({
  id, type, domain, topic: "t", title: "T", body: "b", prompt: "p", answer: "a",
  difficulty: 1, sources: ["https://example.com"], tags: [],
});

const mkState = (cardId: string, dueAt: number): CardState => ({
  cardId, status: "review", ease: 2.5, intervalDays: 1, dueAt, lapses: 0, reps: 2,
  lastSeenAt: dueAt,
});

/** 40 cards per domain, ids like "cs-3". */
const manyCards = (): Card[] =>
  DOMAINS.flatMap((d) => Array.from({ length: 40 }, (_, i) => mkCard(`${d}-${i}`, d)));

const fakeCorpus = (cards: Card[]) => ({
  getUnseen: (seen: Set<string>, domain?: Domain) =>
    cards.filter((c) => !seen.has(c.id) && (domain === undefined || c.domain === domain)),
  getCard: (id: string) => cards.find((c) => c.id === id),
});

const fakeStore = (due: CardState[], seen: Set<string> = new Set()) => ({
  getDue: (now: number, limit: number) =>
    due.filter((s) => s.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt).slice(0, limit),
  getSeenIds: () => seen,
});

describe("nextChunk", () => {
  it("serves only new cards when nothing is due", () => {
    const cards = manyCards();
    const deps = { corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid };
    const items = nextChunk(deps, createSession(mid), 10);
    expect(items.length).toBe(10);
    expect(items.every((i) => i.kind === "new-concept")).toBe(true);
  });

  it("emits new-puzzle for puzzle cards", () => {
    const cards = [mkCard("cs-0", "cs", "puzzle")];
    const deps = { corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid };
    expect(nextChunk(deps, createSession(mid), 1)[0].kind).toBe("new-puzzle");
  });

  it("interleaves a review every 3-5 new cards", () => {
    const cards = manyCards();
    const due = cards.slice(0, 5).map((c, i) => mkState(c.id, NOW - (5 - i) * 1000));
    const seen = new Set(due.map((d) => d.cardId));
    const deps = { corpus: fakeCorpus(cards), store: fakeStore(due, seen), now: NOW, rng: mid };
    const items = nextChunk(deps, createSession(mid), 20);
    const positions = items.flatMap((it, i) => (it.kind === "review" ? [i] : []));
    expect(positions.length).toBeGreaterThan(0);
    for (const p of positions) expect(p).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < positions.length; i++) {
      const gap = positions[i] - positions[i - 1];
      expect(gap).toBeGreaterThanOrEqual(4);
      expect(gap).toBeLessThanOrEqual(6);
    }
  });

  it("serves the most overdue review first", () => {
    const cards = manyCards();
    const due = [mkState("cs-0", NOW - 1000), mkState("cs-1", NOW - 9_000_000)];
    const seen = new Set(["cs-0", "cs-1"]);
    const deps = { corpus: fakeCorpus(cards), store: fakeStore(due, seen), now: NOW, rng: mid };
    const items = nextChunk(deps, createSession(mid), 20);
    const first = items.find((i) => i.kind === "review");
    expect(first && first.kind === "review" && first.card.id).toBe("cs-1");
  });

  it("never repeats a card within a session", () => {
    const cards = manyCards();
    const deps = { corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid };
    const s = createSession(mid);
    const ids = [...nextChunk(deps, s, 40), ...nextChunk(deps, s, 40)]
      .flatMap((i) => (i.kind === "caught-up" ? [] : [i.card.id]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("caps reviews per session even with a huge backlog", () => {
    const cards = manyCards();
    const due = cards.map((c, i) => mkState(c.id, NOW - (i + 1) * 1000));
    const seen = new Set(due.map((d) => d.cardId));
    const deps = { corpus: fakeCorpus(cards), store: fakeStore(due, seen), now: NOW, rng: mid };
    const s = createSession(mid);
    let reviews = 0;
    for (let i = 0; i < 40; i++)
      reviews += nextChunk(deps, s, 10).filter((it) => it.kind === "review").length;
    expect(reviews).toBe(REVIEW_CAP_PER_SESSION);
  });

  it("round-robins domains rather than clumping", () => {
    const cards = manyCards();
    const deps = { corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid };
    const items = nextChunk(deps, createSession(mid), 8);
    const domains = items.flatMap((i) => (i.kind === "caught-up" ? [] : [i.card.domain]));
    expect(new Set(domains).size).toBe(4);
    for (let i = 1; i < domains.length; i++) expect(domains[i]).not.toBe(domains[i - 1]);
  });

  it("emits caught-up and stops when nothing is left", () => {
    const cards = [mkCard("cs-0", "cs")];
    const deps = { corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid };
    const items = nextChunk(deps, createSession(mid), 10);
    expect(items.length).toBe(2);
    expect(items[1].kind).toBe("caught-up");
  });

  it("falls back to due reviews when new cards run out, ignoring the gap", () => {
    const cards = [mkCard("cs-0", "cs")];
    const due = [mkState("old-1", NOW - 1000)];
    const corpus = fakeCorpus([...cards, mkCard("old-1", "cs")]);
    const deps = {
      corpus: { ...corpus, getUnseen: (seen: Set<string>) => cards.filter((c) => !seen.has(c.id)) },
      store: fakeStore(due, new Set(["old-1"])), now: NOW, rng: mid,
    };
    const items = nextChunk(deps, createSession(mid), 5);
    expect(items.some((i) => i.kind === "review")).toBe(true);
  });

  it("serves only cs new cards when filtered to domains=[cs]", () => {
    const cards = manyCards();
    const deps = {
      corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid, domains: ["cs"] as Domain[],
    };
    const items = nextChunk(deps, createSession(mid), 12);
    const domains = items.flatMap((i) => (i.kind === "caught-up" ? [] : [i.card.domain]));
    expect(domains.length).toBe(12);
    expect(domains.every((d) => d === "cs")).toBe(true);
  });

  it("serves only cs reviews when filtered to domains=[cs], skipping other-domain dues", () => {
    const cards = manyCards();
    // math-0 is the most overdue, but the cs filter must skip it in favor of cs-0.
    const due = [mkState("math-0", NOW - 9_000_000), mkState("cs-0", NOW - 1000)];
    const seen = new Set(["math-0", "cs-0"]);
    const deps = {
      corpus: fakeCorpus(cards), store: fakeStore(due, seen), now: NOW, rng: mid,
      domains: ["cs"] as Domain[],
    };
    const items = nextChunk(deps, createSession(mid), 20);
    const reviews = items.flatMap((i) => (i.kind === "review" ? [i.card.id] : []));
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews.every((id) => id.startsWith("cs-"))).toBe(true);
    expect(reviews).not.toContain("math-0");
  });

  it("treats an empty domains filter as all domains (no regression)", () => {
    const cards = manyCards();
    const deps = {
      corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid, domains: [] as Domain[],
    };
    const items = nextChunk(deps, createSession(mid), 8);
    const domains = items.flatMap((i) => (i.kind === "caught-up" ? [] : [i.card.domain]));
    expect(new Set(domains).size).toBe(4);
    for (let i = 1; i < domains.length; i++) expect(domains[i]).not.toBe(domains[i - 1]);
  });

  it("never pulls undue reviews forward to fill space", () => {
    const cards = [mkCard("cs-0", "cs")];
    const due = [mkState("future-1", NOW + 9_000_000)];
    const deps = {
      corpus: { getUnseen: (seen: Set<string>) => cards.filter((c) => !seen.has(c.id)),
                getCard: (id: string) => mkCard(id, "cs") },
      store: fakeStore(due, new Set(["future-1"])), now: NOW, rng: mid,
    };
    const items: FeedItem[] = nextChunk(deps, createSession(mid), 5);
    expect(items.some((i) => i.kind === "review")).toBe(false);
    expect(items[items.length - 1].kind).toBe("caught-up");
  });
});
