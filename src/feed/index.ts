import {
  DOMAINS, LEVELS, REVIEW_CAP_PER_SESSION, REVIEW_GAP_MAX, REVIEW_GAP_MIN,
} from "../constants";
import type { Card, CardState, Domain, FeedItem, Level, Rng, Session } from "../types";

export type CorpusPort = {
  getUnseen(seen: Set<string>, domain?: Domain): Card[];
  getCard(id: string): Card | undefined;
};

export type StorePort = {
  getDue(now: number, limit: number): CardState[];
  getSeenIds(): Set<string>;
};

export type FeedDeps = {
  corpus: CorpusPort;
  store: StorePort;
  now: number;
  rng: Rng;
  domains?: Domain[]; // undefined or empty array = all domains (no filter)
  levels?: Level[];   // undefined or empty array = all levels (no filter)
};

// The domains this session draws from. An absent or empty filter means all domains,
// so the unfiltered path stays identical to the pre-filter behavior.
const activeDomains = (deps: FeedDeps): Domain[] =>
  deps.domains && deps.domains.length > 0 ? deps.domains : DOMAINS;

// The levels this session draws from. An absent or empty filter means all levels, so
// the unfiltered path stays identical to the pre-filter behavior.
const activeLevels = (deps: FeedDeps): Level[] =>
  deps.levels && deps.levels.length > 0 ? deps.levels : LEVELS;

const drawGap = (rng: Rng): number =>
  REVIEW_GAP_MIN + Math.floor(rng() * (REVIEW_GAP_MAX - REVIEW_GAP_MIN + 1));

export function createSession(rng: Rng): Session {
  return {
    servedIds: new Set<string>(),
    reviewsServed: 0,
    newSinceReview: 0,
    nextReviewGap: drawGap(rng),
    domainCursor: 0,
  };
}

function takeReview(deps: FeedDeps, s: Session): Card | undefined {
  if (s.reviewsServed >= REVIEW_CAP_PER_SESSION) return undefined;
  // Over-fetch so cards already served this session don't hide the rest of the queue.
  const due = deps.store.getDue(deps.now, REVIEW_CAP_PER_SESSION + s.servedIds.size + 1);
  const domains = activeDomains(deps);
  const levels = activeLevels(deps);
  for (const st of due) {
    if (s.servedIds.has(st.cardId)) continue;
    const card = deps.corpus.getCard(st.cardId);
    // Skip due cards outside the selected subjects or levels. With no filter every
    // subject and level is active, so this check is a no-op.
    if (card && domains.includes(card.domain) && levels.includes(card.difficulty)) return card;
  }
  return undefined;
}

function takeNew(deps: FeedDeps, s: Session): Card | undefined {
  const seen = new Set([...deps.store.getSeenIds(), ...s.servedIds]);
  // Round-robin only within the selected domains (all four when unfiltered).
  const domains = activeDomains(deps);
  const levels = activeLevels(deps);
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[(s.domainCursor + i) % domains.length];
    const pool = deps.corpus
      .getUnseen(seen, domain)
      .filter((c) => levels.includes(c.difficulty));
    if (pool.length === 0) continue;
    s.domainCursor = (s.domainCursor + i + 1) % domains.length;
    return pool[Math.floor(deps.rng() * pool.length)];
  }
  return undefined;
}

const emitNew = (card: Card): FeedItem =>
  card.type === "puzzle" ? { kind: "new-puzzle", card } : { kind: "new-concept", card };

export function nextChunk(deps: FeedDeps, s: Session, size: number): FeedItem[] {
  const out: FeedItem[] = [];

  for (let i = 0; i < size; i++) {
    const wantsReview = s.newSinceReview >= s.nextReviewGap;

    if (wantsReview) {
      const card = takeReview(deps, s);
      if (card) {
        out.push({ kind: "review", card });
        s.servedIds.add(card.id);
        s.reviewsServed += 1;
        s.newSinceReview = 0;
        s.nextReviewGap = drawGap(deps.rng);
        continue;
      }
    }

    const fresh = takeNew(deps, s);
    if (fresh) {
      out.push(emitNew(fresh));
      s.servedIds.add(fresh.id);
      s.newSinceReview += 1;
      continue;
    }

    // Out of new cards: a due review is better than an empty feed, gap be damned.
    const fallback = takeReview(deps, s);
    if (fallback) {
      out.push({ kind: "review", card: fallback });
      s.servedIds.add(fallback.id);
      s.reviewsServed += 1;
      s.newSinceReview = 0;
      continue;
    }

    out.push({ kind: "caught-up" });
    break;
  }

  return out;
}
