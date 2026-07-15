import { BODY_MAX_WORDS, BODY_MIN_WORDS, DOMAINS } from "../constants";
import type { Card, Domain } from "../types";

export const countWords = (s: string): number =>
  s.trim() === "" ? 0 : s.trim().split(/\s+/).length;

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isStrArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

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
  if (!isStr(c.answer)) e.push(`${where}: answer required`);
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
  }
  return e;
}

export const isCard = (raw: unknown): raw is Card =>
  typeof raw === "object" && raw !== null &&
  DOMAINS.includes((raw as Record<string, unknown>).domain as Domain) &&
  validateCard(raw, (raw as Card).domain).length === 0;
