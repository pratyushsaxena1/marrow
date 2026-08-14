import { BODY_MAX_WORDS, BODY_MIN_WORDS, DOMAINS } from "../constants";
import type { Card, Domain } from "../types";

export const countWords = (s: string): number =>
  s.trim() === "" ? 0 : s.trim().split(/\s+/).length;

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isStrArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

// Common abbreviations that end in "." but do not end a sentence. Matched as
// whole words (case-insensitive) so "e.g." inside a sentence is neutralised
// before boundary detection runs.
const ABBREVIATIONS = [
  "e.g.",
  "i.e.",
  "etc.",
  "vs.",
  "approx.",
  "Dr.",
  "Mr.",
  "Mrs.",
  "Ms.",
  "Prof.",
  "Jr.",
  "Sr.",
  "St.",
];

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Replaces the periods inside known abbreviations, and inside single-capital-letter
// initials/acronyms (covers "U.S.", "U.K.", "J. Smith"), with a placeholder that
// cannot match the sentence-boundary regex. Operates on a local working copy only —
// the card's answer text is never mutated.
const neutraliseAbbreviations = (s: string): string => {
  let out = s;
  for (const abbr of ABBREVIATIONS) {
    const re = new RegExp(`\\b${escapeRegExp(abbr)}`, "gi");
    out = out.replace(re, (m) => m.replace(/\./g, "\0"));
  }
  out = out.replace(/\b[A-Z]\./g, (m) => m.replace(".", "\0"));
  // Factorial notation: a "!" directly after a digit is an operator, not the end of
  // a sentence, so "1 - 1/1! + 1/2! - 1/3!" is one sentence rather than four. The
  // digit prefix makes this unambiguous, since an exclamation ending a real sentence
  // is preceded by a letter or closing punctuation.
  out = out.replace(/(\d)!/g, "$1\0");
  return out;
};

