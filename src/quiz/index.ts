import { DOMAINS } from "../constants";
import type { Card, CardState, Domain, QuizAnswer, Rng } from "../types";

export type QuizOptions = {
  size: number;
  domains: Domain[]; // empty = every domain
};

export type QuizDeps = {
  cards: Card[];
  stateOf: (cardId: string) => CardState | undefined;
  now: number;
  rng: Rng;
};

export type QuizSummary = {
  total: number;
  correct: number;
  /** Whole-percent accuracy. 0 for an empty run rather than NaN. */
  pct: number;
  missed: string[]; // card ids graded "missed", in answer order
};

/** In-place Fisher-Yates against the injected rng, so a seeded rng gives a fixed order. */
function shuffle<T>(xs: T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A quiz is worth most when it tests what is about to be forgotten, so questions are
// drawn in tiers: cards already due, then cards seen but not yet due, then cards never
// seen. Each tier is shuffled independently, so the run varies between attempts while
// the priority between tiers stays fixed.
export function buildQuiz(deps: QuizDeps, opts: QuizOptions): Card[] {
  const domains = opts.domains.length > 0 ? opts.domains : DOMAINS;

  const due: Card[] = [];
  const seen: Card[] = [];
  const fresh: Card[] = [];

  for (const card of deps.cards) {
    if (!domains.includes(card.domain)) continue;
    const state = deps.stateOf(card.id);
    if (!state) fresh.push(card);
    else if (state.dueAt <= deps.now) due.push(card);
    else seen.push(card);
  }

  return [
    ...shuffle(due, deps.rng),
    ...shuffle(seen, deps.rng),
    ...shuffle(fresh, deps.rng),
  ].slice(0, Math.max(0, opts.size));
}

export function summarize(answers: QuizAnswer[]): QuizSummary {
  const correct = answers.filter((a) => a.grade === "got").length;
  const total = answers.length;
  return {
    total,
    correct,
    pct: total === 0 ? 0 : Math.round((correct / total) * 100),
    missed: answers.filter((a) => a.grade === "missed").map((a) => a.cardId),
  };
}
