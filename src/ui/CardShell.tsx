import React from "react";
import { View, Text } from "react-native";
import type { Domain } from "../types";

const LABEL: Record<Domain, string> = {
  cs: "Computer Science", finance: "Finance & Economics", math: "Mathematics", science: "Science",
};

export function CardShell(
  { height, domain, children }:
  { height: number; domain?: Domain; children: React.ReactNode },
) {
  return (
    <View style={{ height }} className="bg-neutral-950 px-6 justify-center">
      {domain ? (
        <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
          {LABEL[domain]}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
