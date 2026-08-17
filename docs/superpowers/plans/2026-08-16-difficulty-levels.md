# Difficulty Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Name the three existing difficulty tiers after school levels (High school, Undergrad, Graduate+) and let the reader filter by them in the Library and in the feed.

**Architecture:** `difficulty` stays `1 | 2 | 3` in `corpus/*.json`. The band names are a presentation layer over that integer, and both filters read the same integer. The level filter copies the domain filter that already exists at every layer, including its convention that an empty array means "every level".

**Tech Stack:** Expo, TypeScript strict, NativeWind, expo-sqlite, expo-router, jest with jest-expo and @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-16-difficulty-levels-design.md`

## Global Constraints

- **No file under `corpus/` may be edited by this plan.** Not one card. If a task seems to need a corpus edit, the task is wrong.
- **No em dashes and no en dashes** anywhere: code, comments, docs, commit messages. Repo owner's standing preference.
- **No `any`** in committed code.
- **No network calls at runtime.** Nothing in this plan should add one.
- **All timestamps are UTC epoch milliseconds.** Nothing here touches time, but do not introduce local-date arithmetic.
- **Randomness is injected** as `Rng = () => number` in `scheduler` and `feed`. Never call `Math.random()` inside those modules.
- **The three labels are exactly** `"High school"`, `"Undergrad"`, `"Graduate+"`. One label per level, used in the card detail kicker, the Library chips and the Settings chips alike. There is no separate short form.
- **Empty array means "every level"**, mirroring `domains`. A missing or malformed persisted value degrades to "show everything", never to "show nothing".
- Work happens on the existing branch `feat/difficulty-levels`.

---

### Task 1: Level vocabulary and labels

Introduces the `Level` type and the three band names, and routes the card detail kicker through them. After this task the app already reads "Computer Science - Undergrad" on a card, with no filtering yet.

**Files:**
- Modify: `src/types.ts` (add `Level`, use it in `Card.difficulty`)
- Modify: `src/constants.ts` (add `LEVELS`, `LEVEL_LABELS`)
- Modify: `src/format.ts:18-20` (replace the private `DIFFICULTY` map)
- Modify: `CLAUDE.md:46` (schema table row)
- Test: `__tests__/format.test.ts:30-37`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type Level = 1 | 2 | 3` exported from `src/types.ts`
  - `const LEVELS: Level[]` and `const LEVEL_LABELS: Record<Level, string>` exported from `src/constants.ts`
  - `difficultyLabel(d: number): string` keeps its existing signature in `src/format.ts`

- [ ] **Step 1: Update the failing test**

Replace the `difficultyLabel` block in `__tests__/format.test.ts` (currently lines 30 to 37) with:

```ts
describe("difficultyLabel", () => {
  it("names each level and falls back for an unknown one", () => {
    expect(difficultyLabel(1)).toBe("High school");
    expect(difficultyLabel(2)).toBe("Undergrad");
    expect(difficultyLabel(3)).toBe("Graduate+");
    expect(difficultyLabel(9)).toBe("Undergrad");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/format.test.ts -t difficultyLabel`
Expected: FAIL, with received `"Introductory"` where `"High school"` was expected.

- [ ] **Step 3: Add the `Level` type**

In `src/types.ts`, add `Level` beside the other unions at the top of the file:

```ts
export type Domain = "cs" | "finance" | "math" | "science";
export type CardType = "concept" | "puzzle";
export type Grade = "got" | "missed";
/** How far into a subject a reader has to be for a card to land. Named for the
 *  reader's stage rather than for the card's difficulty, since "advanced" only says
 *  what a card is relative to the others. */
export type Level = 1 | 2 | 3;
```

and change the `Card` field from `difficulty: 1 | 2 | 3;` to:

```ts
  difficulty: Level;
```

This is a pure alias of the union that was already there, so every `difficulty: 2` literal in the test files stays valid.

- [ ] **Step 4: Add the labels**

In `src/constants.ts`, change the import on line 1 to:

```ts
import type { Domain, Level } from "./types";
```

and add this immediately after the `DOMAIN_LABELS_SHORT` block, so the app keeps one vocabulary file rather than a map per component:

```ts
/** The three tiers, named for where a reader would first meet the idea. The corpus
 *  runs from high school to graduate with nothing below it, so these names describe
 *  the cards that exist rather than a span reaching down to grade school. */
export const LEVELS: Level[] = [1, 2, 3];
export const LEVEL_LABELS: Record<Level, string> = {
  1: "High school",
  2: "Undergrad",
  3: "Graduate+",
};
```

- [ ] **Step 5: Route `difficultyLabel` through the labels**

In `src/format.ts`, change the first import to:

```ts
import { DAY_MS, LEVEL_LABELS } from "./constants";
import type { Level } from "./types";
```

and replace the two lines at the bottom that define `DIFFICULTY` and `difficultyLabel` with:

```ts
/** The band name shown beside a card's subject. Takes a plain number rather than a
 *  Level so a value arriving from outside the type system falls back instead of
 *  rendering "undefined". */
export const difficultyLabel = (d: number): string =>
  LEVEL_LABELS[d as Level] ?? LEVEL_LABELS[2];
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest __tests__/format.test.ts`
Expected: PASS.

- [ ] **Step 7: Update the schema table in CLAUDE.md**

Replace line 46 of `CLAUDE.md`:

```
| `difficulty` | `1` most educated adults follow it, `2` needs some background, `3` needs real familiarity |
```

with:

