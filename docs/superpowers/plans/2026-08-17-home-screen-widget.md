# Home Screen Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an iOS home screen widget that shows one Marrow card per day in three sizes and deep links into that card.

**Architecture:** A WidgetKit extension is injected on every Expo prebuild by `@bacons/apple-targets`, so `/ios` stays gitignored and regenerable. A trimmed copy of the corpus ships inside the extension bundle, so the widget picks its own card with no network, no database access and no dependence on the app having run. Only the reader's level and subject filters cross the App Group boundary.

**Tech Stack:** Expo SDK 57, TypeScript strict, Swift 5 / SwiftUI / WidgetKit, `@bacons/apple-targets@5.0.0`, Jest.

**Spec:** `docs/superpowers/specs/2026-08-17-home-screen-widget-design.md`

## Global Constraints

- **No network calls at runtime.** Anywhere, including Swift. A `fetch` or a `URLSession` is wrong.
- **No runtime content generation.** All card text ships in the bundle.
- **No em dashes and no en dashes** in code, comments, docs or commit messages.
- **No `any`** in committed TypeScript.
- All timestamps in TypeScript are UTC epoch milliseconds. The widget's day boundary in Swift is the one deliberate, documented exception: it is local, per the spec.
- App Group identifier: `group.com.pratyushs123.marrow`
- Widget bundle identifier: `com.pratyushs123.marrow.widget` (written as `".widget"` in the target config, which the plugin appends to the app's).
- Widget deployment target: `"16.4"`. The plugin defaults to `18.0`, so this must be set explicitly.
- The widget target config must declare `entitlements: {}`. The plugin skips App Group mirroring entirely when the key is absent, so an empty object is load bearing.
- Shared preferences key: `preferences`. Value is a JSON **string**.
- Deep link format: `marrow:///card/<id>` with three slashes.
- `@bacons/apple-targets` is pinned to exactly `5.0.0` as a regular dependency, not a dev dependency.
- Prerequisites already verified on this machine: macOS 15.7.4, Xcode 26.3, CocoaPods 1.16.2, Expo 57.0.6.
- Verification gates that must pass before every commit: `npm run validate-corpus`, `npm run corpus-style`, `npm test`, `npm run check-links`.

## File Structure

**Created:**
- `targets/widget/expo-target.config.js` - target declaration read by the config plugin
- `targets/widget/Card.swift` - card model, bundle loader, display labels
- `targets/widget/Selection.swift` - preferences decoding and the daily pick
- `targets/widget/MarrowWidget.swift` - timeline provider, views, widget entry point
- `targets/widget/assets/cards.json` - generated, committed card data
- `scripts/build-widget-cards.ts` - generator for the above
- `src/widget/preferences.ts` - the only writer to the shared container
- `__tests__/widget-cards.test.ts` - asserts the generated file is not stale
- `__tests__/widget-preferences.test.ts` - preference payload behavior

**Modified:**
- `app.json` - plugin registration, App Group entitlement, version bump
- `package.json` - the `build-widget-cards` script
- `src/format.ts` - gains `loadSelectedDomains`, moved out of `app/index.tsx`
- `app/index.tsx` - imports the moved helper, syncs on launch and on domain change
- `app/settings.tsx` - syncs on level change
- `CLAUDE.md` - a section on the widget and the regeneration step
- `.gitignore` - ignore the plugin's derived `ios/.targets` output if it lands outside `/ios`

---

### Task 1: The extension exists and survives prebuild

Prove the riskiest part first: that a native target can be generated from JavaScript, repeatedly. The widget renders hardcoded text at this stage. No card data, no preferences, no logic.

**Files:**
- Create: `targets/widget/expo-target.config.js`
- Create: `targets/widget/MarrowWidget.swift`
- Modify: `app.json`

**Interfaces:**
- Consumes: nothing.
- Produces: a widget target named `MarrowWidget` with kind string `"MarrowWidget"`, App Group `group.com.pratyushs123.marrow` on both the app and the widget.

- [ ] **Step 1: Register the plugin and the App Group in `app.json`**

Add `"@bacons/apple-targets"` as the last element of `expo.plugins`, and add an `entitlements` block inside `expo.ios`. The plugin mirrors this App Group array onto the widget target, so the array itself is declared once here and never repeated in the target config. The target config must still declare an empty `entitlements: {}` for the mirror to run at all; see Step 2.

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.pratyushs123.marrow",
  "buildNumber": "12",
  "entitlements": {
    "com.apple.security.application-groups": ["group.com.pratyushs123.marrow"]
  },
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false
  },
  "icon": {
    "light": "./assets/icon.png",
    "dark": "./assets/icon-dark.png",
    "tinted": "./assets/icon-tinted.png"
  }
},
```

```json
"plugins": [
  "expo-router",
  "expo-sqlite",
  "expo-status-bar",
  "@bacons/apple-targets"
],
```

- [ ] **Step 2: Declare the target**

Create `targets/widget/expo-target.config.js`:

```js
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "MarrowWidget",
  displayName: "Marrow",
  // A leading dot appends to the app's bundle identifier.
  bundleIdentifier: ".widget",
  // The plugin defaults to 18.0. Marrow's app target is 16.4 and the widget matches it,
  // so a reader on iOS 16 is not silently excluded from the feature.
  deploymentTarget: "16.4",
  // Load bearing despite being empty. The plugin mirrors the app's App Group onto this
  // target from inside `if (entitlementsJson)` in build/with-widget.js, so omitting the
  // key entirely skips both the mirror and the generated.entitlements file. An empty
  // object is truthy, which is all it takes to reach the mirror.
  entitlements: {},
};
```

- [ ] **Step 3: Write the placeholder widget**

Create `targets/widget/MarrowWidget.swift`. This is thrown away in Task 5; it exists only to prove the target compiles and appears in the widget gallery.

```swift
import SwiftUI
import WidgetKit

