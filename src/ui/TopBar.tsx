import React from "react";
import { View, Text, Pressable } from "react-native";
import { Icon } from "./Icon";
import { COLORS } from "./theme";
import { tick } from "./haptics";

// The feed screen subtracts this from the available height so paging still snaps
// to full cards. The bar's own View is rendered at exactly this height.
export const TOP_BAR_HEIGHT = 44;

/** Feed chrome: the subject filter on the left, and a count of cards ready for review
 *  on the right. The count makes the scheduler visible from the first screen rather
 *  than only inside Progress. It is hidden at zero, since "0 due" is noise.
 *
 *  The count is a solid white pill: in a greyscale interface, filled white is the
 *  strongest emphasis available, and it is spent here because being due is the one
 *  thing on this screen asking to be acted on. */
export function TopBar(
  { domainLabel, dueCount, onPressDomains }:
  { domainLabel: string; dueCount: number; onPressDomains: () => void },
) {
  return (
    <View
      style={{ height: TOP_BAR_HEIGHT }}
      className="flex-row items-center justify-between px-4 bg-neutral-950 border-b border-neutral-900"
    >
      <Pressable
        onPress={() => {
          tick();
          onPressDomains();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Subjects: ${domainLabel}`}
        className="flex-row items-center gap-1.5 py-1 pr-3 flex-1 active:opacity-60"
      >
        <Text className="text-neutral-100 text-base font-medium" numberOfLines={1}>
          {domainLabel}
        </Text>
        <Icon name="chevron-down" size={13} color={COLORS.textFaint} />
      </Pressable>
      {dueCount > 0 ? (
        <View className="px-2.5 py-1 rounded-full bg-neutral-100">
          <Text className="text-neutral-900 text-xs font-semibold">{`${dueCount} due`}</Text>
        </View>
      ) : null}
    </View>
  );
}
