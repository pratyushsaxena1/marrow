import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSession, nextChunk, type FeedDeps } from "../src/feed";
import { openStore } from "../src/store";
import { getCard, getUnseen } from "../src/corpus";
import { initialState, review } from "../src/scheduler";
import { ConceptCard } from "../src/ui/ConceptCard";
import { RevealCard } from "../src/ui/RevealCard";
import { CaughtUpCard } from "../src/ui/CaughtUpCard";
import { CHUNK_SIZE, SESSION_IDLE_MS } from "../src/constants";
import type { FeedItem, Grade, Session } from "../src/types";

const rng = () => Math.random();

export default function FeedScreen() {
  const { height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const height = winHeight - insets.top - insets.bottom;

  const store = useMemo(() => openStore(), []);
  const corpus = useMemo(() => ({ getUnseen, getCard }), []);
  const session = useRef<Session>(createSession(rng));
  const seeded = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<FeedItem[]>([]);
  const [done, setDone] = useState(false);
  const listRef = useRef<FlatList<FeedItem>>(null);
  const pendingScrollReset = useRef(false);

  const deps = useCallback(
    (): FeedDeps => ({ corpus, store, now: Date.now(), rng }),
    [corpus, store],
  );

  const loadMore = useCallback(() => {
    if (done) return;
    const chunk = nextChunk(deps(), session.current, CHUNK_SIZE);
    if (chunk.some((i) => i.kind === "caught-up")) setDone(true);
    setItems((prev) => [...prev, ...chunk]);
  }, [deps, done]);

  // Reset the session on cold start, or on foreground after >= 30 min in background.
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt.current = Date.now();
      } else if (next === "active" && backgroundedAt.current !== null) {
        if (Date.now() - backgroundedAt.current >= SESSION_IDLE_MS) {
          session.current = createSession(rng);
          seeded.current = new Set();
          setDone(false);
          pendingScrollReset.current = true;
          setItems(nextChunk(deps(), session.current, CHUNK_SIZE));
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [deps]);

  useEffect(() => { loadMore(); /* first chunk */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After a session reset replaces the item list, snap the scroll position
  // back to the first card so the user isn't stranded mid-list.
  useEffect(() => {
    if (pendingScrollReset.current) {
      pendingScrollReset.current = false;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [items]);

  // A concept card is a passive read: seeing it is what schedules its first review.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: FeedItem }> }) => {
      for (const v of viewableItems) {
        const it = v.item;
        if (it.kind !== "new-concept") continue;
        if (seeded.current.has(it.card.id)) continue;
        seeded.current.add(it.card.id);
        store.putState(initialState(it.card.id, Date.now(), rng));
      }
    },
  ).current;

  const grade = useCallback(
    (item: FeedItem, g: Grade) => {
      if (item.kind === "caught-up") return;
      const now = Date.now();
      const prev = store.getState(item.card.id) ?? initialState(item.card.id, now, rng);
      store.putState(review(prev, g, now, rng));
    },
    [store],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === "caught-up") return <CaughtUpCard height={height} />;
      if (item.kind === "new-concept") return <ConceptCard card={item.card} height={height} />;
      return (
        <RevealCard
          card={item.card}
          height={height}
          showBody={item.kind === "new-puzzle"}
          onGrade={(g) => grade(item, g)}
        />
      );
    },
    [height, grade],
  );

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, i) => (item.kind === "caught-up" ? `caught-up-${i}` : item.card.id)}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 400 }}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
      />
    </View>
  );
}
