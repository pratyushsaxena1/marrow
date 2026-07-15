# Marrow v1 — Design

**Date:** 2026-07-15
**Status:** Approved, ready for planning
**Scope:** Thin vertical slice for personal dogfooding. Not an App Store release.

*"Marrow" is a working codename with no significance beyond the folder name.*

## Purpose

A vertical-scrolling feed of educational cards covering CS, finance/economics, math, and
science, with spaced-repetition recall woven invisibly into the scroll.

Three goals, in priority order:

1. **Recall** — you can answer questions about cards you saw weeks ago.
2. **Exposure** — you encounter ideas you would not have searched for.
3. **Reasoning** — puzzle cards exercise thinking, not just knowing.

Explicitly *not* a goal: replacing doomscrolling. Being good matters more than being sticky.
Where the two conflict, this design chooses good.

## The core bet

The app is a weekend of work. The corpus is the product.

A paging list, a local SQLite table, and an SM-2 scheduler is a few hundred lines of
well-understood code. Two thousand accurate, well-written cards is the entire ballgame.
Every failure mode that matters — you stop opening it, you stop trusting it, it feels like
slop — is a content failure, not a code failure.

v1 therefore builds the smallest end-to-end product that can be *used*, with a corpus
deliberately too small to be the real thing, in order to learn what the real corpus should
look like before writing it.

## Constraints

- **Zero runtime cost.** No API calls, no backend, no accounts, no network. Non-negotiable.
- **No runtime LLM generation.** Small on-device models hallucinate factual claims, and
  wrong content is worse than no content — the premise is that you trust and remember what
  you read. All content is generated ahead of time, reviewed, and shipped in the bundle.
- **Offline by construction.** Works on a plane. Nothing to pay for, break, or maintain.

## Stack

Expo + TypeScript + NativeWind, matching the existing Drizzle project so no new toolchain
is involved. Progress persists in local SQLite via `expo-sqlite`. The corpus ships as JSON
in the app bundle. No permissions are requested.

## Architecture

Five modules. The boundary that matters is that `scheduler` and `feed` — which hold all the
interesting logic — know nothing about storage or rendering, and are testable without
mounting a component or opening a database.

### `corpus`
Loads and indexes bundled cards. Pure, read-only. Knows nothing about user progress.

- `getCard(id): Card`
- `getUnseen(seenIds, domain?): Card[]`
- `allIds(): string[]`

### `scheduler`
Pure functions. Zero I/O. No React, no SQLite, no feed awareness.

- `review(state: CardState, grade: Grade, now: number): CardState`
- `isDue(state: CardState, now: number): boolean`
- `initialState(cardId: string, now: number): CardState`

### `store`
SQLite persistence of per-card progress.

- `getState(id): CardState | null`
- `putState(state: CardState): void`
- `getDue(now: number, limit: number): CardState[]`
- `getSeenIds(): string[]`

### `feed`
The mixing policy. Dependencies injected as arguments, so it tests against fakes.

- `nextChunk(deps: { corpus, store, now }, size: number): FeedItem[]`

### `ui`
A paging list plus one renderer per presentation. Deliberately dumb: renders what `feed`
hands it, reports grades back.

## Data model

### Card (authored, immutable, ships in the bundle)

```ts
type Card = {
  id: string;              // stable, e.g. "cs-0001"
  type: "concept" | "puzzle";
  domain: "cs" | "finance" | "math" | "science";
  topic: string;           // e.g. "amortized analysis"
  title: string;
  body: string;            // 40-90 words
  prompt: string;          // the recall question
  answer: string;          // 1-3 sentences
  difficulty: 1 | 2 | 3;
  sources: string[];       // >= 1 for concept cards
  tags: string[];
};
```

### CardState (runtime, per user, device-local)

```ts
type CardState = {
  cardId: string;
  status: "learning" | "review";
  ease: number;            // SM-2 ease factor, clamped [1.3, 2.8]
  intervalDays: number;
  dueAt: number;           // UTC epoch ms
  lapses: number;
  reps: number;
  lastSeenAt: number;      // UTC epoch ms
};
```

Absence of a `CardState` row means unseen. There is no `"unseen"` status.

### Type vs. presentation

A card's **type** and its **presentation** are different things. The same card data renders
three ways depending on history:

| Presentation | Shows | Grading |
|---|---|---|
| `concept` first exposure | title + body | none — passive read, swipe on |
| `puzzle` first exposure | title + body (the setup), tap to reveal answer | got it / missed it |
| any card on review | prompt only, tap to reveal answer | got it / missed it |

There is no separate "quiz card" in the data model. Review is a *presentation* of a card you
already have, not a new kind of content. This halves authoring work and is why interleaving
feels native rather than bolted on.

## Scheduler

SM-2 adapted to a binary grade.

**Got it:** interval walks out — 1 day, then 3 days, then `interval * ease`. Ease increases
by 0.1.

**Missed it:** interval resets to 1 day, ease decreases by 0.2, `lapses` increments.

**Ease clamp:** `[1.3, 2.8]`. A bad week cannot permanently poison a card; a good streak
cannot push a card years out.

**Fuzz:** every computed interval gets ±10% random jitter. Without it, everything read in one
sitting comes due in one sitting, forever, and the feed clumps.

