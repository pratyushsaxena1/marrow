import { useWindowDimensions } from "react-native";
import { CONTENT_MAX_WIDTH, WIDE_MIN_WIDTH } from "../constants";

export type Layout = {
  width: number;
  height: number;
  /** True on iPad and on a rotated phone: enough room for wider gutters and two-up grids. */
  isWide: boolean;
  /** Style for a centred reading column. Keeps line length sane on a large display. */
  column: { width: "100%"; maxWidth: number; alignSelf: "center" };
  /** Horizontal padding, in points, matched to the display size. */
  gutter: number;
};

/** Single source of truth for size-class decisions, so every screen reacts to rotation
 *  and to iPad's larger canvas the same way. Reads live dimensions, so a rotation
 *  re-renders callers rather than stranding them in the launch orientation. */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const isWide = width >= WIDE_MIN_WIDTH;
  return {
    width,
    height,
    isWide,
    column: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
    gutter: isWide ? 32 : 24,
  };
}
