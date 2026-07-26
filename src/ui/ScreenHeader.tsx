import React from "react";
import { Pressable, Text, View } from "react-native";

/** Title row shared by the pushed screens. `onBack` renders a leading chevron; `right`
 *  takes any trailing control so each screen keeps its own action without a new prop. */
export function ScreenHeader(
  { title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode },
) {
  return (
    <View className="flex-row items-center justify-between mb-6">
      <View className="flex-row items-center flex-1 gap-2">
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="pr-1"
          >
            <Text className="text-neutral-400 text-2xl">{"‹"}</Text>
          </Pressable>
        ) : null}
        <Text className="text-neutral-100 text-3xl font-semibold flex-1" numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}