**First exposure of a concept card** is passive and ungraded. It calls `initialState`, which
schedules the first review ~1 day out with `status: "learning"`. This is the moment the
recall layer starts working without the user ever agreeing to do homework.

**First exposure of a puzzle card** is graded on reveal. It schedules as
`review(initialState(id, now), grade, now)` — the card is created and immediately graded in
one step, so a puzzle you nail on sight starts at a 3-day interval rather than 1.

## Feed policy

**Session** — load-bearing for both the review cap and the no-repeats rule, so it is defined
concretely: a session begins on cold start, or when the app is foregrounded after ≥30 minutes
in the background. It ends when the next session begins. Session state (cards served, reviews
served) is in-memory only and is not persisted; a crash starts a fresh session, which is
acceptable.

- **Ratio:** one due review slipped in after every *N* new cards, where *N* is drawn
  uniformly from `[3, 5]` independently before each insertion — not a fixed beat, so it never
  feels mechanical.
- **Order:** most-overdue review first (`dueAt` ascending).
- **New card selection:** round-robin across the four domains, random within domain. Prevents
  ten graph-theory cards in a row.
- **No repeats within a session.**
- **Lazy materialization:** chunks of 10 as the user scrolls.

Two policies where this design deliberately refuses the TikTok premise:

**Review cap (~20/session).** Disappear for three weeks, come back to 200 due cards, and
serving all 200 turns the feed into a punishment you never open again. Overdue cards wait
their turn.

**The caught-up wall.** When every card has been seen and nothing is due, the feed shows a
"you're caught up, come back tomorrow" card and *ends*. It does not manufacture filler, and
it does not pull reviews forward to fill space. Refusing to fabricate content is the
difference between this and the thing it is trying to escape, and spacing only works if the
app is willing to make you wait. With a 150-card corpus this wall arrives in about a week —
which is the point. It measures how fast the corpus needs to grow.

## Content format

Enforced by a validation script, not by discipline:

- `body`: 40–90 words. Fits a phone screen without scrolling.
- `prompt`: one question, answerable in a sentence.
- `answer`: 1–3 sentences.
- Every concept card carries ≥1 source URL, so anything that smells wrong can be checked.
- **One idea per card.** If it needs two, it is two cards.

## v1 corpus

150 cards, authored as JSON under `corpus/`, one file per domain, checked into git.

| Domain | Cards |
|---|---|
| CS | 38 |
| Math | 38 |
| Finance/economics | 37 |
| Science | 37 |

Roughly 70% concept / 30% puzzle overall, skewed so math and CS carry most of the puzzles —
they lend themselves to it; finance and science lean concept.

Generation for v1 is deliberately manual: Claude Code sessions produce batches of ~25 per
topic, a separate verification pass checks claims against the cited sources, and the results
are skimmed by hand before landing. Real pipeline tooling is deferred to project #2, because
the card format is expected to change once the mechanic has been used.

A `validate` script gates the corpus: schema conformance, word counts, unique ids, required
sources, duplicate detection. It runs in pre-commit and is itself a test.

## Error handling

There is deliberately very little to fail: no network, no permissions, no accounts.

- **Corrupt or missing progress DB** → recreate empty. The corpus is intact; scheduling is
  lost; the app works. Progress is not precious in v1 and is not backed up.
- **Card fails schema at runtime** → skip it, do not crash the feed. Build-time validation
  makes this near-impossible; this is defense in depth.
- **Time** → all timestamps are UTC epoch ms. Never local dates. Travel and DST cannot
  silently shift what is due. A clock that jumps backwards is treated as `now`.

## Testing

Follows the module split. The pure modules carry the test weight.

- **`scheduler`** — table-driven unit tests. Grade sequences in, expected intervals out. Ease
  clamping at both bounds. Lapse behavior. Fuzz bounded and deterministic under a seeded RNG.
- **`feed`** — unit tests against fake `corpus` and `store`. Review ratio holds; no card
  repeats within a session; review cap respected; exhaustion yields the caught-up card;
  domain round-robin distributes.
- **`corpus`** — the validation script runs over the real corpus as a test.
- **`ui`** — one render test per presentation. Nothing more.
- **No E2E, no Detox.** The logic worth testing is not in the UI.

## Out of scope for v1

Accounts, sync, cloud backup, streaks, stats, gamification, settings, preferences,
onboarding, search, bookmarks, favorites, sharing, images or diagrams, domain filtering.

**App Store submission is also out of scope.** v1 goes to TestFlight, audience of one.
Submitting a 150-card app would be shipping the prototype.

## Success criteria

v1 succeeds if it answers these questions after a week of real use. It is an instrument, not
a product.

1. Do you open it unprompted?
2. Is 40–90 words the right body length, or too long / too short?
3. Do puzzle cards delight or interrupt?
4. Does a review card 3 days later feel satisfying or annoying?
5. What is the right daily card volume?
6. How fast does the corpus actually get consumed?

The answers become the inputs to project #2 — the corpus pipeline — which is where the real
engineering effort belongs.

## Sequencing

1. **v1 (this spec)** — thin vertical slice, 150 cards, TestFlight to self.
2. **Use it for a week.** Answer the questions above.
3. **Project #2** — corpus pipeline: batch generation, source citations, automated
   verification, a review queue that kills junk before it ships. Scale to ~2,000 cards.
4. **Project #3** — App Store release, if v1 and #2 justify it.
