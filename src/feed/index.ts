import {
  DOMAINS, REVIEW_CAP_PER_SESSION, REVIEW_GAP_MAX, REVIEW_GAP_MIN,
} from "../constants";
import type { Card, CardState, Domain, FeedItem, Rng, Session } from "../types";

export type CorpusPort = {
  getUnseen(seen: Set<string>, domain?: Domain): Card[];
  getCard(id: string): Card | undefined;
};

export type StorePort = {
  getDue(now: number, limit: number): CardState[];
  getSeenIds(): Set<string>;
};

export type FeedDeps = { corpus: CorpusPort; store: StorePort; now: number; rng: Rng };

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
  for (const st of due) {
    if (s.servedIds.has(st.cardId)) continue;
    const card = deps.corpus.getCard(st.cardId);
    if (card) return card;
  }
  return undefined;
}

function takeNew(deps: FeedDeps, s: Session): Card | undefined {
  const seen = new Set([...deps.store.getSeenIds(), ...s.servedIds]);
  for (let i = 0; i < DOMAINS.length; i++) {
    const domain = DOMAINS[(s.domainCursor + i) % DOMAINS.length];
    const pool = deps.corpus.getUnseen(seen, domain);
    if (pool.length === 0) continue;
    s.domainCursor = (s.domainCursor + i + 1) % DOMAINS.length;
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
