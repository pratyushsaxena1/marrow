import React from "react";
import { View, Text } from "react-native";
import { CONTENT_MAX_WIDTH } from "../constants";
import type { Domain } from "../types";

const LABEL: Record<Domain, string> = {
  cs: "Computer Science", finance: "Finance & Economics", math: "Mathematics", science: "Science",
};

/** One full-height feed page. `actions` is an optional trailing row (save, open) that
 *  sits under the card's content. The inner column is width-capped so a card reads at a
 *  comfortable measure on an iPad instead of stretching across the display. */
export function CardShell(
  { height, domain, actions, children }:
  { height: number; domain?: Domain; actions?: React.ReactNode; children: React.ReactNode },
) {
  return (
    <View style={{ height }} className="bg-neutral-950 px-6 justify-center">
      <View style={{ width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" }}>
        {domain ? (
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
            {LABEL[domain]}
          </Text>
        ) : null}
        {children}
        {actions}
      </View>
    </View>
  );
}
