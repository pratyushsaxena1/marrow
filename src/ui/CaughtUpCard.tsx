import React from "react";
import { Text, View } from "react-native";
import { CardShell } from "./CardShell";
import { Icon } from "./Icon";
import { COLORS } from "./theme";

/** The end of the feed. It is the one screen in the app that means "you are finished",
 *  so it gets the accent mark rather than more prose. */
export function CaughtUpCard({ height }: { height: number }) {
  return (
    <CardShell height={height}>
      <View className="w-11 h-11 rounded-full items-center justify-center bg-emerald-400/10 mb-6">
        <Icon name="check" size={20} color={COLORS.accent} />
      </View>
      <Text className="text-neutral-100 text-3xl font-semibold mb-4">You're caught up</Text>
      <Text className="text-neutral-400 text-lg leading-relaxed">
        Nothing is due right now. Come back tomorrow and the cards you've read will be waiting
        to be tested.
      </Text>
    </CardShell>
  );
}
