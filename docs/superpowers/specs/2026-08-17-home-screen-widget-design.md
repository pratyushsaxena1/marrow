# Home Screen Widget: Design

**Date:** 2026-08-17
**Status:** Approved, ready for planning
**Scope:** An iOS WidgetKit extension showing one card per day, in three families, deep
linking into the card detail screen. No corpus content changes. iOS only.

## Purpose

Marrow is read in bursts. A reader opens it, scrolls a few cards, and closes it. The
widget puts one card on the home screen where it is seen without opening anything, which
is the only surface the app has that costs the reader no decision to look at.

It is deliberately not a progress widget. It does not show a streak, a due count or how
many cards are mastered. Those are all reasons to feel behind. A concept is a reason to
read.

## What the widget shows

One card per day, chosen by the widget itself, rendered at whatever length the family has
room for.

| Family | Content |
| --- | --- |
| `systemSmall` | Kicker and title |
| `systemMedium` | Kicker, title, first sentence of the body |
| `systemLarge` | Kicker, title, full body |

The kicker is the short domain name and the level label, for example `CS . UNDERGRAD`.

These splits come from the corpus as it actually is. Across the 270 cards, titles run to a
median of 36 characters and a maximum of 62, prompts to a median of 99, and bodies to a
median of 400 characters and a maximum of 516. A body does not fit a small or medium
widget at a readable size, which is why the small family shows none of it. That is
tolerable only because CLAUDE.md already requires a title to be "a claim or a hook, not a
category label", so a title standing alone is a fact, not a heading.

Medium shows the first sentence rather than a character truncation. A hard cut lands
mid-clause, and a sentence is a unit the reader can finish. Tail truncation stays as the
backstop for a long first sentence or large Dynamic Type.

## Architecture

One new committed directory. `/ios` stays gitignored and is never hand edited.

### Prerequisites

`@bacons/apple-targets` requires CocoaPods 1.16.2 or newer, Xcode 16 or newer, and Expo
SDK 53 or newer. The development machine was checked against this before the design was
accepted: macOS 15.7.4, Xcode 26.3, CocoaPods 1.16.2, Expo 57.0.6. CocoaPods is exactly at
the floor, so a downgrade would break the build.

### `targets/widget/`

The extension's own source, injected into the Xcode project on every prebuild by
`@bacons/apple-targets`, pinned to exactly `5.0.0` and listed in `app.json`'s `plugins`.
It is a regular dependency rather than a dev dependency, because the app imports
`ExtensionStorage` from it at runtime and its native module has to autolink. The plugin creates the `PBXNativeTarget`, its build phases,
entitlements and the appex embed step, so the Expo prebuild workflow stays intact and
nothing about the app target's generated output changes.

The root `targets/` directory is the plugin's convention: every subdirectory holding an
`expo-target.config.js` becomes a target, and every file inside it becomes part of that
target. Our directory holds `expo-target.config.js`, the Swift sources, and the generated
card data under `assets/`, which is the path the plugin links as target resources rather
than as compiled sources.

The widget's bundle identifier is set as `.widget`, which the plugin appends to the app's,
giving `com.pratyushs123.marrow.widget`. `deploymentTarget` must be set explicitly to
`"16.4"`, because the plugin defaults to `18.0` and that default would silently drop every
reader below iOS 18.

This is the riskiest dependency in the repo, because it now sits in the prebuild path. It
was chosen over writing a bespoke plugin against `@expo/config-plugins` and the `xcode`
package, which would have meant hand building a native target, its build phases, its
Info.plist and the appex embed in several hundred lines of the most fragile code here.
Pinning exactly means an install never surprises us. It does not remove the coupling: an
SDK 58 upgrade can block on this package catching up.

### Reaching the shared container from JavaScript

We write no native module of our own. This design originally called for a local Expo
module of about forty lines of Swift, because React Native cannot reach `UserDefaults` and
the published packages that offer it (`expo-shared-preferences`,
`react-native-shared-group-preferences`) were last released in 2024 and 2023 respectively
and predate the New Architecture.

Inspecting `@bacons/apple-targets@5.0.0` showed it already ships exactly that module. It
exports an `ExtensionStorage` class backed by `ExtensionStorageModule.swift`:

