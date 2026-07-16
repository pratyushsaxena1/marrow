import React, { useState } from "react";
import { Text, Pressable, View } from "react-native";
import { CardShell } from "./CardShell";
import { GradeButtons } from "./GradeButtons";
import type { Card, Grade } from "../types";

export function RevealCard(
  { card, height, showBody, onGrade }:
  { card: Card; height: number; showBody: boolean; onGrade: (g: Grade) => void },
) {
  const [revealed, setRevealed] = useState(false);

  return (
    <CardShell height={height} domain={card.domain}>
      {showBody ? (
        <>
          <Text className="text-neutral-100 text-2xl font-semibold leading-tight mb-4">
            {card.title}
          </Text>
          <Text className="text-neutral-300 text-lg leading-relaxed mb-6">{card.body}</Text>
        </>
      ) : null}

      <Text className="text-neutral-100 text-2xl font-medium leading-snug">{card.prompt}</Text>

      {revealed ? (
        <View>
          <Text className="text-neutral-400 text-lg leading-relaxed mt-6">{card.answer}</Text>
          <GradeButtons onGrade={onGrade} />
        </View>
      ) : (
        <Pressable
          onPress={() => setRevealed(true)}
          className="border border-neutral-700 rounded-2xl py-4 items-center mt-8"
        >
          <Text className="text-neutral-300 text-base font-medium">Reveal</Text>
        </Pressable>
      )}
    </CardShell>
  );
}
