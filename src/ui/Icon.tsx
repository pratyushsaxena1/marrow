import React from "react";
import { View } from "react-native";
import { COLORS } from "./theme";

/** The app's icons, drawn from plain Views the way the tab bar's are.
 *
 *  Typographic stand-ins (a "‹" for back, a "✕" for close, a "★" for saved) inherit
 *  whatever the system font decides, which is why they never quite line up with the
 *  text beside them and why their weight drifts from screen to screen. These are
 *  geometry instead: they scale exactly, take their color from a prop, and add no font
 *  or SVG dependency to the bundle.
 *
 *  `size` is the box the glyph is drawn in, in points, so an icon sits on a text line
 *  the same way a character of that size would. */
export type IconName =
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "close"
  | "share"
  | "bookmark"
  | "check"
  | "search";

export function Icon(
  { name, size = 16, color = COLORS.textMuted, background = COLORS.bg }:
  {
    name: IconName;
    size?: number;
    color?: string;
    /** Only used by `bookmark`, whose notch is cut by painting over it. Pass the color
     *  the icon actually sits on when that is not the page background. */
    background?: string;
  },
) {
  const stroke = Math.max(1.5, Math.round(size / 9));

  if (name === "chevron-left" || name === "chevron-right" || name === "chevron-down") {
    // A square with two adjacent edges, turned 45 degrees. The box is inset so the
    // rotated diagonal still lands inside `size`.
    const arm = size * 0.42;
    const rotation =
      name === "chevron-right" ? "45deg" : name === "chevron-left" ? "225deg" : "135deg";
    return (
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <View
          style={{
            width: arm,
            height: arm,
            borderTopWidth: stroke,
            borderRightWidth: stroke,
            borderColor: color,
            transform: [{ rotate: rotation }],
          }}
        />
      </View>
    );
  }

  if (name === "close") {
    return (
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Bar size={size * 0.82} stroke={stroke} color={color} rotate="45deg" />
        <Bar size={size * 0.82} stroke={stroke} color={color} rotate="-45deg" />
      </View>
    );
  }

  if (name === "check") {
    // Two bars meeting at a right angle, tilted: the short one is the tick's foot.
    return (
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <View
          style={{
            width: size * 0.62,
            height: size * 0.3,
            borderLeftWidth: stroke,
            borderBottomWidth: stroke,
            borderColor: color,
            transform: [{ rotate: "-45deg" }, { translateY: -size * 0.06 }],
          }}
        />
      </View>
    );
  }

  if (name === "share") {
    // The iOS share glyph: an arrow rising out of an open tray.
    const trayWidth = size * 0.72;
    const trayHeight = size * 0.44;
    return (
      <View style={{ width: size, height: size }} className="items-center justify-end">
        <View
          style={{
            position: "absolute",
            bottom: 0,
            width: trayWidth,
            height: trayHeight,
            borderLeftWidth: stroke,
            borderRightWidth: stroke,
            borderBottomWidth: stroke,
            borderColor: color,
            borderBottomLeftRadius: stroke,
            borderBottomRightRadius: stroke,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: size * 0.06,
            width: stroke,
            height: size * 0.62,
            backgroundColor: color,
            borderRadius: stroke,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: size * 0.12,
            width: size * 0.3,
            height: size * 0.3,
            borderTopWidth: stroke,
            borderLeftWidth: stroke,
            borderColor: color,
            transform: [{ rotate: "45deg" }],
          }}
        />
      </View>
    );
  }

  if (name === "search") {
    const ring = size * 0.62;
    return (
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <View
          style={{
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: stroke,
            borderColor: color,
            transform: [{ translateX: -size * 0.08 }, { translateY: -size * 0.08 }],
          }}
        />
        <View
          style={{
            position: "absolute",
            right: size * 0.1,
            bottom: size * 0.12,
            width: stroke,
            height: size * 0.3,
            backgroundColor: color,
            borderRadius: stroke,
            transform: [{ rotate: "-45deg" }],
          }}
        />
      </View>
    );
  }

  // bookmark: a tab of color with a notch taken out of its foot. The notch is a
  // triangle painted in the surrounding color, which is why `background` matters here.
  const width = size * 0.7;
  const notch = size * 0.26;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <View
        style={{
          width,
          height: size * 0.88,
          backgroundColor: color,
          borderTopLeftRadius: stroke,
          borderTopRightRadius: stroke,
          overflow: "hidden",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 0,
            height: 0,
            borderLeftWidth: width / 2,
            borderRightWidth: width / 2,
            borderBottomWidth: notch,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: background,
          }}
        />
      </View>
    </View>
  );
}

function Bar(
  { size, stroke, color, rotate }: { size: number; stroke: number; color: string; rotate: string },
) {
  return (
    <View
      style={{
        position: "absolute",
        width: size,
        height: stroke,
        borderRadius: stroke,
        backgroundColor: color,
        transform: [{ rotate }],
      }}
    />
  );
}