```ts
import { ExtensionStorage } from "@bacons/apple-targets";

const storage = new ExtensionStorage("group.com.pratyushs123.marrow");
storage.set("preferences", json);
ExtensionStorage.reloadWidget();
```

`set` with a string calls `UserDefaults(suiteName:).set(_:forKey:)`, and `reloadWidget`
calls `WidgetCenter.shared.reloadAllTimelines()`, so a setting change reaches the home
screen immediately rather than at the system's next refresh.

Its JavaScript layer already substitutes no-op stubs when the native module is absent,
which is the path taken by Jest and by Android. That is precisely the safety our own
wrapper would have had to provide, so the wrapper is gone too. Deleting a directory of our
own Swift is the single biggest risk reduction found during planning.

### App Group

`group.com.pratyushs123.marrow`, declared once on the app through `app.json`'s
`ios.entitlements`. The plugin automatically mirrors that array onto targets that can use
App Groups, so the widget's config does not repeat it and the two cannot drift apart.

This is a credentials change to a shipping app. EAS must register the group and issue new
provisioning profiles for both targets on the first build. That step is the likeliest
thing to fail for reasons unrelated to the code, so it is done early rather than
discovered at submission.

### Deployment target

16.4 for both targets, matching the app today.

iOS 17 introduced `containerBackground(for: .widget)`, and a widget that does not adopt it
renders incorrectly on 17 and later. The background therefore goes behind an
`if #available(iOS 17, *)` with the plain background as the fallback. Raising the widget
to 17.0 would delete that branch at the cost of silently dropping iOS 16 readers from a
feature the app otherwise supports, which is not a trade worth taking for one modifier.

## The data path

### Card data

`scripts/build-widget-cards.ts` reads the four corpus files and writes
`targets/widget/assets/cards.json`, trimmed to the six fields the widget renders: `id`,
`domain`, `topic`, `title`, `body`, `difficulty`. That is roughly 167KB against 320KB for
the raw files. It lives under `assets/` because that is the directory the plugin links as
target resources; a JSON file elsewhere in the target directory is not guaranteed to be
copied into the appex.

Shipping the four corpus files unchanged as widget resources was considered, since Swift's
`JSONDecoder` ignores unknown keys and it would need no script at all. It does not work:
`@bacons/apple-targets` bundles the contents of the target directory, so the data has to
live physically under `targets/widget/` either way. Given that a copy step is unavoidable,
one trimmed file beats four duplicated ones.

The generated file is committed. A Jest test regenerates it in memory and asserts equality
with the committed copy, so editing a card without rerunning the generator fails
`npm test`, which is already one of the four required gates. This is the same shape as the
existing corpus validators: drift is caught by a gate rather than by a human remembering.

### Preferences

One key in the shared suite, holding a JSON string:

```json
{ "v": 1, "levels": [1, 2], "domains": ["cs", "math"] }
```

An empty array means every level, or every domain. This mirrors the convention the
difficulty levels design set, and it is what makes the failure mode safe: a missing,
corrupt or unparseable value degrades to showing everything rather than to showing
nothing.

`syncWidgetPreferences(store)` is the only writer. It is called from the three places
these values can change:

- the level chips in `app/settings.tsx`
- the domain sheet handler in `app/index.tsx`
- once on app launch, so an existing 1.2.0 install backfills settings that were chosen
  before the widget existed

Progress does not cross the boundary. Not `card_state`, not `review_log`, not `bookmarks`.
The widget never knows what the reader has seen. This keeps the widget useful on a fresh
install, keeps it from going stale when the app is not opened, and keeps the write path
down to two settings that change rarely instead of a write on every grade.

### Choosing the card

```
dayIndex = Calendar.current.ordinality(of: .day, in: .era, for: Date())
pool     = cards filtered by stored levels and domains, sorted by id
index    = (dayIndex * S) % pool.count
```

`S` is the first prime in a fixed list that does not divide `pool.count`. Because `S` is
prime and does not divide `count`, their greatest common divisor is 1, so the sequence
visits every card exactly once before any repeat: a 270 day cycle at the current corpus
size. Hashing the date would have been simpler and wrong, because collisions start
producing repeats within about three weeks.

If the filters yield an empty pool, the widget falls back to the whole corpus. Sorting by
id makes the pool order independent of the file order.

