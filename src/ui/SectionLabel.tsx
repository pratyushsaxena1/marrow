import React from "react";
import { Text } from "react-native";

/** The small capitalised label that introduces a group: "Subjects", "Your schedule",
 *  "Last 28 days". Fourteen call sites used to spell the same four utilities out by
 *  hand, and had already drifted apart on their bottom margin. */
export function SectionLabel(
  { children, className = "mb-3" }: { children: React.ReactNode; className?: string },
) {
  return (
    <Text className={`text-neutral-500 text-xs uppercase tracking-widest ${className}`}>
      {children}
    </Text>
  );
}
