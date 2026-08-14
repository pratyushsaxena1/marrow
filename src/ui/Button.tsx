import React, { useRef } from "react";
import { Animated, Pressable, Text, View, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./Icon";
import { COLORS, DURATION } from "./theme";
import { knock, tick } from "./haptics";
import { useReduceMotion } from "./useReduceMotion";

type Variant = "primary" | "secondary" | "danger";

const BOX: Record<Variant, string> = {
  primary: "bg-neutral-100",
  secondary: "border border-neutral-700",
  danger: "border border-red-400/40",
};

const LABEL: Record<Variant, string> = {
  primary: "text-neutral-900",
  secondary: "text-neutral-200",
  danger: "text-red-400",
};

/** The app's one button. Every call site used to repeat `rounded-2xl py-4 items-center`
 *  with its own colors, which is how the padding and the corner radius drifted apart
 *  between screens; there is a single definition now.
 *
 *  Pressing dips the button slightly rather than flipping its opacity. The movement is
 *  small and quick on purpose: enough to read as a physical response to the finger,
 *  short enough that it never delays what the tap actually does. */
export function Button(
  { label, onPress, variant = "primary", disabled = false, haptic = "knock", style }:
  {
    label: string;
    onPress: () => void;
    variant?: Variant;
    disabled?: boolean;
    /** "knock" commits to something, "tick" merely selects, "none" stays silent. */
    haptic?: "knock" | "tick" | "none";
    style?: ViewStyle;
  },
) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  const press = (to: number) =>
    Animated.timing(scale, {
      // Reduce Motion keeps the press feedback, as opacity rather than travel: the
      // button still has to acknowledge the finger.
      toValue: reduceMotion ? 1 : to,
      duration: DURATION.fast,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (haptic === "knock") knock();
        else if (haptic === "tick") tick();
        onPress();
      }}
      onPressIn={() => !disabled && press(0.97)}
      onPressOut={() => press(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={style}
    >
      <Animated.View
        style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}
        className={`rounded-2xl py-4 items-center justify-center ${
          reduceMotion ? "active:opacity-70 " : ""
        }${BOX[variant]}`}
      >
        <Text className={`text-base font-medium ${LABEL[variant]}`}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** A bare icon target: back, close, share, save. Keeps the 44pt tap area that a glyph
 *  this small cannot provide on its own, and dims on press like the buttons do. */
export function IconButton(
  { name, onPress, label, color = COLORS.textMuted, size = 20, background, selected }:
  {
    name: IconName;
    onPress: () => void;
    /** Spoken by VoiceOver, since an icon has no text to read. */
    label: string;
    color?: string;
    size?: number;
    background?: string;
    selected?: boolean;
  },
) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      className="px-2 py-2 active:opacity-50"
    >
      <View className="items-center justify-center">
        <Icon name={name} size={size} color={color} background={background} />
      </View>
    </Pressable>
  );
}