// Counts sentences by counting terminal punctuation (. ! ?) that is followed,
// optionally through closing quotes/brackets, by whitespace or end-of-string.
// Requiring whitespace/EOS after the punctuation (rather than matching every
// ".", "!", "?") means a decimal like "3.14" does not get miscounted as a
// sentence boundary, since the "." there is immediately followed by a digit,
// not whitespace/quote/bracket. Allowing closing quotes/brackets between the
// punctuation and the boundary means a sentence ending in a quoted term (e.g.
// `...is called "closure." It captures...`) is still counted, since the `.`
// there is followed by `"` and then whitespace. Before counting, common
// abbreviations (e.g., i.e., etc., vs., Dr., ...) and single-capital-letter
// initials/acronyms (U.S., U.K., J.) are neutralised in a working copy so they
// are not mistaken for sentence boundaries. A string with no terminal
// punctuation at all counts as exactly one sentence.
//
// Known limits: a sentence that deliberately *ends* in a bare single capital
// letter (e.g. "...we call it N.") will be under-counted, since that pattern
// is indistinguishable from an initial. This is a reasonable heuristic, not a
// parser — it is expected to be re-tuned if the corpus surfaces a real case.
const countSentences = (s: string): number => {
  const trimmed = s.trim();
  if (trimmed === "") return 0;
  const working = neutraliseAbbreviations(trimmed);
  const matches = working.match(/[.!?]+["')\]’”]*(?=\s|$)/g);
  return matches ? matches.length : 1;
};

export function validateCard(raw: unknown, domain: Domain): string[] {
  const e: string[] = [];
  if (typeof raw !== "object" || raw === null) return ["card is not an object"];
  const c = raw as Record<string, unknown>;
  const where = isStr(c.id) ? c.id : "<no id>";

  if (!isStr(c.id)) e.push(`${where}: id must be a non-empty string`);
  if (c.type !== "concept" && c.type !== "puzzle") e.push(`${where}: type must be concept|puzzle`);
  if (!DOMAINS.includes(c.domain as Domain)) e.push(`${where}: unknown domain`);
  else if (c.domain !== domain) e.push(`${where}: domain "${String(c.domain)}" does not match file domain "${domain}"`);
  if (!isStr(c.topic)) e.push(`${where}: topic required`);
  if (!isStr(c.title)) e.push(`${where}: title required`);
  if (!isStr(c.prompt)) e.push(`${where}: prompt required`);
  if (!isStr(c.answer)) {
    e.push(`${where}: answer required`);
  } else {
    const n = countSentences(c.answer);
    if (n < 1 || n > 3) e.push(`${where}: answer has ${n} sentences, must be 1-3`);
  }
  if (c.difficulty !== 1 && c.difficulty !== 2 && c.difficulty !== 3)
    e.push(`${where}: difficulty must be 1|2|3`);
  if (!isStrArray(c.tags)) e.push(`${where}: tags must be string[]`);

  if (!isStr(c.body)) {
    e.push(`${where}: body required`);
  } else {
    const n = countWords(c.body);
    if (n < BODY_MIN_WORDS) e.push(`${where}: body has ${n} words, minimum 40`);
    if (n > BODY_MAX_WORDS) e.push(`${where}: body has ${n} words, maximum 90`);
  }

  if (!isStrArray(c.sources)) {
    e.push(`${where}: sources must be string[]`);
  } else {
    if (c.type === "concept" && c.sources.length === 0)
      e.push(`${where}: concept cards require at least one source`);
    for (const s of c.sources)
      if (!s.startsWith("https://")) e.push(`${where}: source must be https: ${s}`);
  }
  return e;
}

export function validateCorpus(cards: unknown[], domain: Domain): string[] {
  const e: string[] = [];
  cards.forEach((c) => e.push(...validateCard(c, domain)));
  const seenIds = new Set<string>();
  const seenPrompts = new Set<string>();
  const topicCounts = new Map<string, number>();
  for (const c of cards) {
    if (typeof c !== "object" || c === null) continue;
    const r = c as Record<string, unknown>;
    if (typeof r.id === "string") {
      if (seenIds.has(r.id)) e.push(`duplicate id: ${r.id}`);
      seenIds.add(r.id);
    }
    if (typeof r.prompt === "string") {
      const key = r.prompt.trim().toLowerCase();
      if (seenPrompts.has(key)) e.push(`duplicate prompt: ${r.prompt}`);
      seenPrompts.add(key);
    }
    if (typeof r.topic === "string") {
      const key = r.topic.trim().toLowerCase();
      topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [topic, count] of topicCounts)
    if (count > 2) e.push(`topic "${topic}" has ${count} cards, maximum 2 per file`);

  // Ids must match <domain>-NNNN and be unique within the file (checked above), but
  // are NOT required to be sequential / gap-free. card_state.cardId (see
  // src/store/index.ts) is keyed on the card id, so ids are durable user-data keys,
  // not display ordinals. A sequence/no-gaps rule would force renumbering every card
  // after a deleted one, silently orphaning those cards' persisted review history
  // (the row would no longer match any card id). Deleting bad cards is routine as
  // the corpus grows, so gaps are correct and expected — do not reintroduce a
  // sequence check here.
  const idFormat = new RegExp(`^${domain}-\\d{4}$`);
  cards.forEach((c) => {
    if (typeof c !== "object" || c === null) return;
    const r = c as Record<string, unknown>;
    if (typeof r.id !== "string") return;
    if (!idFormat.test(r.id)) e.push(`id "${r.id}" does not match format ${domain}-NNNN`);
  });

  return e;
}

// Note: this passes the card's own domain as the expected domain, so the
// domain-match check inside validateCard can never fire here. That is
// intentional, not a bug: isCard is a runtime filter used by the corpus
// loader, which merges all four domain files into one array, where a card
// only needs to have *some* valid domain. Cross-file domain mismatches (e.g. a
// card living in math.json but declaring domain "cs") are caught at build
// time by validate-corpus, which calls validateCard with the real file
// domain instead. Do not "fix" this tautology.
export const isCard = (raw: unknown): raw is Card =>
  typeof raw === "object" && raw !== null &&
  DOMAINS.includes((raw as Record<string, unknown>).domain as Domain) &&
  validateCard(raw, (raw as Card).domain).length === 0;
