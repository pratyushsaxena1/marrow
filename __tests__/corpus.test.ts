import { validateCard, isCard, countWords, validateCorpus } from "../src/corpus/schema";
import type { Card } from "../src/types";

const body = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");

const valid: Card = {
  id: "cs-0001",
  type: "concept",
  domain: "cs",
  topic: "amortized analysis",
  title: "Why appending to a dynamic array is O(1)",
  body,
  prompt: "Why is dynamic array append O(1) amortized?",
  answer: "Doubling makes copies rare enough that total copy work is linear.",
  difficulty: 2,
  sources: ["https://en.wikipedia.org/wiki/Dynamic_array"],
  tags: ["data-structures"],
};

describe("countWords", () => {
  it("counts whitespace-separated tokens and ignores extra whitespace", () => {
    expect(countWords("  one   two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("validateCard", () => {
  it("accepts a well-formed card", () => {
    expect(validateCard(valid, "cs")).toEqual([]);
  });

  it("rejects a body shorter than 40 words", () => {
    const errs = validateCard({ ...valid, body: "too short" }, "cs");
    expect(errs.some((e) => /body.*40/.test(e))).toBe(true);
  });

  it("rejects a body longer than 90 words", () => {
    const long = Array.from({ length: 100 }, () => "w").join(" ");
    const errs = validateCard({ ...valid, body: long }, "cs");
    expect(errs.some((e) => /body.*90/.test(e))).toBe(true);
  });

  it("requires at least one source on concept cards", () => {
    const errs = validateCard({ ...valid, sources: [] }, "cs");
    expect(errs.some((e) => /source/i.test(e))).toBe(true);
  });

  it("allows puzzle cards with no sources", () => {
    expect(validateCard({ ...valid, type: "puzzle", sources: [] }, "cs")).toEqual([]);
  });

  it("rejects a card whose domain does not match its file", () => {
    const errs = validateCard({ ...valid, domain: "math" }, "cs");
    expect(errs.some((e) => /domain/i.test(e))).toBe(true);
  });

  it("rejects http sources — https only", () => {
    const errs = validateCard({ ...valid, sources: ["http://example.com"] }, "cs");
    expect(errs.some((e) => /https/i.test(e))).toBe(true);
  });

  it("rejects missing and malformed fields", () => {
    expect(validateCard({}, "cs").length).toBeGreaterThan(0);
    expect(validateCard({ ...valid, difficulty: 9 }, "cs").length).toBeGreaterThan(0);
    expect(validateCard({ ...valid, id: "" }, "cs").length).toBeGreaterThan(0);
    expect(validateCard(null, "cs").length).toBeGreaterThan(0);
  });

  it("accepts a 1-3 sentence answer", () => {
    expect(validateCard({ ...valid, answer: "One. Two. Three." }, "cs")).toEqual([]);
  });

  it("rejects a 4-sentence answer", () => {
    const errs = validateCard({ ...valid, answer: "One. Two. Three. Four." }, "cs");
    expect(errs.some((e) => /answer.*sentence/i.test(e))).toBe(true);
  });

  it("does not count decimal points or trailing abbreviations as sentence boundaries", () => {
    const errs = validateCard(
      { ...valid, answer: "Pi is roughly 3.14 and e is roughly 2.71, both irrational." },
      "cs",
    );
    expect(errs).toEqual([]);
  });

  it("counts a sentence ending in a closing quote as a real boundary (not undercounted)", () => {
    // 4 real sentences, the first ends in a quoted term (`."`). If the quote/bracket
    // boundary were missed, this would undercount to 3 and wrongly validate.
    const answer =
      'The idea is called "closure." It captures the enclosing scope. It runs later. It persists state.';
    const errs = validateCard({ ...valid, answer }, "cs");
    expect(errs.some((e) => /answer has 4 sentences/i.test(e))).toBe(true);
  });

  it("still accepts a valid answer whose only sentence ends in a closing quote", () => {
    const answer = 'The idea is called "closure." It captures the enclosing scope.';
    expect(validateCard({ ...valid, answer }, "cs")).toEqual([]);
  });

  it("does not inflate the count on common mid-sentence abbreviations", () => {
    // Each of these is exactly 3 real sentences with one abbreviation embedded
    // mid-sentence. If the abbreviation's period were wrongly treated as a sentence
    // boundary, the count would inflate to 4 and the (legitimate) answer would be
    // rejected.
    const cases = [
      "Many languages support closures, e.g. Python and JavaScript. They allow deferred execution. This pattern is common in practice.",
      "Closures capture scope, i.e. the variables visible at definition time. They keep those variables alive by reference. This lets them persist state.",
      "This pattern is common in the U.S. and elsewhere in modern languages. It shows up in many codebases. Developers should understand it well.",
      "Dr. Smith explained the theorem clearly to the students. She used concrete examples throughout. The class understood it well.",
      "Interpreted languages, Python, Ruby, etc. add closure overhead at runtime. Compiled languages avoid much of this cost. The difference matters for performance-critical code.",
      "Compiled languages behave differently vs. interpreted ones when closures are used. The gap has narrowed with modern JIT compilers. Most developers no longer notice it.",
    ];
    for (const answer of cases) {
      const errs = validateCard({ ...valid, answer }, "cs");
      expect(errs).toEqual([]);
    }
  });
});

describe("validateCorpus", () => {
  it("flags duplicate ids", () => {
    const errs = validateCorpus([valid, { ...valid }], "cs");
    expect(errs.some((e) => /duplicate/i.test(e))).toBe(true);
  });

  it("flags duplicate prompts", () => {
    const errs = validateCorpus([valid, { ...valid, id: "cs-0002" }], "cs");
    expect(errs.some((e) => /duplicate/i.test(e))).toBe(true);
  });

  it("flags more than 2 cards sharing a topic (case- and whitespace-insensitive)", () => {
    const errs = validateCorpus(
      [
        { ...valid, id: "cs-0001", prompt: "p1", topic: "Amortized Analysis" },
        { ...valid, id: "cs-0002", prompt: "p2", topic: "amortized analysis" },
        { ...valid, id: "cs-0003", prompt: "p3", topic: "  Amortized Analysis  " },
      ],
      "cs",
    );
    expect(errs.some((e) => /topic/i.test(e))).toBe(true);
  });

  it("allows up to 2 cards sharing a topic", () => {
    const errs = validateCorpus(
      [
        { ...valid, id: "cs-0001", prompt: "p1" },
        { ...valid, id: "cs-0002", prompt: "p2" },
      ],
      "cs",
    );
    expect(errs.some((e) => /topic/i.test(e))).toBe(false);
  });

  it("flags an id that does not match the domain-NNNN format", () => {
    const errs = validateCorpus([{ ...valid, id: "cs-1" }], "cs");
    expect(errs.some((e) => /format/i.test(e))).toBe(true);
  });

  it("accepts sequential, well-formed ids with no gaps", () => {
    const errs = validateCorpus(
      [
        { ...valid, id: "cs-0001", prompt: "p1", topic: "a" },
        { ...valid, id: "cs-0002", prompt: "p2", topic: "b" },
      ],
      "cs",
    );
    expect(errs.filter((e) => /format|sequence/i.test(e))).toEqual([]);
  });

  it("accepts an id gap left by a deleted card — ids are stable keys, not ordinals", () => {
    // card_state.cardId (src/store/index.ts) keys user progress on the card id, so a
    // gap left by deleting a card must be valid, not an error. A sequence/no-gaps rule
    // would force renumbering every later card, silently orphaning their persisted
    // review history.
    const errs = validateCorpus(
      [
        { ...valid, id: "cs-0001", prompt: "p1", topic: "a" },
        { ...valid, id: "cs-0003", prompt: "p2", topic: "b" },
      ],
      "cs",
    );
    expect(errs.filter((e) => /format|sequence/i.test(e))).toEqual([]);
  });
});

describe("isCard", () => {
  it("narrows valid cards and rejects junk", () => {
    expect(isCard(valid)).toBe(true);
    expect(isCard({ id: "x" })).toBe(false);
  });
});

import { loadCorpus, getCard, getUnseen, allIds } from "../src/corpus";
import { DOMAINS } from "../src/constants";

describe("corpus module", () => {
  it("loads all 230 cards with unique ids", () => {
    const cards = loadCorpus();
    expect(cards.length).toBe(230);
    expect(new Set(cards.map((c) => c.id)).size).toBe(230);
  });

  it("covers every domain", () => {
    const domains = new Set(loadCorpus().map((c) => c.domain));
    for (const d of DOMAINS) expect(domains.has(d)).toBe(true);
  });

  it("looks up a card by id and misses cleanly", () => {
    const first = loadCorpus()[0];
    expect(getCard(first.id)).toEqual(first);
    expect(getCard("nope-9999")).toBeUndefined();
  });

  it("excludes seen cards and filters by domain", () => {
    const all = loadCorpus();
    const seen = new Set([all[0].id]);
    expect(getUnseen(seen).some((c) => c.id === all[0].id)).toBe(false);
    expect(getUnseen(new Set(), "cs").every((c) => c.domain === "cs")).toBe(true);
  });

  it("returns every id", () => {
    expect(allIds().length).toBe(230);
  });
});
