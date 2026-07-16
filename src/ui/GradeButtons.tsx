import React from "react";
import { View, Text, Pressable } from "react-native";
import type { Grade } from "../types";

export function GradeButtons({ onGrade }: { onGrade: (g: Grade) => void }) {
  return (
    <View className="flex-row gap-3 mt-8">
      <Pressable
        onPress={() => onGrade("missed")}
        className="flex-1 border border-neutral-700 rounded-2xl py-4 items-center"
      >
        <Text className="text-neutral-300 text-base font-medium">Missed it</Text>
      </Pressable>
      <Pressable
        onPress={() => onGrade("got")}
        className="flex-1 bg-neutral-100 rounded-2xl py-4 items-center"
      >
        <Text className="text-neutral-900 text-base font-medium">Got it</Text>
      </Pressable>
    </View>
  );
}
