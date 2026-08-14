import React, { useEffect, useRef } from "react";
import { Animated, type ViewStyle } from "react-native";
import { DURATION } from "./theme";
import { useReduceMotion } from "./useReduceMotion";

/** Fades and lifts its children in on mount.
 *
 *  Used where content appears in response to a tap: a revealed answer, the confirmation
 *  that replaces the grade buttons. Content that simply materialises reads as a glitch,
 *  while a short rise reads as a consequence of the tap. The travel is deliberately
 *  small, since the eye is already at the tap and does not need leading anywhere. */
export function FadeIn(
  { children, style, delay = 0 }:
  { children: React.ReactNode; style?: ViewStyle; delay?: number },
) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : DURATION.base,
      delay: reduceMotion ? 0 : delay,
      useNativeDriver: true,
    }).start();
  }, [progress, delay, reduceMotion]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [reduceMotion ? 0 : 8, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
