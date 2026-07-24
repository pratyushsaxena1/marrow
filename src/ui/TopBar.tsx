import React from "react";
import { View, Text, Pressable } from "react-native";

// The feed screen subtracts this from the available height so paging still snaps
// to full cards. The bar's own View is rendered at exactly this height.
export const TOP_BAR_HEIGHT = 44;

export function TopBar(
  { domainLabel, onPressDomains, onPressStats }:
  { domainLabel: string; onPressDomains: () => void; onPressStats: () => void },
) {
  return (
    <View
      style={{ height: TOP_BAR_HEIGHT }}
      className="flex-row items-center justify-between px-4 bg-neutral-950 border-b border-neutral-800"
    >
      <Pressable
        onPress={onPressDomains}
        hitSlop={8}
        className="flex-row items-center gap-1.5 py-1 pr-3"
      >
        <Text className="text-neutral-500 text-xs">{"▼"}</Text>
        <Text className="text-neutral-100 text-base font-medium" numberOfLines={1}>
          {domainLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={onPressStats}
        hitSlop={8}
        className="flex-row items-center gap-1.5 py-1 pl-3"
      >
        <Text className="text-neutral-300 text-sm">{"📊"}</Text>
        <Text className="text-neutral-100 text-base font-medium">Stats</Text>
      </Pressable>
    </View>
  );
}
