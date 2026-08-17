# Difficulty Levels: Design

**Date:** 2026-08-16
**Status:** Approved, ready for planning
**Scope:** Name the three difficulty tiers after school levels and let the user filter by
them, in the Library and in the feed. No corpus content changes.

## Purpose

Marrow already assigns every card a `difficulty` of 1, 2 or 3, but the field does almost
nothing for the reader. It appears in exactly one place, the kicker on the card detail
screen, rendered through `difficultyLabel` as "Introductory", "Intermediate" or
"Advanced". Those words are vague: they describe a card only relative to the other cards,
so they tell a reader nothing about whether a card is pitched at them.

This change does two things. It renames the tiers after school levels, which is a
vocabulary a reader can locate themselves in. And it makes the tier a filter, so a reader
who wants only graduate material, or who wants to skip it, can say so.

## The constraint that shapes everything

`corpus/*.json` does not change. Not one card.

`difficulty` stays `1 | 2 | 3` on disk. The school-level names are a presentation layer
over the integer that is already there, and the filters read that same integer. This is
what keeps the change cheap and safe:

- `npm run validate-corpus` and `npm run corpus-style` are unaffected, including the
  15% minimum share per difficulty enforced at `scripts/corpus-style.ts:208`.
- `npm run check-links` has nothing to re-check.
- No card id moves, so no user's `card_state` history is touched.
- The 270 existing cards need no re-audit.

## The naming problem, and why the bands are what they are

The obvious reading of "organize by difficulty" would be to name the bands
elementary/middle school, high school/undergrad, and graduate. The corpus cannot support
that, and shipping it would make the app lie about its own content.

A current difficulty 1 CS card is "One statement, three instructions": `x++` compiling to
load, add and store, and the race that follows when two threads interleave it. A current
difficulty 1 science card is the Doppler effect. Difficulty 3 is register allocation as
graph coloring, and the Carnot limit. The schema in CLAUDE.md even defines level 1 as
"most educated adults follow it", which is not a description of a child.

So the corpus spans roughly high school to graduate, with nothing below high school. The
bands are named to fit the cards that exist:

| `difficulty` | Label | Share of corpus |
| --- | --- | --- |
| 1 | High school | 26% (69 cards) |
| 2 | Undergrad | 47% (128 cards) |
| 3 | Graduate+ | 27% (73 cards) |

One label per level, used everywhere. There is no full/short split of the kind
`DOMAIN_LABELS` and `DOMAIN_LABELS_SHORT` maintain, because these three strings are
already short enough for a filter chip and specific enough for the detail kicker.

Writing genuinely elementary-level cards to fill a fourth, lower band was considered and
rejected for this change. It is a content project, not a code project, and it would change
what Marrow is.

## Architecture

Nothing new is invented. The level filter is modelled on the domain filter that the app
already has, at every layer, including its conventions.

The most important of those conventions: **an empty array means "every level"**, exactly as
an empty `domains` array means every domain. The unfiltered path therefore stays
byte-for-byte the behavior that ships today, and a corrupt or missing setting degrades to
"show everything" rather than to "show nothing".

### `src/types.ts`

```ts
export type Level = 1 | 2 | 3;
```

and `Card.difficulty` becomes `Level`. This is a pure alias of the existing union, so it is
not a breaking change to any card literal in the tests.

### `src/constants.ts`

```ts
export const LEVELS: Level[] = [1, 2, 3];
export const LEVEL_LABELS: Record<Level, string> = {
  1: "High school",
  2: "Undergrad",
  3: "Graduate+",
};
```

Placed beside the domain labels, so the app keeps one vocabulary file rather than a map per
component.

### `src/format.ts`

`difficultyLabel` reads `LEVEL_LABELS` instead of its own private `DIFFICULTY` map. It keeps
its out-of-range fallback, which becomes "Undergrad".

### `src/search/index.ts`

`Query` gains `levels: Level[]`, empty meaning all. `EMPTY_QUERY` gains `levels: []`.
`searchCards` gains one guard beside the existing domain guard:

```ts
if (q.levels.length > 0 && !q.levels.includes(card.difficulty)) return;
```

### `src/feed/index.ts`

`FeedDeps` gains `levels?: Level[]`, and an `activeLevels` helper mirrors the existing
`activeDomains`. It applies in both places a card enters the feed:

- `takeReview` skips a due card whose level is filtered out, beside its existing domain
  check.
- `takeNew` filters the pool returned by `getUnseen` before drawing from it.

`CorpusPort` is deliberately left alone. Filtering the returned pool in `takeNew` keeps the
corpus module ignorant of the feed's filters, which is the boundary the v1 design set.

Note the interaction with `takeNew`'s round-robin: a domain with no unseen cards at the
selected levels is skipped, and the cursor advances to the next domain, which is the
behavior the existing `pool.length === 0` branch already gives. No change is needed there.

