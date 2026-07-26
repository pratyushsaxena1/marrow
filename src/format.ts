import { DAY_MS } from "./constants";

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

const DIFFICULTY: Record<number, string> = { 1: "Introductory", 2: "Intermediate", 3: "Advanced" };

export const difficultyLabel = (d: number): string => DIFFICULTY[d] ?? "Intermediate";

/** Single-letter weekday for the activity chart's axis. */
export const weekdayInitial = (ts: number): string =>
  ["S", "M", "T", "W", "T", "F", "S"][new Date(ts).getDay()];
