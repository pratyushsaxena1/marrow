import React from "react";
import { Pressable, Text, View } from "react-native";
import { SaveButton } from "./SaveButton";
import { Icon } from "./Icon";
import { COLORS } from "./theme";
import { tick } from "./haptics";

/** The trailing row on a feed card: save it, or open its full entry in the Library.
 *  Rendered only when the feed supplies handlers, so the card components stay usable
 *  (and testable) on their own. */
export function CardActions(
  { saved, onToggleSave, onOpen }:
  { saved: boolean; onToggleSave: () => void; onOpen: () => void },
) {
  return (
    <View className="flex-row items-center gap-3 mt-8 -ml-2">
      <SaveButton saved={saved} onPress={onToggleSave} />
      <Pressable
        onPress={() => {
          tick();
          onOpen();
        }}
        hitSlop={8}
        accessibilityRole="button"
        className="flex-row items-center gap-1 py-2 active:opacity-60"
      >
        <Text className="text-neutral-500 text-sm font-medium">Open concept</Text>
        <Icon name="chevron-right" size={12} color={COLORS.textFaint} />
      </Pressable>
    </View>
  );
}
