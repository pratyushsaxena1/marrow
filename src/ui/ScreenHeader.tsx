import React from "react";
import { Text, View } from "react-native";
import { IconButton } from "./Button";

/** Title row shared by the pushed screens. `onBack` renders a leading chevron; `right`
 *  takes any trailing control so each screen keeps its own action without a new prop. */
export function ScreenHeader(
  { title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode },
) {
  return (
    <View className="flex-row items-center justify-between mb-6 min-h-[44px]">
      <View className="flex-row items-center flex-1 gap-1">
        {onBack ? (
          <View className="-ml-2">
            <IconButton name="chevron-left" size={18} onPress={onBack} label="Back" />
          </View>
        ) : null}
        <Text className="text-neutral-100 text-2xl font-semibold flex-1" numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}