struct PlaceholderEntry: TimelineEntry {
    let date: Date
}

struct PlaceholderProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlaceholderEntry {
        PlaceholderEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (PlaceholderEntry) -> Void) {
        completion(PlaceholderEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PlaceholderEntry>) -> Void) {
        completion(Timeline(entries: [PlaceholderEntry(date: Date())], policy: .never))
    }
}

struct PlaceholderView: View {
    var body: some View {
        Text("Marrow")
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.white)
    }
}

@main
struct MarrowWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MarrowWidget", provider: PlaceholderProvider()) { _ in
            PlaceholderView()
        }
        .configurationDisplayName("Marrow")
        .description("A concept from your library, new each day.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
```

- [ ] **Step 4: Prebuild and verify the target was generated**

Prebuild is pure JavaScript, so it runs fine in place despite the spaces in the path. Only `xcodebuild` needs the spaces-free copy.

Run:
```bash
npx expo prebuild -p ios --clean
```

Expected: completes without error.

Then verify the target actually landed, rather than trusting the log:
```bash
grep -c "MarrowWidget" ios/marrow.xcodeproj/project.pbxproj
grep -n "com.apple.security.application-groups" -A 3 ios/marrow/marrow.entitlements
ls ios/.targets/MarrowWidget/
```

Expected: the first prints a non-zero count, the second shows `group.com.pratyushs123.marrow`, and the third lists a `generated.entitlements` file. If any of these fail, stop and report. Do not continue to Task 2 with a broken generation step.

- [ ] **Step 5: Verify prebuild is repeatable**

Run `npx expo prebuild -p ios --clean` a second time and repeat the three checks from Step 4. This is the property the whole design rests on, so it is worth one extra minute.

- [ ] **Step 6: Ignore the plugin's derived output**

Check whether the plugin wrote anything outside `/ios`:
```bash
git status --short
```

`/ios` is already gitignored. If `git status` shows any other newly generated path, add it to `.gitignore` with a comment saying it is derived by the config plugin. If it shows nothing beyond the files you authored, skip this step.

- [ ] **Step 7: Run the gates and commit**

```bash
npm run validate-corpus && npm run corpus-style && npm test && npm run check-links
```

All four must pass. The corpus is untouched, so the three corpus commands are a regression check.

```bash
git add app.json package.json package-lock.json targets/ .gitignore
git commit -m "feat: generate a WidgetKit target from the Expo config

The extension is injected on every prebuild by @bacons/apple-targets, so
/ios stays gitignored and regenerable. This commit only proves the target
builds; it renders placeholder text.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Card data for the extension bundle

The widget cannot read `corpus/*.json` from the app bundle, and cannot import TypeScript. It gets a trimmed, generated copy inside its own bundle.

**Files:**
- Create: `scripts/build-widget-cards.ts`
- Create: `targets/widget/assets/cards.json` (generated)
- Create: `__tests__/widget-cards.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Card` from `src/types.ts`.
- Produces: `buildWidgetCards(): string`, exported from `scripts/build-widget-cards.ts`, returning the exact file contents including the trailing newline. `targets/widget/assets/cards.json` is a JSON array of objects with keys `id`, `domain`, `title`, `body`, `difficulty`, sorted by `id`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/widget-cards.test.ts`:

```ts
import { readFileSync } from "fs";
import { join } from "path";
import { buildWidgetCards, WIDGET_CARDS_PATH } from "../scripts/build-widget-cards";
import { loadCorpus } from "../src/corpus";

describe("widget card data", () => {
  it("matches the committed file, so a corpus edit cannot ship stale widget data", () => {
    const committed = readFileSync(WIDGET_CARDS_PATH, "utf8");
    expect(committed).toBe(buildWidgetCards());
  });

  it("carries every card, trimmed to the fields the widget renders", () => {
    const cards: unknown = JSON.parse(buildWidgetCards());
    expect(Array.isArray(cards)).toBe(true);
    const list = cards as Record<string, unknown>[];
    expect(list).toHaveLength(loadCorpus().length);
    expect(Object.keys(list[0]).sort()).toEqual(
      ["body", "difficulty", "domain", "id", "title"],
    );
  });

  it("is sorted by id, so the widget's pool order does not depend on file order", () => {
    const list = JSON.parse(buildWidgetCards()) as { id: string }[];
    const ids = list.map((c) => c.id);
    expect(ids).toEqual([...ids].sort());
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest __tests__/widget-cards.test.ts`
Expected: FAIL, cannot find module `../scripts/build-widget-cards`.

- [ ] **Step 3: Write the generator**

Create `scripts/build-widget-cards.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Card, Domain } from "../src/types";

const DOMAINS: Domain[] = ["cs", "finance", "math", "science"];
const OUT_DIR = join(__dirname, "..", "targets", "widget", "assets");
export const WIDGET_CARDS_PATH = join(OUT_DIR, "cards.json");

/** The five fields the widget renders. Answers, prompts, sources, tags and topic are
 *  left behind: no layout shows them, and shipping them would inflate the payload. */
type WidgetCard = Pick<Card, "id" | "domain" | "title" | "body" | "difficulty">;

/** Returns the exact bytes the committed file should hold. Kept pure so a test can
 *  compare against the file without writing to disk. */
export function buildWidgetCards(): string {
  const cards: WidgetCard[] = [];
  for (const domain of DOMAINS) {
    const raw = readFileSync(join(__dirname, "..", "corpus", `${domain}.json`), "utf8");
    for (const card of JSON.parse(raw) as Card[]) {
      cards.push({
        id: card.id,
        domain: card.domain,
        title: card.title,
        body: card.body,
        difficulty: card.difficulty,
      });
    }
  }
  cards.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `${JSON.stringify(cards)}\n`;
}

if (require.main === module) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(WIDGET_CARDS_PATH, buildWidgetCards());
  console.log(`Wrote ${WIDGET_CARDS_PATH}`);
}
```

- [ ] **Step 4: Add the npm script**

In `package.json`, beside the other `ts-node` scripts:

```json
"build-widget-cards": "ts-node --compilerOptions '{\"module\":\"commonjs\"}' scripts/build-widget-cards.ts",
```

- [ ] **Step 5: Generate the file**

Run: `npm run build-widget-cards`
Expected: prints the written path. Confirm the size is in the region of 167KB with `ls -lh targets/widget/assets/cards.json`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest __tests__/widget-cards.test.ts`
Expected: 3 passing.

- [ ] **Step 7: Run the gates and commit**

```bash
npm run validate-corpus && npm run corpus-style && npm test && npm run check-links
```

```bash
git add scripts/build-widget-cards.ts targets/widget/assets/cards.json __tests__/widget-cards.test.ts package.json
git commit -m "feat: generate the card data that ships inside the widget bundle

A test compares the committed file against a fresh build, so editing a card
without rerunning the generator fails npm test rather than shipping a stale
widget.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The preferences bridge

The only thing that crosses the App Group boundary. No progress, no card state, ever.

**Files:**
- Create: `src/widget/preferences.ts`
- Create: `__tests__/widget-preferences.test.ts`
- Modify: `src/format.ts`
- Modify: `app/index.tsx`
- Modify: `app/settings.tsx`

**Interfaces:**
- Consumes: `Store` from `src/store`, `loadSelectedLevels` from `src/format`, `ExtensionStorage` from `@bacons/apple-targets`.
- Produces:
  - `loadSelectedDomains(raw: string | null): Domain[]` exported from `src/format.ts`
  - `APP_GROUP: string` and `PREFERENCES_KEY: string` from `src/widget/preferences.ts`
  - `type WidgetPreferences = { v: 1; levels: Level[]; domains: Domain[] }`
  - `readWidgetPreferences(store: PreferenceSource): WidgetPreferences`
  - `syncWidgetPreferences(store: PreferenceSource): void`
  - `type PreferenceSource = Pick<Store, "getSetting">`

- [ ] **Step 1: Write the failing test**

Create `__tests__/widget-preferences.test.ts`:

```ts
import { readWidgetPreferences } from "../src/widget/preferences";

// A stand-in for the store's read side. The bridge only ever reads two keys, so the
// whole dependency is one function.
const source = (settings: Record<string, string>) => ({
  getSetting: (key: string): string | null => settings[key] ?? null,
});

describe("readWidgetPreferences", () => {
  it("reports every level and every subject when nothing is set", () => {
    expect(readWidgetPreferences(source({}))).toEqual({ v: 1, levels: [], domains: [] });
  });

  it("carries a narrowed selection through", () => {
    const prefs = readWidgetPreferences(
      source({
        selectedLevels: JSON.stringify([1, 3]),
        selectedDomains: JSON.stringify(["cs", "math"]),
      }),
    );
    expect(prefs).toEqual({ v: 1, levels: [1, 3], domains: ["cs", "math"] });
  });

  it("degrades a malformed value to everything rather than to nothing", () => {
    const prefs = readWidgetPreferences(
      source({ selectedLevels: "not json", selectedDomains: '{"not":"an array"}' }),
    );
    expect(prefs).toEqual({ v: 1, levels: [], domains: [] });
  });

  it("drops values that are not real levels or subjects", () => {
    const prefs = readWidgetPreferences(
      source({
        selectedLevels: JSON.stringify([1, 9]),
        selectedDomains: JSON.stringify(["cs", "history"]),
      }),
    );
    expect(prefs).toEqual({ v: 1, levels: [1], domains: ["cs"] });
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest __tests__/widget-preferences.test.ts`
Expected: FAIL, cannot find module `../src/widget/preferences`.

- [ ] **Step 3: Move `loadSelectedDomains` into `src/format.ts`**

`app/index.tsx` currently defines this privately at lines 28 to 38. The widget bridge needs it too, and duplicating it would let the two copies drift. Move it beside `loadSelectedLevels`, which already lives in `src/format.ts`.

Add to `src/format.ts` (it already imports `LEVELS` from `../constants`; add `DOMAINS` to that import and `Domain` to its type import):

```ts
// Reads the persisted subject filter. A missing or malformed value means "all subjects"
// (the empty array), so a corrupt setting degrades to the default rather than crashing.
export function loadSelectedDomains(raw: string | null): Domain[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is Domain => DOMAINS.includes(d as Domain));
  } catch {
    return [];
  }
}
```

Then delete the local copy from `app/index.tsx` and add `loadSelectedDomains` to the existing `import { loadSelectedLevels } from "../src/format";` line. Nothing else in `app/index.tsx` changes in this step.

- [ ] **Step 4: Write the bridge**

Create `src/widget/preferences.ts`:

```ts
import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";
import { loadSelectedDomains, loadSelectedLevels } from "../format";
import type { Domain, Level } from "../types";
import type { Store } from "../store";

/** Shared with the widget extension, declared in app.json's ios.entitlements and
 *  mirrored onto the widget target by the config plugin. */
export const APP_GROUP = "group.com.pratyushs123.marrow";
export const PREFERENCES_KEY = "preferences";

/** An empty array means every level, or every subject, matching the convention the feed
 *  and Library filters already use. The version tag lets a future widget build recognize
 *  a payload written by an older app without guessing. */
export type WidgetPreferences = { v: 1; levels: Level[]; domains: Domain[] };

/** The bridge only reads. It must never see card state, the review log or bookmarks. */
export type PreferenceSource = Pick<Store, "getSetting">;

export function readWidgetPreferences(store: PreferenceSource): WidgetPreferences {
  return {
    v: 1,
    levels: loadSelectedLevels(store.getSetting("selectedLevels")),
    domains: loadSelectedDomains(store.getSetting("selectedDomains")),
  };
}

/** Writes the reader's filters into the shared container and refreshes the home screen.
 *  A no-op off iOS. ExtensionStorage substitutes no-op stubs when its native module is
 *  absent, which is the path Jest takes, so this is safe to call from a test too. */
export function syncWidgetPreferences(store: PreferenceSource): void {
  if (Platform.OS !== "ios") return;
  const storage = new ExtensionStorage(APP_GROUP);
  storage.set(PREFERENCES_KEY, JSON.stringify(readWidgetPreferences(store)));
  ExtensionStorage.reloadWidget();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest __tests__/widget-preferences.test.ts`
Expected: 4 passing.

- [ ] **Step 6: Call it from the three places these settings change**

In `app/settings.tsx`, add the import and one call at the end of `toggleLevel`:

```ts
import { syncWidgetPreferences } from "../src/widget/preferences";
```

```ts
  const toggleLevel = (l: Level) => {
    const next = levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l];
    // Covering all three means the same as choosing none: every level.
    const canonical = next.length === LEVELS.length ? [] : next;
    store.putSetting("selectedLevels", JSON.stringify(canonical));
    setLevels(canonical);
    syncWidgetPreferences(store);
  };
```

In `app/index.tsx`, add the import and one call at the end of `applyDomains`:

```ts
import { syncWidgetPreferences } from "../src/widget/preferences";
```

```ts
  const applyDomains = useCallback(
    (domains: Domain[]) => {
      store.putSetting("selectedDomains", JSON.stringify(domains));
      setSelectedDomains(domains);
      setSheetOpen(false);
      restartSession(deps({ domains }));
      syncWidgetPreferences(store);
    },
    [store, restartSession, deps],
  );
```

Also in `app/index.tsx`, sync once on mount so an install upgrading from 1.2.0 backfills filters chosen before the widget existed. Add this effect beside the existing effects, after `refreshDueCount` is defined:

```ts
  // Backfills the shared container on launch. An install upgrading from 1.2.0 already
  // has filters chosen, and the widget has never seen them.
  useEffect(() => {
    syncWidgetPreferences(store);
  }, [store]);
```

Confirm `useEffect` is in the existing `react` import; add it if not.

- [ ] **Step 7: Run the gates and commit**

```bash
npm run validate-corpus && npm run corpus-style && npm test && npm run check-links
```

```bash
git add src/widget/preferences.ts src/format.ts app/index.tsx app/settings.tsx __tests__/widget-preferences.test.ts
git commit -m "feat: mirror the level and subject filters into the App Group

The widget picks its own card, so only the reader's filters cross the
boundary. Progress never does. loadSelectedDomains moves into src/format
beside loadSelectedLevels so the app and the bridge cannot drift.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The Swift model and the daily pick

**Files:**
- Create: `targets/widget/Card.swift`
- Create: `targets/widget/Selection.swift`

**Interfaces:**
- Consumes: `targets/widget/assets/cards.json` from Task 2.
- Produces:
  - `struct Card: Decodable` with `id`, `domain`, `title`, `body: String`, `difficulty: Int`
  - `enum CardLoader { static func load() -> [Card] }`
  - `enum Labels { static func domain(_:) -> String; static func level(_:) -> String }`
  - `struct Preferences: Decodable` with `levels: [Int]`, `domains: [String]`, `static let all`, `static func load(appGroup:) -> Preferences`
  - `enum DailyCard { static func dayIndex(for:calendar:) -> Int; static func card(on:from:prefs:) -> Card? }`

- [ ] **Step 1: Write the model and loader**

Create `targets/widget/Card.swift`:

```swift
import Foundation

/// The five fields scripts/build-widget-cards.ts writes. JSONDecoder ignores unknown
/// keys, so adding a field to the generator will not break an older widget build.
struct Card: Decodable {
    let id: String
    let domain: String
    let title: String
    let body: String
    let difficulty: Int
}

enum CardLoader {
    /// Cards ship inside the extension bundle, so the widget reads no network and never
    /// touches the app's database. An unreadable file yields an empty array, and the
    /// caller renders an empty state rather than crashing the extension.
    ///
    /// Two lookups because the config plugin links `assets/` as target resources, and
    /// whether Xcode flattens that directory or preserves it as a folder reference
    /// decides which name resolves. Trying both costs nothing and the alternative is a
    /// silently empty widget. Task 6 confirms which one actually hits.
    static func load() -> [Card] {
        let url = Bundle.main.url(forResource: "cards", withExtension: "json")
            ?? Bundle.main.url(forResource: "assets/cards", withExtension: "json")
        guard let url,
              let data = try? Data(contentsOf: url),
              let cards = try? JSONDecoder().decode([Card].self, from: data)
        else { return [] }
        return cards
    }
}

/// The app's vocabulary, repeated here because the extension cannot import TypeScript.
/// These must stay in step with DOMAIN_LABELS_SHORT and LEVEL_LABELS in src/constants.ts.
enum Labels {
    static func domain(_ value: String) -> String {
        switch value {
        case "cs": return "CS"
        case "finance": return "Finance"
        case "math": return "Math"
        case "science": return "Science"
        default: return value
        }
    }

    /// Falls back to "Undergrad" out of range, matching difficultyLabel in src/format.ts.
    static func level(_ value: Int) -> String {
        switch value {
        case 1: return "High school"
        case 3: return "Graduate+"
        default: return "Undergrad"
        }
    }
}
```

- [ ] **Step 2: Write the preferences reader and the picker**

Create `targets/widget/Selection.swift`:

```swift
import Foundation

/// Written by src/widget/preferences.ts. An empty array means every level, or every
/// subject, matching the app's own filter convention.
struct Preferences: Decodable {
    let levels: [Int]
    let domains: [String]

    static let all = Preferences(levels: [], domains: [])

    /// A missing, unreadable or unparseable value degrades to showing everything rather
    /// than to showing nothing, which is the same failure direction the app takes.
    static func load(appGroup: String) -> Preferences {
        guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "preferences"),
              let data = raw.data(using: .utf8),
              let parsed = try? JSONDecoder().decode(Preferences.self, from: data)
        else { return .all }
        return parsed
    }
}

enum DailyCard {
    /// Candidate strides, all prime. A prime that does not divide the pool size is
    /// coprime with it, which makes the sequence visit every card exactly once before
    /// repeating. Hashing the date instead would start repeating within about three
    /// weeks.
    private static let candidateStrides = [97, 89, 83, 79, 73, 71, 67, 61, 59, 53,
                                           47, 43, 41, 37, 31, 29, 23, 19, 17, 13,
                                           11, 7, 5, 3, 2]

    /// Named `strideLength` rather than `stride` so it cannot be confused with Swift's
    /// global `stride(from:to:by:)` at the call site.
    static func strideLength(for count: Int) -> Int {
        candidateStrides.first { $0 < count && count % $0 != 0 } ?? 1
    }

    /// A day number that increments at local midnight. Deliberately local rather than
    /// UTC: a fact of the day that flips in the middle of the afternoon would be the
    /// most visible thing about the widget. See the design doc for why this is a scoped
    /// exception to the repo's UTC rule. Using ordinality rather than dividing a local
    /// startOfDay by 86400 avoids repeating or skipping a day across a DST change.
    static func dayIndex(for date: Date, calendar: Calendar = .current) -> Int {
        calendar.ordinality(of: .day, in: .era, for: date) ?? 0
    }

    static func pool(_ cards: [Card], _ prefs: Preferences) -> [Card] {
        let filtered = cards.filter { card in
            (prefs.levels.isEmpty || prefs.levels.contains(card.difficulty))
                && (prefs.domains.isEmpty || prefs.domains.contains(card.domain))
        }
        // An empty result means corrupt preferences, never a real choice: the app
        // normalizes "everything deselected" to the empty array. Fall back to the whole
        // corpus rather than showing an empty widget.
        return (filtered.isEmpty ? cards : filtered).sorted { $0.id < $1.id }
    }

    static func card(on day: Int, from cards: [Card], prefs: Preferences) -> Card? {
        let candidates = pool(cards, prefs)
        guard !candidates.isEmpty else { return nil }
        // Reducing day before multiplying keeps the product small. It is equivalent:
        // (day * s) % n == ((day % n) * s) % n.
        let index = ((day % candidates.count) * strideLength(for: candidates.count)) % candidates.count
        return candidates[index]
    }
}
```

- [ ] **Step 3: Verify it compiles**

There is no Swift test target, by the design's recorded decision, so compilation is the gate here. Run:

```bash
npx expo prebuild -p ios --clean
```

Expected: succeeds. Confirm both files were linked into the target:
```bash
grep -c "Selection.swift" ios/marrow.xcodeproj/project.pbxproj
```
Expected: non-zero. A full compile happens in Task 6.

- [ ] **Step 4: Commit**

```bash
npm run validate-corpus && npm run corpus-style && npm test && npm run check-links
```

```bash
git add targets/widget/Card.swift targets/widget/Selection.swift
git commit -m "feat: decode the bundled cards and pick one per local day

A prime stride coprime with the pool size walks every card exactly once
before repeating, so a reader sees 270 distinct cards before the first
repeat.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The timeline and the three layouts

Replaces the placeholder from Task 1 entirely.

**Files:**
- Modify: `targets/widget/MarrowWidget.swift` (full rewrite)

**Interfaces:**
- Consumes: `Card`, `CardLoader`, `Labels`, `Preferences`, `DailyCard` from Task 4.
- Produces: the shipping widget. Kind string stays `"MarrowWidget"`.

- [ ] **Step 1: Rewrite `targets/widget/MarrowWidget.swift`**

Delete the placeholder content and write:

```swift
import SwiftUI
import WidgetKit

private let appGroup = "group.com.pratyushs123.marrow"
// #0a0a0a, the app's background. Named so it cannot collide with View.background(_:)
// when referenced from inside the View extension at the bottom of this file.
private let marrowInk = Color(red: 0.039, green: 0.039, blue: 0.039)

struct CardEntry: TimelineEntry {
    let date: Date
    let card: Card?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> CardEntry {
        CardEntry(date: Date(), card: CardLoader.load().first)
    }

    func getSnapshot(in context: Context, completion: @escaping (CardEntry) -> Void) {
        completion(entry(for: Date()))
    }

    /// A week of entries, one per local midnight. The widget keeps rotating even if the
    /// app is never opened again and the system never wakes the extension, so there is
    /// no background work and no refresh budget to manage.
    func getTimeline(in context: Context, completion: @escaping (Timeline<CardEntry>) -> Void) {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let cards = CardLoader.load()
        let prefs = Preferences.load(appGroup: appGroup)
        let entries = (0 ..< 7).compactMap { offset -> CardEntry? in
            guard let date = calendar.date(byAdding: .day, value: offset, to: today) else {
                return nil
            }
            let day = DailyCard.dayIndex(for: date, calendar: calendar)
            return CardEntry(date: date, card: DailyCard.card(on: day, from: cards, prefs: prefs))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func entry(for date: Date) -> CardEntry {
        let day = DailyCard.dayIndex(for: date)
        let card = DailyCard.card(
            on: day,
            from: CardLoader.load(),
            prefs: Preferences.load(appGroup: appGroup)
        )
        return CardEntry(date: date, card: card)
    }
}

struct MarrowWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CardEntry

    var body: some View {
        Group {
            if let card = entry.card {
                content(card)
            } else {
                Text("Open Marrow to get started")
                    .font(.system(size: 15))
                    .foregroundStyle(Color(white: 0.62))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(entry.card.flatMap { URL(string: "marrow:///card/\($0.id)") })
        .marrowBackground()
    }

    private func content(_ card: Card) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(Labels.domain(card.domain)) \u{00B7} \(Labels.level(card.difficulty))".uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(Color(white: 0.45))
                .lineLimit(1)

            Text(card.title)
                .font(.system(size: titleSize, weight: .semibold))
                .foregroundStyle(Color(white: 0.95))
                .lineLimit(titleLines)
                .minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)

            if let text = bodyText(card) {
                Text(text)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(white: 0.68))
                    .lineLimit(bodyLines)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
    }

    private var titleSize: CGFloat { family == .systemLarge ? 22 : 16 }

    /// The small family has no body text, so the title gets the room instead.
    private var titleLines: Int { family == .systemSmall ? 4 : 2 }

    private var bodyLines: Int { family == .systemLarge ? 14 : 3 }

    private func bodyText(_ card: Card) -> String? {
        switch family {
        case .systemSmall: return nil
        case .systemLarge: return card.body
        default: return firstSentence(of: card.body)
        }
    }
}

/// The medium family has room for one sentence, and a sentence is a unit the reader can
/// finish. A character count truncation lands mid clause instead.
func firstSentence(of text: String) -> String {
    let cut = [". ", "? ", "! "]
        .compactMap { text.range(of: $0)?.lowerBound }
        .min()
    guard let cut else { return text }
    return String(text[text.startIndex ... cut])
}

private extension View {
    /// iOS 17 requires containerBackground or the widget renders incorrectly. 16.4 has
    /// no such API, so it paints and pads the background itself.
    @ViewBuilder
    func marrowBackground() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(marrowInk, for: .widget)
        } else {
            padding(16).background(marrowInk)
        }
    }
}

@main
struct MarrowWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MarrowWidget", provider: Provider()) { entry in
            MarrowWidgetView(entry: entry)
        }
        .configurationDisplayName("Marrow")
        .description("A concept from your library, new each day.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
```

- [ ] **Step 2: Verify the project still generates**

Run: `npx expo prebuild -p ios --clean`
Expected: succeeds.

- [ ] **Step 3: Run the gates and commit**

```bash
npm run validate-corpus && npm run corpus-style && npm test && npm run check-links
```

```bash
git add targets/widget/MarrowWidget.swift
git commit -m "feat: render the daily card in three widget sizes

Small shows the title alone, medium adds the first sentence of the body,
large holds the whole body. Tapping opens that card in the app.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Verify it on a simulator

The first time any of this is compiled or run. Unit tests cannot reach it.

**Files:** none. This task changes nothing unless it finds a defect.

**Interfaces:**
- Consumes: everything from Tasks 1 to 5.

- [ ] **Step 1: Copy the project somewhere without spaces**

`npx expo run:ios` fails in place because the project path contains spaces. Copy it out:

```bash
SRC="/Users/pratyush/Downloads/Important_Permanent/College/Side Projects/Current Projects/Marrow"
rsync -a --delete --exclude node_modules --exclude ios --exclude android --exclude .git --exclude .expo "$SRC/" /tmp/marrow-sim/
rsync -a "$SRC/node_modules" /tmp/marrow-sim/
find /tmp/marrow-sim/node_modules -type d -name .DerivedData -prune -exec rm -rf {} +
```

The `.DerivedData` deletion is required. `expo-modules-jsi/apple/.DerivedData` holds precompiled headers that record their original absolute module cache path, and `xcodebuild` fails four times over with `error: PCH was compiled with module cache path ...` if they survive the copy.

- [ ] **Step 2: Build and launch**

```bash
xcrun simctl list devices available | grep -i iphone
cd /tmp/marrow-sim && npx expo run:ios --configuration Release --device <simulator-udid>
```

Use Release, not Debug. Debug needs the dev client, which raises an "Open in Marrow?" system dialog that cannot be dismissed here. Release embeds the JS bundle and launches straight into the app.

Expected: the app builds, including the `MarrowWidget` target, and launches. If the widget target fails to compile, that is a real defect: fix it in the source directory, re-run the rsync, and rebuild. Never fix it in `/tmp/marrow-sim`, whose changes are thrown away.

- [ ] **Step 3: Verify the deep link format before trusting it**

This is the claim most likely to be silently wrong.

```bash
xcrun simctl openurl <simulator-udid> "marrow:///card/cs-0001"
xcrun simctl io <simulator-udid> screenshot --type=jpeg /tmp/deeplink.jpg
```

Expected: the card detail screen for that card, not the feed and not a blank screen. If it lands on the feed, try `marrow://card/cs-0001` and, if that is the working form, change the URL in `targets/widget/MarrowWidget.swift` and note the correction in the design doc.

- [ ] **Step 4: Add the widget and check all three sizes**

Long press the home screen, add the Marrow widget in small, medium and large. Screenshot each with `xcrun simctl io <udid> screenshot`.

Check, and report with the screenshots:
- the kicker reads like `CS · UNDERGRAD`
- the small size shows a title that is not truncated with an ellipsis
- the medium size ends on a complete sentence
- the large size shows the whole body with no clipping
- the background is the app's near black, in both light and dark home screens

- [ ] **Step 5: Verify the filter crosses and reloads**

In the app, open Settings and select only "High school". Return to the home screen.

Expected: the widget's card changes, and its kicker reads `HIGH SCHOOL`. This exercises the whole chain in one action: the settings write, `syncWidgetPreferences`, `ExtensionStorage`, the App Group, `Preferences.load`, and `reloadWidget`.

If the card does not change, the App Group is the first thing to check: confirm `ios/marrow/marrow.entitlements` and `ios/.targets/MarrowWidget/generated.entitlements` both carry `group.com.pratyushs123.marrow`.

- [ ] **Step 6: Verify the tap**

Tap the widget. Expected: Marrow opens on the card detail screen for the card that was showing.

- [ ] **Step 7: Report**

Post the screenshots and a pass or fail line per check. If everything passed, commit nothing and move on. If anything failed, fix it in the real project directory, and add a regression note to the design doc's known gaps if the fix changed a design decision.

---

### Task 7: Documentation and version

**Files:**
- Modify: `CLAUDE.md`
- Modify: `app.json`

- [ ] **Step 1: Document the widget in `CLAUDE.md`**

Add a section after "Rules for any change". A future card author needs to know that the corpus now has a second consumer with a regeneration step.

```markdown
## The home screen widget

`targets/widget/` is a WidgetKit extension, injected into the Xcode project on every
prebuild by `@bacons/apple-targets`. `/ios` stays gitignored: never hand edit the Xcode
project, because the next prebuild discards it.

The widget ships its own trimmed copy of the corpus at
`targets/widget/assets/cards.json`. **After changing any card, run
`npm run build-widget-cards`.** `npm test` fails if you forget, which is the point.

Only the reader's level and subject filters cross the App Group boundary, written by
`src/widget/preferences.ts`. Progress never crosses it: not `card_state`, not
`review_log`, not `bookmarks`. The widget picks its own card and does not need the app to
have run.

Design: `docs/superpowers/specs/2026-08-17-home-screen-widget-design.md`.
```

- [ ] **Step 2: Note the widget in the "Adding cards" checklist**

`CLAUDE.md`'s "Adding cards" section lists four steps. Add a fifth before the verification block:

```markdown
5. Run `npm run build-widget-cards` so the widget's copy of the corpus keeps up.
```

- [ ] **Step 3: Bump the version**

In `app.json`, set `expo.version` to `"1.3.0"`. Leave `ios.buildNumber` alone: `eas.json` sets `autoIncrement` on the production profile.

- [ ] **Step 4: Run the gates and commit**

```bash
npm run validate-corpus && npm run corpus-style && npm test && npm run check-links
```

```bash
git add CLAUDE.md app.json
git commit -m "docs: record the widget's corpus copy and its regeneration step

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Notes for the executor

- **The App Group is a credentials change to a shipping app.** The first EAS build after this branch will need new provisioning profiles for both targets. That is expected, happens outside this plan, and is the likeliest thing to fail for reasons unrelated to the code.
- **Do not add a network call.** Not in Swift either. If a task seems to need one, the task is wrong.
- **Do not hand edit anything under `/ios`.** It is regenerated.
- **If `@bacons/apple-targets` behaves differently from what Task 1 expects**, stop and report rather than working around it. The plugin's behavior was read from its source and README at version 5.0.0 exactly, and a mismatch means the pin moved or the reading was wrong.
