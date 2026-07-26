import React from "react";
import { View, Text, Pressable } from "react-native";

// The feed screen subtracts this from the available height so paging still snaps
// to full cards. The bar's own View is rendered at exactly this height.
export const TOP_BAR_HEIGHT = 44;

/** Feed chrome: the subject filter on the left, and a count of cards ready for review
 *  on the right. The count makes the scheduler visible from the first screen rather
 *  than only inside Progress. It is hidden at zero, since "0 due" is noise. */
export function TopBar(
  { domainLabel, dueCount, onPressDomains }:
  { domainLabel: string; dueCount: number; onPressDomains: () => void },
) {
  return (
    <View
      style={{ height: TOP_BAR_HEIGHT }}
      className="flex-row items-center justify-between px-4 bg-neutral-950 border-b border-neutral-800"
    >
      <Pressable
        onPress={onPressDomains}
        hitSlop={8}
        accessibilityRole="button"
        className="flex-row items-center gap-1.5 py-1 pr-3 flex-1"
      >
        <Text className="text-neutral-500 text-xs">{"▼"}</Text>
        <Text className="text-neutral-100 text-base font-medium" numberOfLines={1}>
          {domainLabel}
        </Text>
      </Pressable>
      {dueCount > 0 ? (
        <View className="px-2.5 py-1 rounded-full bg-sky-500/15">
          <Text className="text-sky-400 text-xs font-medium">{`${dueCount} due`}</Text>
        </View>
      ) : null}
    </View>
  );
}
