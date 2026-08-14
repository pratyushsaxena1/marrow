import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { CONTENT_MAX_WIDTH, DOMAIN_LABELS_LONG } from "../constants";
import type { Domain } from "../types";

/** Breathing room above and below the text on a page that is full to the edges. It
 *  doubles as the slack in the overflow test below. */
const PAGE_PADDING_V = 20;

/** One full-height feed page. `actions` is an optional trailing row (save, open) that
 *  sits under the card's content. The inner column is width-capped so a card reads at a
 *  comfortable measure on an iPad instead of stretching across the display.
 *
 *  The page scrolls internally rather than clipping: a long card, or a short one whose
 *  answer has just been revealed, can exceed the page height, and a centred fixed-height
 *  box would cut it off at both ends. Scrolling is enabled only while the content
 *  actually overflows, so on an ordinary card the swipe still belongs to the feed's
 *  paging gesture. Content shorter than the page stays vertically centred.
 *
 *  `scrollSignal` is a counter a card bumps when it adds content the reader needs to
 *  see (revealing an answer). When that new content lands below the fold, the page
 *  scrolls down to it instead of leaving the tap looking like it did nothing. */
export function CardShell(
  { height, domain, actions, scrollSignal, children }:
  {
    height: number;
    domain?: Domain;
    actions?: React.ReactNode;
    scrollSignal?: number;
    children: React.ReactNode;
  },
) {
  const scroller = useRef<ScrollView>(null);
  const viewportHeight = useRef(0);
  const pendingScroll = useRef(false);
  const [overflows, setOverflows] = useState(false);

  // Set by the signal, consumed by the layout pass that follows it: the new content has
  // no measured height until then, so the scroll has to wait for the size to change.
  useEffect(() => {
    if (scrollSignal) pendingScroll.current = true;
  }, [scrollSignal]);

  const onContentSizeChange = useCallback((_w: number, contentHeight: number) => {
    // Overflow past the page is clipped off the bottom, and the first thing it eats is
    // the bottom padding. A card that spills by less than that loses only breathing
    // room, so it stays unscrollable and the swipe keeps belonging to the feed's paging
    // rather than being half-consumed by a few points of internal travel.
    const over = contentHeight > viewportHeight.current + PAGE_PADDING_V;
    setOverflows(over);
    if (pendingScroll.current) {
      pendingScroll.current = false;
      if (over) scroller.current?.scrollToEnd({ animated: true });
    }
  }, []);

  return (
    <ScrollView
      ref={scroller}
      style={{ height }}
      className="bg-neutral-950"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: PAGE_PADDING_V,
      }}
      scrollEnabled={overflows}
      showsVerticalScrollIndicator={false}
      onLayout={(e) => {
        viewportHeight.current = e.nativeEvent.layout.height;
      }}
      onContentSizeChange={onContentSizeChange}
    >
      <View style={{ width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" }}>
        {domain ? (
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
            {DOMAIN_LABELS_LONG[domain]}
          </Text>
        ) : null}
        {children}
        {actions}
      </View>
    </ScrollView>
  );
}
