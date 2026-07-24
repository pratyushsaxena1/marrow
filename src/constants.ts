import type { Domain } from "./types";

export const DOMAINS: Domain[] = ["cs", "finance", "math", "science"];

// Human-readable subject names for the UI. Full names for the picker and stats
// breakdown, short names for compact places like the top bar label.
export const DOMAIN_LABELS: Record<Domain, string> = {
  cs: "Computer Science",
  finance: "Finance",
  math: "Math",
  science: "Science",
};
export const DOMAIN_LABELS_SHORT: Record<Domain, string> = {
  cs: "CS",
  finance: "Finance",
  math: "Math",
  science: "Science",
};
export const DAY_MS = 86_400_000;
export const EASE_INITIAL = 2.5;
export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;
export const EASE_UP = 0.1;
export const EASE_DOWN = 0.2;
export const FUZZ = 0.1;
export const REVIEW_CAP_PER_SESSION = 20;
export const REVIEW_GAP_MIN = 3;
export const REVIEW_GAP_MAX = 5;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const CHUNK_SIZE = 10;
export const BODY_MIN_WORDS = 40;
export const BODY_MAX_WORDS = 90;
