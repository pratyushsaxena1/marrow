import React from "react";
import { Pressable, Text, View } from "react-native";

// Screens subtract this from the available height so a full-bleed feed card still
// snaps to a whole page above the bar.
export const TAB_BAR_HEIGHT = 58;

export type TabKey = "feed" | "library" | "quiz" | "progress";

export const TAB_ROUTES: Record<TabKey, string> = {
  feed: "/",
  library: "/library",
  quiz: "/quiz",
  progress: "/stats",
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "feed", label: "Feed" },
  { key: "library", label: "Library" },
  { key: "quiz", label: "Quiz" },
  { key: "progress", label: "Progress" },
];

// Icons are drawn from plain Views rather than an icon font: the set is four glyphs,
// and this keeps the app free of a font dependency while staying crisp at any scale
// and inheriting the active/inactive tint directly.
function Icon({ tab, active }: { tab: TabKey; active: boolean }) {
  const tint = active ? "bg-neutral-100" : "bg-neutral-600";
  const border = active ? "border-neutral-100" : "border-neutral-600";

  if (tab === "feed") {
    return (
      <View className="w-5 h-5 items-center justify-center gap-1">
        <View className={`h-1 w-5 rounded-sm ${tint}`} />
        <View className={`h-1 w-5 rounded-sm ${tint}`} />
        <View className={`h-1 w-3 rounded-sm ${tint}`} />
      </View>
    );
  }

  if (tab === "library") {
    return (
      <View className="w-5 h-5 justify-center gap-1">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-row items-center gap-1">
            <View className={`h-1 w-1 rounded-full ${tint}`} />
            <View className={`h-1 flex-1 rounded-sm ${tint}`} />
          </View>
        ))}
      </View>
    );
  }

  if (tab === "quiz") {
    return (
      <View className={`w-5 h-5 rounded-md border-2 items-center justify-center ${border}`}>
        <Text
          className={active ? "text-neutral-100 text-xs font-bold" : "text-neutral-600 text-xs font-bold"}
        >
          ?
        </Text>
      </View>
    );
  }

  return (
    <View className="w-5 h-5 flex-row items-end justify-center gap-1">
      <View className={`w-1 h-2 rounded-sm ${tint}`} />
      <View className={`w-1 h-4 rounded-sm ${tint}`} />
      <View className={`w-1 h-3 rounded-sm ${tint}`} />
    </View>
  );
}

export function TabBar({ active, onSelect }: { active: TabKey; onSelect: (tab: TabKey) => void }) {
  return (
    <View
      style={{ height: TAB_BAR_HEIGHT }}
      className="flex-row border-t border-neutral-800 bg-neutral-950"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            className="flex-1 items-center justify-center gap-1"
          >
            <Icon tab={tab.key} active={isActive} />
            <Text
              className={
                isActive
                  ? "text-neutral-100 text-[11px] font-medium"
                  : "text-neutral-500 text-[11px]"
              }
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
