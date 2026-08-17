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
