import React from "react";
import { IconButton } from "./Button";
import { COLORS } from "./theme";

/** Save toggle. A filled bookmark means saved, a dim one means not; the shape stays
 *  put either way, so the row never reflows as it is tapped. Bookmark rather than star
 *  because that is what the store has always called these. */
export function SaveButton(
  { saved, onPress, size = "base", background }:
  { saved: boolean; onPress: () => void; size?: "base" | "lg"; background?: string },
) {
  return (
    <IconButton
      name="bookmark"
      onPress={onPress}
      label={saved ? "Remove from saved" : "Save this card"}
      selected={saved}
      size={size === "lg" ? 20 : 18}
      color={saved ? COLORS.text : COLORS.iconGhost}
      background={background}
    />
  );
}
