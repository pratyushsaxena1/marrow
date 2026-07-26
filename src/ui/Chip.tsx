import React from "react";
import { Pressable, Text } from "react-native";

/** A filter pill. Selection is carried by fill rather than by a checkmark so a row of
 *  chips reads at a glance without adding width. */
export function Chip(
  { label, selected, onPress }: { label: string; selected: boolean; onPress: () => void },
) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? "px-3 py-1.5 rounded-full bg-neutral-100"
          : "px-3 py-1.5 rounded-full border border-neutral-700"
      }
    >
      <Text
        className={
          selected
            ? "text-neutral-900 text-sm font-medium"
            : "text-neutral-300 text-sm font-medium"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
