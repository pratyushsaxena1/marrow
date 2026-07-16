import React from "react";
import { Text } from "react-native";
import { CardShell } from "./CardShell";

export function CaughtUpCard({ height }: { height: number }) {
  return (
    <CardShell height={height}>
      <Text className="text-neutral-100 text-3xl font-semibold mb-4">You're caught up</Text>
      <Text className="text-neutral-400 text-lg leading-relaxed">
        Nothing is due right now. Come back tomorrow and the cards you've read will be waiting
        to be tested.
      </Text>
    </CardShell>
  );
}