### `src/store`

One new settings key, `selectedLevels`, holding a JSON array. It uses the same
load-and-normalize shape as `loadSelectedDomains` at `app/index.tsx:26`, including its
tolerance of malformed values.

## Surfaces

### Library (`app/library.tsx`)

A third horizontal chip row, below the status row, with the three level chips. Multi-select
via a `toggleLevel` that mirrors `toggleDomain`. State is local to the screen and not
persisted, matching how the domain, status and saved chips there already behave.

`clearFilters` resets levels, and the `filtered` flag includes `levels.length > 0` so the
"clear" affordance appears when only a level is selected.

This adds a third row of chrome above the list. If that proves too heavy on a small phone,
the fix is to fold the domain and level rows into one filter sheet, but that refactor is out
of scope here and should not be pre-empted.

### Settings (`app/settings.tsx`)

A "Level" section, above "Daily review goal", with the three chips and a line of body copy
explaining that it shapes the feed. It reads and writes `selectedLevels` through
`store.getSetting` / `store.putSetting`, using the same `Chip` component the daily goal
already uses.

Deselecting all three normalizes to `[]`, meaning every level, so the user cannot put the
feed into a state where it serves nothing.

### Feed (`app/index.tsx`)

`selectedLevels` is loaded at mount alongside `selectedDomains` and threaded into `deps`.

The live mechanism is simpler than it first looks: `app/_layout.tsx` is a single `Stack`,
and every tab switch uses `router.replace`, which unmounts the outgoing screen. Settings is
reachable only via `router.push("/settings")` from the Library and Progress screens, never
from the feed itself, so the feed is always unmounted before Settings can open. What actually
picks up a level chosen in Settings is the feed's `useState` initializer re-reading
`selectedLevels` on the remount that follows.

The feed's `useFocusEffect`, which already re-reads saved cards and the due count, also
re-reads `selectedLevels` and restarts the session if it differs from the mounted state. This
is defensive, not the live path: it only does anything if a future Settings entry point from
the feed's own top bar keeps the feed mounted underneath. Comparing before restarting matters
regardless, since restarting on every focus would throw away the user's place in the feed
each time they returned from any other tab.

`DomainSheet` is not touched.

### Card detail (`app/card/[id].tsx`)

No change. The kicker at line 114 already calls `difficultyLabel`, so it picks up the new
wording for free.

## Testing

Test-driven, per the repo's workflow. The interesting logic is in `search` and `feed`, both
of which are already pure and dependency-injected, so all of it is testable without
mounting a component.

- `__tests__/format.test.ts`: the three expected strings and the out-of-range fallback.
- `__tests__/search.test.ts`: empty `levels` returns everything; a single level narrows;
  two levels union; a level combined with a domain intersects rather than unions.
- `__tests__/feed.test.ts`: `takeNew` draws only from selected levels; `takeReview` skips a
  due card outside them; a selection with no available cards yields `caught-up` rather than
  looping or throwing; absent `levels` behaves exactly as today.

Existing card literals in the test files keep `difficulty: 2` and stay valid under `Level`.

## Verification

All four commands from CLAUDE.md must pass before commit:

```bash
npm run validate-corpus
npm run corpus-style
npm test
npm run check-links
```

The corpus files are untouched, so the three corpus-facing commands are a regression check
rather than a real risk here. They still run.

## Documentation

CLAUDE.md's schema table currently describes `difficulty` as "1 most educated adults follow
it, 2 needs some background, 3 needs real familiarity". That row gains the band names, so a
future card author knows that assigning a 3 labels the card "Graduate+" in the UI. The
guidance on assigning difficulty honestly, and the 15% minimum share, are unchanged.

## Out of scope

- Any change to `corpus/*.json`.
- A per-level breakdown on the Progress screen.
- Writing elementary or middle school cards, or adding a fourth band.
- Folding the Library's filter rows into a sheet.
- The home screen widget, which is a separate project with its own design.
- The quiz screen (`app/quiz.tsx`). It has its own domain chip row and no level
  equivalent, so after this branch level is a filter everywhere domain is except there.
  That asymmetry is deliberate for this change, not an oversight: a level filter on the
  quiz is a reasonable follow-up, but it was not requested and is left for a future
  change rather than pre-empted here.

## Known follow-up

`refreshDueCount` (`app/index.tsx:74-77`) counts every due card regardless of the level
filter, so a reader who narrows to Graduate+ can see a due count higher than what the
feed will actually serve them. This is pre-existing behavior: the domain filter has
always had the same gap, and the level filter now mirrors it rather than fixing it.
Making the due count respect the active filters is a product decision for the repo
owner and is deliberately not being made on this branch. Recorded here so it is a known
gap rather than a rediscovered one.
