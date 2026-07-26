import React from "react";
import { Pressable, Text } from "react-native";

/** Bookmark toggle. Filled star means saved; the outline means not yet. */
export function SaveButton(
  { saved, onPress, size = "base" }: { saved: boolean; onPress: () => void; size?: "base" | "lg" },
) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? "Remove from saved" : "Save this card"}
      className="px-1 py-1"
    >
      <Text
        className={
          (saved ? "text-amber-400 " : "text-neutral-500 ") +
          (size === "lg" ? "text-2xl" : "text-lg")
        }
      >
        {saved ? "★" : "☆"}
      </Text>
    </Pressable>
  );
}
