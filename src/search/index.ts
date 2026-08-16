import type { Card, CardState, CardStatus, Domain, Level } from "../types";

export type StatusFilter = "all" | "new" | "learning" | "mastered" | "due";

export type Query = {
  text: string;
  domains: Domain[]; // empty = every domain
  levels: Level[];   // empty = every level
  status: StatusFilter;
  savedOnly: boolean;
};

export type SearchDeps = {
  cards: Card[];
  stateOf: (cardId: string) => CardState | undefined;
  saved: Set<string>;
  now: number;
};

export const EMPTY_QUERY: Query = { text: "", domains: [], levels: [], status: "all", savedOnly: false };

/** A card with no state has never been seen. Two clean reps promote it to review, and
 *  that is what the rest of the app calls "mastered". */
export function statusOf(state: CardState | undefined): CardStatus {
  if (!state) return "new";
  return state.status === "review" ? "mastered" : "learning";
}

// Field weights. A hit in the title says far more about relevance than a hit buried in
// the body, so the same term scores differently depending on where it lands.
const FIELDS: Array<{ get: (c: Card) => string; weight: number }> = [
  { get: (c) => c.title, weight: 8 },
  { get: (c) => c.topic, weight: 5 },
  { get: (c) => c.tags.join(" "), weight: 4 },
  { get: (c) => c.prompt, weight: 3 },
  { get: (c) => c.answer, weight: 2 },
  { get: (c) => c.body, weight: 1 },
];

export const terms = (text: string): string[] =>
  text.toLowerCase().trim().split(/\s+/).filter((t) => t.length > 0);

// Scores one term against one card, returning 0 when the term appears nowhere. A match
// that starts a word outranks one in the middle of a word ("net" in "network" beats
// "net" in "subnet"), which keeps short queries from being dominated by incidental
// substrings.
function scoreTerm(card: Card, term: string): number {
  let best = 0;
  for (const field of FIELDS) {
    const hay = field.get(card).toLowerCase();
    const at = hay.indexOf(term);
    if (at === -1) continue;
    const atWordStart = at === 0 || /\W/.test(hay[at - 1]);
    const score = field.weight * (atWordStart ? 2 : 1);
    if (score > best) best = score;
  }
  return best;
}

// All terms must match somewhere (AND semantics): typing a second word should narrow
// the list, not widen it. Returns 0 to mean "not a match" so callers can filter on it.
export function scoreCard(card: Card, ts: string[]): number {
  let total = 0;
  for (const t of ts) {
    const s = scoreTerm(card, t);
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

function passesStatus(filter: StatusFilter, state: CardState | undefined, now: number): boolean {
  if (filter === "all") return true;
  if (filter === "due") return state !== undefined && state.dueAt <= now;
  return statusOf(state) === filter;
}

/** Filters the corpus by subject, status and saved-state, then ranks whatever survives.
 *  With no search text every match keeps score 0 and the list stays in corpus order, so
 *  browsing (no query) is stable and alphabetical-by-id rather than arbitrary. */
export function searchCards(deps: SearchDeps, q: Query): Card[] {
  const ts = terms(q.text);
  const scored: Array<{ card: Card; score: number; i: number }> = [];

  deps.cards.forEach((card, i) => {
    if (q.domains.length > 0 && !q.domains.includes(card.domain)) return;
    if (q.levels.length > 0 && !q.levels.includes(card.difficulty)) return;
    if (q.savedOnly && !deps.saved.has(card.id)) return;
    if (!passesStatus(q.status, deps.stateOf(card.id), deps.now)) return;
    const score = ts.length === 0 ? 0 : scoreCard(card, ts);
    if (ts.length > 0 && score === 0) return;
    scored.push({ card, score, i });
  });

  // Ties fall back to corpus order so the same query always renders the same list.
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return scored.map((s) => s.card);
}

/** Cards adjacent to `card`, for the "Related" strip on a card's detail screen.
 *  Relatedness is scored, not filtered, so a card always has neighbours to offer:
 *  sharing a topic is the strongest signal, then each shared tag, then merely sharing
 *  a subject. Cards with nothing in common score 0 and are left out. */
export function related(card: Card, cards: Card[], limit: number): Card[] {
  const tags = new Set(card.tags);
  const scored: Array<{ card: Card; score: number; i: number }> = [];

  cards.forEach((other, i) => {
    if (other.id === card.id) return;
    let score = 0;
    if (other.topic === card.topic) score += 6;
    for (const t of other.tags) if (tags.has(t)) score += 3;
    if (other.domain === card.domain) score += 1;
    if (score <= 1) return; // same subject alone is too weak to call "related"
    scored.push({ card: other, score, i });
  });

  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return scored.slice(0, Math.max(0, limit)).map((s) => s.card);
}