```
| `difficulty` | `1` High school, most educated adults follow it; `2` Undergrad, needs some background; `3` Graduate+, needs real familiarity. The band name is what the app shows the reader. |
```

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/types.ts src/constants.ts src/format.ts CLAUDE.md __tests__/format.test.ts
git commit -m "feat: name the three difficulty tiers after school levels"
```

---

### Task 2: Level filter in search

Adds `levels` to the Library's query model. Pure function change, no UI yet.

**Files:**
- Modify: `src/search/index.ts:1-19` (imports, `Query`, `EMPTY_QUERY`) and `searchCards`
- Test: `__tests__/search.test.ts`

**Interfaces:**
- Consumes: `Level` from `src/types.ts` (Task 1).
- Produces: `Query` gains `levels: Level[]`, empty meaning every level. `EMPTY_QUERY` gains `levels: []`. `searchCards(deps, q)` signature is unchanged.

- [ ] **Step 1: Write the failing tests**

Append to the `searchCards` describe block in `__tests__/search.test.ts`. The existing `mkCard` helper there already defaults `difficulty` to 2, so each card states its own level explicitly:

```ts
  it("returns every level when the filter is empty", () => {
    const cards = [
      mkCard({ id: "cs-0001", difficulty: 1 }),
      mkCard({ id: "cs-0002", difficulty: 2 }),
      mkCard({ id: "cs-0003", difficulty: 3 }),
    ];
    expect(searchCards(deps(cards), EMPTY_QUERY)).toHaveLength(3);
  });

  it("narrows to one level", () => {
    const cards = [
      mkCard({ id: "cs-0001", difficulty: 1 }),
      mkCard({ id: "cs-0002", difficulty: 2 }),
      mkCard({ id: "cs-0003", difficulty: 3 }),
    ];
    const out = searchCards(deps(cards), { ...EMPTY_QUERY, levels: [3] });
    expect(out.map((c) => c.id)).toEqual(["cs-0003"]);
  });

  it("unions two levels", () => {
    const cards = [
      mkCard({ id: "cs-0001", difficulty: 1 }),
      mkCard({ id: "cs-0002", difficulty: 2 }),
      mkCard({ id: "cs-0003", difficulty: 3 }),
    ];
    const out = searchCards(deps(cards), { ...EMPTY_QUERY, levels: [1, 3] });
    expect(out.map((c) => c.id)).toEqual(["cs-0001", "cs-0003"]);
  });

  it("intersects a level with a subject rather than unioning them", () => {
    const cards = [
      mkCard({ id: "cs-0001", domain: "cs", difficulty: 3 }),
      mkCard({ id: "fin-0001", domain: "finance", difficulty: 3 }),
      mkCard({ id: "fin-0002", domain: "finance", difficulty: 1 }),
    ];
    const out = searchCards(deps(cards), {
      ...EMPTY_QUERY,
      domains: ["finance" as Domain],
      levels: [3],
    });
    expect(out.map((c) => c.id)).toEqual(["fin-0001"]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/search.test.ts`
Expected: FAIL. TypeScript rejects `levels` as an unknown property on `Query`, and the two narrowing tests return all three cards.

- [ ] **Step 3: Add `levels` to the query model**

In `src/search/index.ts`, change the import on line 1 to:

```ts
import type { Card, CardState, CardStatus, Domain, Level } from "../types";
```

add the field to `Query`:

```ts
export type Query = {
  text: string;
  domains: Domain[]; // empty = every domain
  levels: Level[];   // empty = every level
  status: StatusFilter;
  savedOnly: boolean;
};
```

and add it to the default:

```ts
export const EMPTY_QUERY: Query = {
  text: "", domains: [], levels: [], status: "all", savedOnly: false,
};
```

- [ ] **Step 4: Filter on it**

In `searchCards`, add one guard immediately after the existing domain guard:

```ts
    if (q.domains.length > 0 && !q.domains.includes(card.domain)) return;
    if (q.levels.length > 0 && !q.levels.includes(card.difficulty)) return;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest __tests__/search.test.ts`
Expected: PASS, including the pre-existing tests, which all spread `EMPTY_QUERY` and so pick up `levels: []` for free.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/search/index.ts __tests__/search.test.ts
git commit -m "feat: filter search results by level"
```

---

### Task 3: Level filter in feed

Threads an optional `levels` through the feed, applied at both points a card enters it.

**Files:**
- Modify: `src/feed/index.ts:1-30` (imports, `FeedDeps`, new `activeLevels`), `takeReview`, `takeNew`
- Test: `__tests__/feed.test.ts`

**Interfaces:**
- Consumes: `Level` from `src/types.ts` and `LEVELS` from `src/constants.ts` (Task 1).
- Produces: `FeedDeps` gains `levels?: Level[]`. Absent or empty means every level. `CorpusPort` is unchanged, so no caller of `getUnseen` has to change.

- [ ] **Step 1: Extend the test card helper**

In `__tests__/feed.test.ts`, replace the `mkCard` helper (lines 8 to 11) with a version that takes a level, defaulting to the 1 it already used:

```ts
const mkCard = (
  id: string,
  domain: Domain,
  type: "concept" | "puzzle" = "concept",
  difficulty: Level = 1,
): Card => ({
  id, type, domain, topic: "t", title: "T", body: "b", prompt: "p", answer: "a",
  difficulty, sources: ["https://example.com"], tags: [],
});
```

and add `Level` to the type import on line 2:

```ts
import type { Card, CardState, Domain, FeedItem, Level } from "../src/types";
```

- [ ] **Step 2: Write the failing tests**

Append to the `nextChunk` describe block in `__tests__/feed.test.ts`:

```ts
  it("draws new cards only from the selected levels", () => {
    const cards = [
      mkCard("cs-0", "cs", "concept", 1),
      mkCard("cs-1", "cs", "concept", 2),
      mkCard("cs-2", "cs", "concept", 3),
    ];
    const deps = {
      corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid,
      domains: ["cs" as Domain], levels: [3 as Level],
    };
    const items = nextChunk(deps, createSession(mid), 10);
    const served = items.filter((i) => i.kind !== "caught-up");
    expect(served.map((i) => (i.kind === "caught-up" ? "" : i.card.id))).toEqual(["cs-2"]);
  });

  it("skips a due review that sits outside the selected levels", () => {
    const cards = [mkCard("cs-0", "cs", "concept", 1), mkCard("cs-1", "cs", "concept", 3)];
    const due = [mkState("cs-0", NOW - 1000)];
    const deps = {
      corpus: fakeCorpus(cards), store: fakeStore(due, new Set(["cs-0"])),
      now: NOW, rng: mid, domains: ["cs" as Domain], levels: [3 as Level],
    };
    const items = nextChunk(deps, createSession(mid), 10);
    expect(items.some((i) => i.kind === "review")).toBe(false);
  });

  it("reports caught-up when no card sits at the selected levels", () => {
    const cards = [mkCard("cs-0", "cs", "concept", 1)];
    const deps = {
      corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid,
      levels: [3 as Level],
    };
    const items = nextChunk(deps, createSession(mid), 10);
    expect(items).toEqual([{ kind: "caught-up" }]);
  });

  it("serves every level when levels is absent", () => {
    const cards = [
      mkCard("cs-0", "cs", "concept", 1),
      mkCard("cs-1", "cs", "concept", 2),
      mkCard("cs-2", "cs", "concept", 3),
    ];
    const deps = {
      corpus: fakeCorpus(cards), store: fakeStore([]), now: NOW, rng: mid,
      domains: ["cs" as Domain],
    };
    const items = nextChunk(deps, createSession(mid), 10);
    expect(items.filter((i) => i.kind !== "caught-up")).toHaveLength(3);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest __tests__/feed.test.ts`
Expected: FAIL. TypeScript rejects `levels` as an unknown property on `FeedDeps`, and the filtering tests serve cards at every level.

- [ ] **Step 4: Add `levels` to the feed**

In `src/feed/index.ts`, change the two imports at the top to:

```ts
import {
  DOMAINS, LEVELS, REVIEW_CAP_PER_SESSION, REVIEW_GAP_MAX, REVIEW_GAP_MIN,
} from "../constants";
import type { Card, CardState, Domain, FeedItem, Level, Rng, Session } from "../types";
```

add the field to `FeedDeps`:

```ts
export type FeedDeps = {
  corpus: CorpusPort;
  store: StorePort;
  now: number;
  rng: Rng;
  domains?: Domain[]; // undefined or empty array = all domains (no filter)
  levels?: Level[];   // undefined or empty array = all levels (no filter)
};
```

and add the helper immediately below `activeDomains`, matching it line for line:

```ts
// The levels this session draws from. An absent or empty filter means all levels, so
// the unfiltered path stays identical to the pre-filter behavior.
const activeLevels = (deps: FeedDeps): Level[] =>
  deps.levels && deps.levels.length > 0 ? deps.levels : LEVELS;
```

- [ ] **Step 5: Apply it in `takeReview`**

Replace the body of `takeReview` below the `getDue` call with:

```ts
  const domains = activeDomains(deps);
  const levels = activeLevels(deps);
  for (const st of due) {
    if (s.servedIds.has(st.cardId)) continue;
    const card = deps.corpus.getCard(st.cardId);
    // Skip due cards outside the selected subjects or levels. With no filter every
    // subject and level is active, so this check is a no-op.
    if (card && domains.includes(card.domain) && levels.includes(card.difficulty)) return card;
  }
  return undefined;
```

- [ ] **Step 6: Apply it in `takeNew`**

In `takeNew`, add the `levels` lookup beside the `domains` one and filter the pool. The existing `pool.length === 0` branch already advances the round-robin past a subject with nothing left, so a subject with no cards at the selected levels needs no new handling:

```ts
  const domains = activeDomains(deps);
  const levels = activeLevels(deps);
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[(s.domainCursor + i) % domains.length];
    const pool = deps.corpus
      .getUnseen(seen, domain)
      .filter((c) => levels.includes(c.difficulty));
    if (pool.length === 0) continue;
    s.domainCursor = (s.domainCursor + i + 1) % domains.length;
    return pool[Math.floor(deps.rng() * pool.length)];
  }
  return undefined;
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest __tests__/feed.test.ts`
Expected: PASS, including every pre-existing feed test, which pass no `levels` and so take the unfiltered path.

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/feed/index.ts __tests__/feed.test.ts
git commit -m "feat: filter the feed by level"
```

---

### Task 4: Level chips in the Library

Adds the third filter row. State is local to the screen and not persisted, matching how the domain, status and saved chips there already behave.

**Files:**
- Modify: `app/library.tsx` (imports, state, `toggleLevel`, `query`, `clearFilters`, `filtered`, a new chip row)
- Test: `__tests__/screens.test.tsx` (the `Library screen` describe block)

**Interfaces:**
- Consumes: `Query.levels` from Task 2, `LEVELS` and `LEVEL_LABELS` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

In `__tests__/screens.test.tsx`, add a derived count beside the existing `TOTAL` and `BY_DOMAIN` constants near the top. Counts are derived rather than hardcoded, matching the comment already there about content additions causing spurious failures:

```ts
const BY_LEVEL = loadCorpus().reduce<Record<number, number>>(
  (acc, c) => ({ ...acc, [c.difficulty]: (acc[c.difficulty] ?? 0) + 1 }),
  {},
);
```

Then add to the `Library screen` describe block:

```ts
  it("filters by level chip", () => {
    const { getByText } = mount(<LibraryScreen />);
    fireEvent.press(getByText("Graduate+"));
    getByText(`${BY_LEVEL[3]} of ${TOTAL} concepts`);
  });

  it("intersects a level chip with a subject chip", () => {
    const { getByText } = mount(<LibraryScreen />);
    fireEvent.press(getByText("Finance"));
    fireEvent.press(getByText("Graduate+"));
    const expected = loadCorpus().filter(
      (c) => c.domain === "finance" && c.difficulty === 3,
    ).length;
    getByText(`${expected} of ${TOTAL} concepts`);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/screens.test.tsx -t "level chip"`
Expected: FAIL with "Unable to find an element with text: Graduate+".

- [ ] **Step 3: Wire the state into the screen**

In `app/library.tsx`, extend the constants import on line 16 and the type import on line 17:

```ts
import { DOMAINS, DOMAIN_LABELS_SHORT, LEVELS, LEVEL_LABELS } from "../src/constants";
import type { CardState, Domain, Level } from "../src/types";
```

add the state beside the other filters:

```ts
  const [levels, setLevels] = useState<Level[]>([]);
```

include it in the query:

```ts
  const query: Query = { text, domains, levels, status, savedOnly };
```

add `levels` to the `useMemo` dependency array for `results`, beside `domains`:

```ts
    [cards, snapshot, text, domains, levels, status, savedOnly], // eslint-disable-line react-hooks/exhaustive-deps
```

add the toggle beside `toggleDomain`:

```ts
  const toggleLevel = (l: Level) =>
    setLevels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
```

and extend the two places that summarize filter state:

```ts
  const clearFilters = () => {
    setText("");
    setDomains([]);
    setLevels([]);
    setStatus("all");
    setSavedOnly(false);
  };

  const filtered =
    domains.length > 0 || levels.length > 0 || status !== "all" || savedOnly || text.length > 0;
```

- [ ] **Step 4: Add the chip row**

In `app/library.tsx`, insert a third row between the status row and the results count, copying the shape of the domain row directly above it:

```tsx
      <View className="mb-2">
        <FlatList
          horizontal
          data={LEVELS}
          keyExtractor={(l) => String(l)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: 8, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <Chip
              label={LEVEL_LABELS[item]}
              selected={levels.includes(item)}
              onPress={() => toggleLevel(item)}
            />
          )}
        />
      </View>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest __tests__/screens.test.tsx`
Expected: PASS, including the pre-existing Library tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add app/library.tsx __tests__/screens.test.tsx
git commit -m "feat: add level chips to the Library"
```

---

### Task 5: Level preference in Settings, applied to the feed

The persisted half. A level chosen in Settings shapes what the feed serves. These ship together because the preference does nothing without the feed wiring, and a reviewer could not sensibly accept one without the other.

**Files:**
- Create: nothing
- Modify: `src/format.ts` (add `loadSelectedLevels`)
- Modify: `app/settings.tsx` (imports, state, `toggleLevel`, a new "Level" section)
- Modify: `app/index.tsx` (imports, state, `deps`, the focus effect)
- Test: `__tests__/format.test.ts`, `__tests__/screens.test.tsx` (the `Settings screen` and `Feed screen` describe blocks)

**Interfaces:**
- Consumes: `FeedDeps.levels` from Task 3, `LEVELS` and `LEVEL_LABELS` from Task 1.
- Produces:
  - `loadSelectedLevels(raw: string | null): Level[]` exported from `src/format.ts`
  - the settings key `selectedLevels`, holding a JSON array of `Level`. An empty array, a missing key, or a malformed value all mean every level.

`loadSelectedLevels` lives in `src/format.ts` because both `app/settings.tsx` and `app/index.tsx` need it, and `format.ts` is the pure-helper module both screens already import from. It does not go in `src/constants.ts`, which holds values rather than logic.

- [ ] **Step 1: Write the failing loader test**

Add to `__tests__/format.test.ts`, and add `loadSelectedLevels` to that file's import on line 1:

```ts
describe("loadSelectedLevels", () => {
  it("reads a stored selection", () => {
    expect(loadSelectedLevels("[1,3]")).toEqual([1, 3]);
  });

  it("degrades to every level for missing, malformed or foreign values", () => {
    expect(loadSelectedLevels(null)).toEqual([]);
    expect(loadSelectedLevels("not json")).toEqual([]);
    expect(loadSelectedLevels('{"a":1}')).toEqual([]);
    expect(loadSelectedLevels("[9,2]")).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/format.test.ts -t loadSelectedLevels`
Expected: FAIL with "loadSelectedLevels is not a function".

- [ ] **Step 3: Implement the loader**

In `src/format.ts`, extend the constants import to pull in `LEVELS`:

```ts
import { DAY_MS, LEVEL_LABELS, LEVELS } from "./constants";
```

and add at the bottom of the file:

```ts
/** Reads the persisted level filter. A missing or malformed value means "every level"
 *  (the empty array), so a corrupt setting degrades to showing everything rather than
 *  to showing nothing. Mirrors loadSelectedDomains in app/index.tsx. */
export function loadSelectedLevels(raw: string | null): Level[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l): l is Level => LEVELS.includes(l as Level));
  } catch {
    return [];
  }
}
```

The `import type { Level } from "./types";` line was already added to this file in Task 1.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing Settings tests**

Add to the `Settings screen` describe block in `__tests__/screens.test.tsx`:

```ts
  it("persists a level selection", () => {
    const { getByText } = mount(<SettingsScreen />);
    fireEvent.press(getByText("Graduate+"));
    expect(mockData.settings.get("selectedLevels")).toBe("[3]");
  });

  it("normalizes a full selection back to every level", () => {
    const { getByText } = mount(<SettingsScreen />);
    fireEvent.press(getByText("High school"));
    fireEvent.press(getByText("Undergrad"));
    fireEvent.press(getByText("Graduate+"));
    expect(mockData.settings.get("selectedLevels")).toBe("[]");
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx jest __tests__/screens.test.tsx -t "level selection"`
Expected: FAIL with "Unable to find an element with text: Graduate+".

- [ ] **Step 7: Add the Settings section**

In `app/settings.tsx`, replace the constants import on line 15 and add the type and helper imports:

```ts
import {
  DAILY_GOAL_DEFAULT, DAILY_GOAL_OPTIONS, LEVELS, LEVEL_LABELS,
} from "../src/constants";
import { loadSelectedLevels } from "../src/format";
import type { Level } from "../src/types";
```

Add the state beside the daily goal state:

```ts
  const [levels, setLevels] = useState<Level[]>(() =>
    loadSelectedLevels(store.getSetting("selectedLevels")),
  );
```

Add the toggle. Selecting all three says the same thing as selecting none, so it normalizes to the empty array. That normalization is what makes it impossible to filter the feed down to nothing:

```ts
  const toggleLevel = (l: Level) => {
    const next = levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l];
    // Covering all three means the same as choosing none: every level.
    const canonical = next.length === LEVELS.length ? [] : next;
    store.putSetting("selectedLevels", JSON.stringify(canonical));
    setLevels(canonical);
  };
```

On a fresh install no chip is filled, which reads as "no preference, show me everything". This is deliberately simpler than `DomainSheet`'s convention, where an empty selection renders every row checked: that sheet has an Apply button and a modal frame to explain the state, and a bare row of chips in Settings does not.

Add the section immediately above the "Daily review goal" section label:

```tsx
          <SectionLabel>Level</SectionLabel>
          <Text className="text-neutral-400 text-sm leading-relaxed mb-4">
            Which levels the feed draws from. With none chosen you see every level. The
            Library always searches everything.
          </Text>
          <View className="flex-row gap-2 mb-10">
            {LEVELS.map((l) => (
              <Chip
                key={l}
                label={LEVEL_LABELS[l]}
                selected={levels.includes(l)}
                onPress={() => toggleLevel(l)}
              />
            ))}
          </View>
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest __tests__/screens.test.tsx`
Expected: PASS, including the pre-existing Settings tests.

- [ ] **Step 9: Write the failing Feed test**

Feed cards render a title, a body and a subject kicker. They do **not** render the band name, so this test reads the served cards back through the corpus rather than looking for a label. Add to the `Feed screen` describe block in `__tests__/screens.test.tsx`:

```ts
  it("serves only the persisted levels", () => {
    mockData.settings.set("selectedLevels", "[3]");
    const { queryByText } = mount(<FeedScreen />);
    const shown = loadCorpus().filter((c) => queryByText(c.title) !== null);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((c) => c.difficulty === 3)).toBe(true);
  });
```

`loadCorpus` is already imported at the top of this test file.

- [ ] **Step 10: Run the test to verify it fails**

Run: `npx jest __tests__/screens.test.tsx -t "persisted levels"`
Expected: FAIL. The feed ignores the setting, so cards at levels 1 and 2 appear and `every` returns false.

- [ ] **Step 11: Wire the feed**

In `app/index.tsx`, add the helper and type imports:

```ts
import { loadSelectedLevels } from "../src/format";
import type { Domain, FeedItem, Grade, Level, Session } from "../src/types";
```

Add the state beside `selectedDomains`:

```ts
  const [selectedLevels, setSelectedLevels] = useState<Level[]>(() =>
    loadSelectedLevels(store.getSetting("selectedLevels")),
  );
```

Thread it into `deps`:

```ts
  const deps = useCallback(
    (): FeedDeps => ({
      corpus, store, now: Date.now(), rng, domains: selectedDomains, levels: selectedLevels,
    }),
    [corpus, store, selectedDomains, selectedLevels],
  );
```

Add this comparison helper beside `labelForDomains` near the top of the file. Comparing by sorted key rather than element-wise keeps the check order-proof:

```ts
const levelKey = (levels: Level[]): string => [...levels].sort().join(",");
```

Then extend the existing focus effect. Settings is a separate route, so a level chosen there has to reach a feed that is already mounted. Comparing before restarting is the point: restarting on every focus would throw away the reader's place in the feed each time they came back from another tab.

```ts
  useFocusEffect(
    useCallback(() => {
      setSaved(new Set(store.getBookmarks()));
      refreshDueCount();
      // Picks up a level chosen in Settings, which is a separate route and so cannot
      // reach this screen's state directly. Restart only on an actual change.
      const stored = loadSelectedLevels(store.getSetting("selectedLevels"));
      if (levelKey(stored) !== levelKey(selectedLevels)) {
        setSelectedLevels(stored);
        restartSession({
          corpus, store, now: Date.now(), rng, domains: selectedDomains, levels: stored,
        });
      }
    }, [store, refreshDueCount, corpus, restartSession, selectedDomains, selectedLevels]),
  );
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npx jest __tests__/screens.test.tsx`
Expected: PASS, including every pre-existing Feed test.

- [ ] **Step 13: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/format.ts app/settings.tsx app/index.tsx __tests__/format.test.ts __tests__/screens.test.tsx
git commit -m "feat: choose feed levels in Settings"
```

---


### Task 6: Full verification

The corpus files are untouched, so the three corpus-facing commands are a regression check rather than a real risk. They still run, because CLAUDE.md requires all four before committing.

**Files:** none modified unless a check fails.

**Interfaces:**
- Consumes: everything from Tasks 1 to 5.
- Produces: a branch ready for review.

- [ ] **Step 1: Confirm no corpus file was touched**

Run: `git diff --stat main -- corpus/`
Expected: empty output. Any diff here means a task went wrong and must be reverted.

- [ ] **Step 2: Run the schema validator**

Run: `npm run validate-corpus`
Expected: PASS. Card counts and ranges are unchanged.

- [ ] **Step 3: Run the style checker**

Run: `npm run corpus-style`
Expected: PASS, including the 15% minimum share per difficulty at `scripts/corpus-style.ts:208`, which is unaffected because no card's `difficulty` changed.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 5: Run the link sweep**

Run: `npm run check-links`
Expected: PASS. This makes one network request per unique URL and is a build-time check only.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Check for stray dashes in the diff**

Run a check of the diff against main for the em dash and en dash characters, the same
pair matched by the `DASHES` regex in `scripts/corpus-style.ts`.
Expected: no matches. Any hit violates the repo's standing no-dashes rule and must be fixed.

- [ ] **Step 8: Drive the app**

Launch the app on a simulator and confirm by eye: a card's kicker reads "Computer Science - Undergrad", the Library's third chip row filters the count, and a level chosen in Settings changes what the feed serves after returning to it.

---

## Notes for the implementer

- **`corpus/*.json` is off limits.** If a step seems to need a card edited, stop and raise it.
- **The unfiltered path must stay byte-for-byte what ships today.** Every pre-existing test in `feed.test.ts` and `search.test.ts` passes no level filter, so if one of them breaks, the empty-means-everything convention was implemented wrong.
- The Library gains a third row of chrome above the list. If that reads as too heavy on a small phone, the fix is to fold the domain and level rows into one filter sheet. That refactor is deliberately out of scope; raise it rather than doing it.
- `DomainSheet` is not touched by any task in this plan.
