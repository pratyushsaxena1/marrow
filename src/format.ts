import { DAY_MS, LEVEL_LABELS } from "./constants";
import type { Level } from "./types";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** Human phrasing for a card's next review. Coarsens as the interval grows, since
 *  "in 12 days" is the useful part and "in 12 days and 4 hours" is noise. */
export function nextReviewLabel(dueAt: number, now: number): string {
  const ms = dueAt - now;
  if (ms <= 0) return "Due now";
  if (ms < HOUR_MS) return `Due in ${plural(Math.max(1, Math.round(ms / MINUTE_MS)), "minute")}`;
  if (ms < DAY_MS) return `Due in ${plural(Math.round(ms / HOUR_MS), "hour")}`;
  return `Due in ${plural(Math.round(ms / DAY_MS), "day")}`;
}

/** The band name shown beside a card's subject. Takes a plain number rather than a
 *  Level so a value arriving from outside the type system falls back instead of
 *  rendering "undefined". */
export const difficultyLabel = (d: number): string =>
  LEVEL_LABELS[d as Level] ?? LEVEL_LABELS[2];

/** Single-letter weekday for the activity chart's axis. */
export const weekdayInitial = (ts: number): string =>
  ["S", "M", "T", "W", "T", "F", "S"][new Date(ts).getDay()];
