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
