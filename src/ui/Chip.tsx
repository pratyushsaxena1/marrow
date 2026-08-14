import React from "react";
import { Pressable, Text } from "react-native";
import { tick } from "./haptics";

/** A filter pill. Selection is carried by fill rather than by a checkmark so a row of
 *  chips reads at a glance without adding width. */
export function Chip(
  { label, selected, onPress }: { label: string; selected: boolean; onPress: () => void },
) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? "px-3.5 py-2 rounded-full bg-neutral-100 active:opacity-80"
          : "px-3.5 py-2 rounded-full border border-neutral-800 active:opacity-60"
      }
    >
      <Text
        className={
          selected
            ? "text-neutral-900 text-sm font-medium"
            : "text-neutral-400 text-sm font-medium"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
