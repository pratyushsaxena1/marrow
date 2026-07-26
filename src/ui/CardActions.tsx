import React from "react";
import { Pressable, Text, View } from "react-native";
import { SaveButton } from "./SaveButton";

/** The trailing row on a feed card: save it, or open its full entry in the Library.
 *  Rendered only when the feed supplies handlers, so the card components stay usable
 *  (and testable) on their own. */
export function CardActions(
  { saved, onToggleSave, onOpen }:
  { saved: boolean; onToggleSave: () => void; onOpen: () => void },
) {
  return (
    <View className="flex-row items-center gap-4 mt-8">
      <SaveButton saved={saved} onPress={onToggleSave} />
      <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="button">
        <Text className="text-neutral-500 text-sm font-medium">Open concept ›</Text>
      </Pressable>
    </View>
  );
}
