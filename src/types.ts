export type Domain = "cs" | "finance" | "math" | "science";
export type CardType = "concept" | "puzzle";
export type Grade = "got" | "missed";
/** How far into a subject a reader has to be for a card to land. Named for the
 *  reader's stage rather than for the card's difficulty, since "advanced" only says
 *  what a card is relative to the others. */
export type Level = 1 | 2 | 3;

/** Returns a float in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

export type Card = {
  id: string;
  type: CardType;
  domain: Domain;
  topic: string;
  title: string;
  body: string;
  prompt: string;
  answer: string;
  difficulty: Level;
  sources: string[];
  tags: string[];
};

export type CardState = {
  cardId: string;
  status: "learning" | "review";
  ease: number;
  intervalDays: number;
  dueAt: number;    // UTC epoch ms
  lapses: number;
  reps: number;
  lastSeenAt: number; // UTC epoch ms
};

/** A card's place in the learning cycle, derived from its CardState (or absence of one). */
export type CardStatus = "new" | "learning" | "mastered";

/** One graded answer, appended at review time. The log is the source of truth for
 *  history-shaped figures (streak, activity, accuracy) that card_state cannot answer,
 *  since card_state only keeps a card's latest snapshot. */
export type ReviewLogEntry = { cardId: string; grade: Grade; at: number };

/** One answered question inside a quiz run, held in memory until the run finishes. */
export type QuizAnswer = { cardId: string; grade: Grade };

export type FeedItem =
  | { kind: "new-concept"; card: Card }
  | { kind: "new-puzzle"; card: Card }
  | { kind: "review"; card: Card }
  | { kind: "caught-up" };

export type Session = {
  servedIds: Set<string>;
  reviewsServed: number;
  newSinceReview: number;
  nextReviewGap: number;
  domainCursor: number;
};
