import { DAY_MS, DOMAINS } from "../constants";
import type { CardState, Domain, ReviewLogEntry } from "../types";

export type DomainStat = { seen: number; total: number };

export type Stats = {
  learned: number;   // number of card_state rows (cards seen at least once)
  mastered: number;  // rows where status === "review"
  dueToday: number;  // rows where dueAt <= now
  perDomain: Record<Domain, DomainStat>;
};

export type StatsDeps = {
  states: CardState[];
  now: number;
  domainOf: (cardId: string) => Domain | undefined; // resolve a card id to its domain (via corpus.getCard in real use)
  totals: Record<Domain, number>;                   // corpus counts per domain
};

// Derives all figures from card_state at read time, so there is no separate tracking
// to keep in sync. perDomain is seeded for every domain up front so the UI can render
// a stable four-row breakdown even before any card in a domain has been seen. An id
// that domainOf cannot resolve (an orphaned row) still counts toward the totals but
// belongs to no domain, so it is deliberately left out of every perDomain.seen tally.
export function computeStats(deps: StatsDeps): Stats {
  const perDomain = {} as Record<Domain, DomainStat>;
  for (const d of DOMAINS) perDomain[d] = { seen: 0, total: deps.totals[d] };

  let learned = 0;
  let mastered = 0;
  let dueToday = 0;

  for (const st of deps.states) {
    learned += 1;
    if (st.status === "review") mastered += 1;
    if (st.dueAt <= deps.now) dueToday += 1;
    const domain = deps.domainOf(st.cardId);
    if (domain !== undefined) perDomain[domain].seen += 1;
  }

  return { learned, mastered, dueToday, perDomain };
}

// ---------------------------------------------------------------------------
// History-shaped figures, derived from review_log.
//
// card_state only keeps each card's latest snapshot, so it cannot answer "how many
// reviews did I do on Tuesday". Everything below reads the append-only log instead.
// Days are local days: a streak has to match the calendar the user is looking at, so
// bucketing is done through Date's local getters rather than by dividing epoch ms.
// ---------------------------------------------------------------------------

/** Local midnight for the day containing `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `n` days before the day containing `ts`. Built by shifting the date
 *  component rather than subtracting 24h, so DST transitions cannot drift the bucket. */
function shiftDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.getTime();
}

export type DayBucket = { dayStart: number; count: number };

/** Review counts for the last `days` local days, oldest first, ending with today.
 *  Days with no activity are present with count 0 so the chart has a fixed width. */
export function dailyCounts(log: ReviewLogEntry[], now: number, days: number): DayBucket[] {
  const buckets: DayBucket[] = [];
  const index = new Map<number, number>();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = shiftDays(now, i);
    index.set(dayStart, buckets.length);
    buckets.push({ dayStart, count: 0 });
  }
  for (const entry of log) {
    const slot = index.get(startOfDay(entry.at));
    if (slot !== undefined) buckets[slot].count += 1;
  }
  return buckets;
}

/** Reviews logged today, for the daily-goal ring. */
export function reviewsToday(log: ReviewLogEntry[], now: number): number {
  const today = startOfDay(now);
  return log.filter((e) => startOfDay(e.at) === today).length;
}

/** Consecutive days with at least one review, ending today. A day that is still in
 *  progress must not break the streak, so when today is empty the count starts at
 *  yesterday instead: someone with a 5-day streak who has not opened the app yet this
 *  morning still has a 5-day streak, and it only ends if they also skip today. */
export function currentStreak(log: ReviewLogEntry[], now: number): number {
  const active = new Set(log.map((e) => startOfDay(e.at)));
  if (active.size === 0) return 0;

  const today = startOfDay(now);
  let cursor = active.has(today) ? today : shiftDays(now, 1);
  if (!active.has(cursor)) return 0;

  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = shiftDays(cursor, 1);
  }
  return streak;
}

export type Accuracy = { reviews: number; correct: number; pct: number };

/** Share of graded answers marked "got". 0 rather than NaN when nothing is logged. */
export function accuracy(log: ReviewLogEntry[]): Accuracy {
  const reviews = log.length;
  const correct = log.filter((e) => e.grade === "got").length;
  return { reviews, correct, pct: reviews === 0 ? 0 : Math.round((correct / reviews) * 100) };
}

/** Earliest timestamp that could fall inside a window of `days` local days ending now.
 *  Used to bound the review_log query. One extra day of slack absorbs any local-vs-UTC
 *  offset so the oldest bucket is never clipped. */
export const windowStart = (now: number, days: number): number =>
  startOfDay(now) - (days + 1) * DAY_MS;
