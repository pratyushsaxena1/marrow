import {
  DAY_MS, EASE_DOWN, EASE_INITIAL, EASE_MAX, EASE_MIN, EASE_UP, FUZZ,
} from "../constants";
import type { CardState, Grade, Rng } from "../types";

const clampEase = (e: number): number => Math.min(EASE_MAX, Math.max(EASE_MIN, e));

/** Applies +/-FUZZ jitter so cards read in one sitting don't come due in one sitting forever. */
const fuzz = (days: number, rng: Rng): number => days * (1 - FUZZ + rng() * 2 * FUZZ);

const settle = (
  cardId: string, ease: number, intervalDays: number, reps: number,
  lapses: number, now: number,
): CardState => ({
  cardId,
  status: reps >= 2 ? "review" : "learning",
  ease,
  intervalDays,
  dueAt: now + Math.round(intervalDays * DAY_MS),
  lapses,
  reps,
  lastSeenAt: now,
});

export function initialState(cardId: string, now: number, rng: Rng): CardState {
  return settle(cardId, EASE_INITIAL, fuzz(1, rng), 0, 0, now);
}

export function review(state: CardState, grade: Grade, now: number, rng: Rng): CardState {
  if (grade === "missed") {
    return settle(
      state.cardId, clampEase(state.ease - EASE_DOWN), fuzz(1, rng),
      0, state.lapses + 1, now,
    );
  }
  const ease = clampEase(state.ease + EASE_UP);
  const base = state.reps === 0 ? 3 : state.intervalDays * ease;
  return settle(state.cardId, ease, fuzz(base, rng), state.reps + 1, state.lapses, now);
}

export function isDue(state: CardState, now: number): boolean {
  return now >= state.dueAt;
}
