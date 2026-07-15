export type Domain = "cs" | "finance" | "math" | "science";
export type CardType = "concept" | "puzzle";
export type Grade = "got" | "missed";

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
  difficulty: 1 | 2 | 3;
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
