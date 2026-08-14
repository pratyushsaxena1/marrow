import React from "react";
import { View, Text } from "react-native";
import { Button } from "./Button";
import { FadeIn } from "./FadeIn";
import type { Grade } from "../types";

/** The two-way judgement under a revealed answer, and the confirmation that replaces
 *  it. The confirmation keeps the pair's footprint so the page does not jump as it
 *  swaps, and states the choice made rather than going blank. */
export function GradeButtons(
  { onGrade, graded }: { onGrade: (g: Grade) => void; graded?: Grade | null },
) {
  if (graded) {
    return (
      <FadeIn style={{ marginTop: 32 }}>
        <View className="rounded-2xl py-4 items-center border border-neutral-800">
          <Text className="text-neutral-400 text-base font-medium">
            {graded === "got" ? "Got it" : "Missed it"}
          </Text>
        </View>
      </FadeIn>
    );
  }

  return (
    <View className="flex-row gap-3 mt-8">
      <Button
        label="Missed it"
        variant="secondary"
        onPress={() => onGrade("missed")}
        style={{ flex: 1 }}
      />
      <Button label="Got it" onPress={() => onGrade("got")} style={{ flex: 1 }} />
    </View>
  );
}