The day boundary is local, not UTC. CLAUDE.md requires UTC epoch milliseconds and forbids
local date arithmetic, and that rule is followed everywhere it was written for, which is
scheduling: travel and DST must not shift what is due. A widget rotation is not a
schedule, and a fact of the day that flips at 5pm Pacific would be the most visible thing
about the feature. This is a deliberate, scoped deviation and it is recorded here rather
than left to be found in the Swift.

`ordinality(of: .day, in: .era,)` is used rather than dividing a local `startOfDay` by
86400000, because that division can repeat or skip an index across a DST transition.
Timeline entries are built with `startOfDay(for:)` and `date(byAdding: .day,)`, which is
DST safe by construction.

A reader who crosses timezones can see the card change early or late. That is expected and
not worth defending against.

### Timeline

`getTimeline` returns seven entries, one per local day starting today, with policy
`.atEnd`. The widget therefore rotates correctly for a week even if the app is never
opened again and the system never wakes the extension. There is no background work and no
refresh budget to manage.

## Rendering

Dark in both appearances. The app is dark only (`userInterfaceStyle: "dark"`, background
`#0a0a0a`), so the widget paints that same background through `containerBackground` rather
than adapting to a light home screen. The system font throughout, and no images, so the
target needs no asset catalog and iOS 18 tinted rendering works without extra work.

The small family caps the title at four lines with a minimum scale factor, so a 62
character title still fits rather than truncating.

## Deep link

The widget sets `widgetURL` to `marrow:///card/<id>`, which the existing expo-router route
`app/card/[id].tsx` already handles. No new route, no new scheme, no change to
`app/_layout.tsx`.

Three slashes, not two, so `card` is parsed as the first path segment rather than as the
URL host. That is a claim to verify with `xcrun simctl openurl` before writing Swift
around it, because getting it wrong fails silently.

Arriving from the widget does not write `card_state`. Reading a card is not grading it,
and a tap that quietly moves a review schedule is a surprise.

## Testing

Jest covers what runs in JavaScript:

- `syncWidgetPreferences`: empty arrays normalize to "all"; the serialized payload shape;
  a no-op when the native module is absent, which is also the Jest and Android path.
- `targets/widget/assets/cards.json` still matches what `scripts/build-widget-cards.ts`
  produces.

Simulator verification covers what unit tests cannot: all three families render, a level
change in Settings reloads the home screen immediately, and a tap lands on the right card.
The project path contains spaces, so this uses the documented rsync workaround.

## Verification

All four commands from CLAUDE.md must pass before commit:

```bash
npm run validate-corpus
npm run corpus-style
npm test
npm run check-links
```

The corpus files are untouched, so the three corpus facing commands are a regression check
rather than a real risk. They still run.

## Rollout

Version 1.3.0. No new privacy disclosures: nothing is collected and no network call is
added, so the no network at runtime rule holds. The corpus already ships in the bundle and
now ships in the appex too, so the no runtime content generation rule holds as well.

## Branching

The widget reads `selectedLevels`, which exists only on `feat/difficulty-levels`. This
branch is cut from `feat/difficulty-levels` rather than from `main` so work can start
before PR #3 merges. It cannot merge before #3 does.

## Out of scope

- Android app widgets. WidgetKit and `AppWidgetProvider` share nothing but the concept, so
  Android is a second full implementation, not a port.
- Lock screen and StandBy accessory families.
- Interactive widgets: grading a card from the home screen through an `AppIntent`.
- The widget knowing what the reader has seen, or what is due.
- Control Center controls.
- Any change to `corpus/*.json`.

## Known gaps

**The Swift picker has no automated test.** Mirroring it in TypeScript was rejected: no
runtime code in the app would call that mirror, so the repo would carry dead code to
satisfy a test, and the mirror would not prove the Swift correct anyway. A Swift test
target would prove it, at the cost of a second generated target and more surface in the
config plugin. The mitigation is keeping the picker to about fifteen lines with no
dependencies, and verifying on the simulator. Recorded so it is a known gap rather than a
rediscovered one.

**The widget cannot distinguish a filter the reader chose from one they never set.** Both
arrive as an empty array meaning "everything", which is correct behavior and matches the
app. It does mean the widget cannot show a "you have filtered this" state, and it should
not try to.
