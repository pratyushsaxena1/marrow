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
});

describe("isCard", () => {
  it("narrows valid cards and rejects junk", () => {
    expect(isCard(valid)).toBe(true);
    expect(isCard({ id: "x" })).toBe(false);
  });
});
