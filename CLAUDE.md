# Marrow

An offline iOS app: a vertical-scrolling feed of educational cards across computer
science, finance, mathematics and science, with spaced-repetition reviews interleaved
into the scroll. Expo, TypeScript strict, NativeWind, expo-sqlite, expo-router.

## Rules for any change

- **No network calls at runtime.** No backend, no accounts, no analytics, no
  permissions. A change that adds a `fetch` is wrong.
- **No runtime content generation.** Everything ships in the bundle.
- **All timestamps are UTC epoch milliseconds.** Never local-date arithmetic, never
  date strings. Travel and DST must not shift what is due.
- **No `any` in committed code.**
- **Randomness is injected** as `Rng = () => number` in `scheduler` and `feed` so tests
  stay deterministic. Never call `Math.random()` there.
- **No em dashes anywhere**, in code comments, docs, commit messages or card text.
  This is a standing preference of the repo owner, not a style suggestion.

## Writing corpus cards

This is the part of the repo that most needs a human standard held to it. The app's
entire premise is that the content is true and worth reading. A card that is wrong, or
that reads as machine output, costs more than a missing card.

### Where the content lives

`corpus/cs.json`, `corpus/finance.json`, `corpus/math.json`, `corpus/science.json`.
Each is a JSON array of `Card` objects (`src/types.ts`). Nothing else in the repo is
content.

### The schema contract

Enforced by `npm run validate-corpus` (`scripts/validate-corpus.ts`).

| Field | Rule |
| --- | --- |
| `id` | `<domain>-NNNN`, zero-padded to four digits, unique within the file |
| `type` | `concept` or `puzzle` |
| `domain` | must equal the file's domain |
| `topic` | free text, at most **two cards per topic per file** |
| `title` | a claim or a hook, not a category label |
| `body` | **40 to 90 words**, one idea |
| `prompt` | one question, answerable from the body alone |
| `answer` | **1 to 3 sentences**, actually answering the prompt |
| `difficulty` | `1` most educated adults follow it, `2` needs some background, `3` needs real familiarity |
| `sources` | `https://` only; concept cards need at least one |
| `tags` | 1 to 3 lowercase kebab-case tags |

**Ids are durable user-data keys, never renumbered.** `card_state.cardId` is the
primary key for a user's review history, so renumbering a card orphans that user's
progress. When you delete a card, its id retires with it. Gaps in the sequence are
correct and expected, and the validator deliberately does not check for them.

Everything except the id is safe to rewrite. Titles, bodies, prompts, answers,
difficulty and sources are not persisted anywhere, so revising the prose of an
existing card costs a user nothing.

### Accuracy

- **Every factual claim must be true and checkable against the cited source.** A card
  you are not confident about is a card you do not write. Prefer a smaller set of solid
  cards over hitting a count with filler. If you cannot reach a target confidently,
  write what you can and report the shortfall.
- **Do not invent URLs.** If you are not certain a page exists at a URL, do not cite
  it. Verify with the link sweep below before committing.
- **Finance and economics is the highest-risk domain.** Maths and CS claims are
  verifiable by derivation; economics contains genuinely contested claims that are easy
  to state with unearned confidence. Prefer mechanisms and definitions (how compounding
  works, what a bid-ask spread is, why bond prices and yields move inversely) over
  predictions and policy. Where a claim is genuinely contested, make the disagreement
  the content: "economists disagree about X, and the case on each side is Y and Z" is
  an honest card, whereas the same claim stated flatly makes the reader confidently
  wrong.

### Independence

Cards must be mutually independent. The feed order is random and a review shows the
prompt alone, so no card may reference another ("as we saw earlier"), and no prompt may
depend on context its own body did not give.

### Puzzle cards

The body is the setup and must contain everything needed to solve it. The prompt is the
question. The answer gives the solution **and** the key reasoning step. A puzzle whose
answer is "42" with no reasoning teaches nothing.

### Voice: how not to sound generated

Enforced by `npm run corpus-style` (`scripts/corpus-style.ts`). These thresholds are
not arbitrary. Each one came from auditing the corpus and finding the specific pattern
that gave it away.

**Length.** The validator allows 40 to 90 words, so write across that whole range. A
corpus where every body lands in the 80s is a corpus written to the ceiling, and in a
scrolling feed that uniformity is more visible than any word choice. Let a short idea
be short. Mean body length per file must be **76 words or fewer**, and at least **20%
of bodies must be 65 words or fewer**.

**Openers.** No single first word may open more than **25% of the titles** in a file,
and no single first two words more than **15% of the prompts**. Before this rule, 70%
of the science titles began "Why" and 39% of its prompts began "Why does". Vary the
construction: name the surprise, state the claim, describe the object.

**Dashes.** No em dashes and no en dashes. When you find yourself reaching for one, the
sentence usually wants a full stop, a colon, or brackets. Replacing every em dash with
a comma just trades one tic for another.

**Vocabulary.** A short banlist lives in the script (`delve`, `tapestry`, `at its
core`, `it's worth noting`, `not just X but Y`, and similar). It is short on purpose. A
long banlist teaches you to paraphrase around it rather than to write plainly.

**Structure to avoid.** Explaining an idea and then closing with a sentence that names
it ("This is amortized analysis: pricing a rare expensive operation across the cheap
ones") is fine once. It was a template across the corpus. Vary where the name lands, or
leave it to the answer.

**Spelling.** British throughout: colour, behaviour, centre, metre, analyse, organise,
recognise, labelled, defence. The script catches the American forms. Two deliberate
exceptions, both entrenched terms of art whose -z spelling is standard even in
British-published texts: "amortized analysis" and the SERIALIZABLE isolation level.
Normalising those would make the corpus read as though it did not know the field.

**Characters.** ASCII plus a small allowlist of maths symbols, currency signs and
accents, all listed in the script. Straight quotes only. Use one convention for
formulae within a card and do not mix a Unicode minus with an ASCII hyphen.

**Difficulty.** At least **15% of each file at each of the three levels**. Labelling
almost everything a 2 is what happens when difficulty is assigned by reflex, and it
leaves the app with no gentle on-ramp. Assign it honestly; if a file genuinely cannot
reach the spread, say so rather than mislabelling a card.

**Sources.** No single host may exceed **80% of a file's sources**. Wikipedia is a
legitimate reference and a reasonable fallback, but a corpus sourced entirely to one
site has decorative citations. Reach for the primary or official reference when you
know it: RFCs, language and database documentation, standards bodies, central banks and
statistical agencies, NASA, NIST, the Stanford Encyclopedia of Philosophy.

### Adding cards

1. Write them into the domain file, continuing the id sequence from the current
   maximum. Never reuse a retired id.
2. Update the expected counts in `scripts/validate-corpus.ts` (`EXPECTED`).
3. Update the total in `__tests__/corpus.test.ts` (three assertions).
4. Run the full verification below.

### Verification

```bash
npm run validate-corpus   # schema: counts, ranges, uniqueness, topic caps
npm run corpus-style      # voice: dashes, length, openers, spelling, spread, sources
npm test                  # the suite, including corpus tests
npm run check-links       # every source URL resolves
```

All four must pass before committing content. `check-links` makes a network request per
unique URL, which is a build-time check only and does not touch the app's
no-network-at-runtime rule.
