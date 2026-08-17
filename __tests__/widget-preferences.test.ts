// A stand-in for ExtensionStorage. Tracks constructor and instance-method calls so the
// tests can assert on them without pulling in the native module.
const mockStorage = {
  appGroups: [] as string[],
  sets: [] as Array<{ key: string; value: unknown }>,
  reloadWidget: jest.fn(),
};

jest.mock("@bacons/apple-targets", () => ({
  ExtensionStorage: class {
    constructor(appGroup: string) {
      mockStorage.appGroups.push(appGroup);
    }
    set(key: string, value: unknown) {
      mockStorage.sets.push({ key, value });
    }
    static reloadWidget(): void {
      mockStorage.reloadWidget();
    }
  },
}));

import {
  APP_GROUP,
  PREFERENCES_KEY,
  readWidgetPreferences,
  syncWidgetPreferences,
} from "../src/widget/preferences";

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

describe("syncWidgetPreferences", () => {
  beforeEach(() => {
    mockStorage.appGroups = [];
    mockStorage.sets = [];
    mockStorage.reloadWidget.mockClear();
  });

  it("writes a single string entry keyed by PREFERENCES_KEY to a storage built on APP_GROUP", () => {
    const store = source({
      selectedLevels: JSON.stringify([1, 3]),
      selectedDomains: JSON.stringify(["cs", "math"]),
    });
    syncWidgetPreferences(store);

    expect(mockStorage.appGroups).toEqual([APP_GROUP]);
    expect(mockStorage.sets).toHaveLength(1);
    const [{ key, value }] = mockStorage.sets;
    expect(key).toBe(PREFERENCES_KEY);
    // A string routes ExtensionStorage.set to setString. An object would route to
    // setObject, which stores Data instead, and the Swift side reads .string(forKey:).
    expect(typeof value).toBe("string");
    expect(JSON.parse(value as string)).toEqual(readWidgetPreferences(store));
  });

  it("reloads the widget so the home screen updates immediately", () => {
    syncWidgetPreferences(source({}));
    expect(mockStorage.reloadWidget).toHaveBeenCalledTimes(1);
  });
});
