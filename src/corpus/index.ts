import csRaw from "../../corpus/cs.json";
import financeRaw from "../../corpus/finance.json";
import mathRaw from "../../corpus/math.json";
import scienceRaw from "../../corpus/science.json";
import { isCard } from "./schema";
import { DOMAINS } from "../constants";
import type { Card, Domain } from "../types";

let cache: Card[] | null = null;
let index: Map<string, Card> | null = null;

/** Build-time validation makes invalid cards near-impossible; dropping them is defense in depth. */
export function loadCorpus(): Card[] {
  if (cache) return cache;
  const raw: unknown[] = [
    ...(csRaw as unknown[]), ...(financeRaw as unknown[]),
    ...(mathRaw as unknown[]), ...(scienceRaw as unknown[]),
  ];
  cache = raw.filter(isCard);
  index = new Map(cache.map((c) => [c.id, c]));
  return cache;
}

export function getCard(id: string): Card | undefined {
  loadCorpus();
  return index!.get(id);
}

export function getUnseen(seenIds: Set<string>, domain?: Domain): Card[] {
  return loadCorpus().filter(
    (c) => !seenIds.has(c.id) && (domain === undefined || c.domain === domain),
  );
}

export function allIds(): string[] {
  return loadCorpus().map((c) => c.id);
}

// Corpus card count per domain, for the stats screen's per-domain totals. Seeded from
// DOMAINS so every domain reports a number even if its file were empty.
export function countByDomain(): Record<Domain, number> {
  const counts = {} as Record<Domain, number>;
  for (const d of DOMAINS) counts[d] = 0;
  for (const c of loadCorpus()) counts[c.domain] += 1;
  return counts;
}
