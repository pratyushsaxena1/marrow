import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Whether the reader has asked the system for less movement.
 *
 *  Motion in this app is decoration on top of a state change that has already happened,
 *  so honouring the setting costs nothing: the answer still appears, the button still
 *  responds, they simply arrive rather than travel. Nothing here is animation-gated. */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {
        // An unavailable accessibility bridge just means the default: motion allowed.
      });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
