import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { createSession, nextChunk, type FeedDeps } from "../src/feed";
import { openStore } from "../src/store";
import { getCard, getUnseen } from "../src/corpus";
import { initialState, review } from "../src/scheduler";
import { ConceptCard } from "../src/ui/ConceptCard";
import { RevealCard } from "../src/ui/RevealCard";
import { CaughtUpCard } from "../src/ui/CaughtUpCard";
import { TopBar, TOP_BAR_HEIGHT } from "../src/ui/TopBar";
import { DomainSheet } from "../src/ui/DomainSheet";
import { CHUNK_SIZE, DOMAINS, DOMAIN_LABELS_SHORT, SESSION_IDLE_MS } from "../src/constants";
import type { Domain, FeedItem, Grade, Session } from "../src/types";

const rng = () => Math.random();

// Reads the persisted domain filter. A missing or malformed value means "all domains"
// (the empty array), so a corrupt setting degrades to the default rather than crashing.
function loadSelectedDomains(raw: string | null): Domain[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is Domain => DOMAINS.includes(d as Domain));
  } catch {
    return [];
  }
}

const labelForDomains = (domains: Domain[]): string =>
  domains.length === 0 ? "All domains" : domains.map((d) => DOMAIN_LABELS_SHORT[d]).join(" + ");

export default function FeedScreen() {
  const { height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The top bar sits between the safe-area padding and the feed, so a full card is the
  // window minus both insets and the bar. Paging snaps to this height.
  const height = winHeight - insets.top - insets.bottom - TOP_BAR_HEIGHT;

  const router = useRouter();
  const store = useMemo(() => openStore(), []);
  const corpus = useMemo(() => ({ getUnseen, getCard }), []);

  // First-run gate. Read once so the decision is stable for this mount: a fresh mount
  // after onboarding completes re-reads the (now set) flag and renders the feed.
  const [needsOnboarding] = useState(() => store.getSetting("onboardingDone") !== "1");

  const [selectedDomains, setSelectedDomains] = useState<Domain[]>(() =>
    loadSelectedDomains(store.getSetting("selectedDomains")),
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const session = useRef<Session>(createSession(rng));
  const seeded = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<FeedItem[]>([]);
  const [done, setDone] = useState(false);
  const listRef = useRef<FlatList<FeedItem>>(null);
  const pendingScrollReset = useRef(false);

  const deps = useCallback(
    (): FeedDeps => ({ corpus, store, now: Date.now(), rng, domains: selectedDomains }),
    [corpus, store, selectedDomains],
  );

  const loadMore = useCallback(() => {
    if (done) return;
    const chunk = nextChunk(deps(), session.current, CHUNK_SIZE);
    if (chunk.some((i) => i.kind === "caught-up")) setDone(true);
    setItems((prev) => [...prev, ...chunk]);
  }, [deps, done]);

  // Starts a brand-new session from the given deps and snaps the scroll back to the top.
  // Used by the idle reset and by applying a new domain filter. Takes deps explicitly so
  // a caller can pass freshly-chosen domains without waiting for state to settle.
  const restartSession = useCallback((d: FeedDeps) => {
    session.current = createSession(rng);
    seeded.current = new Set();
    setDone(false);
    pendingScrollReset.current = true;
    setItems(nextChunk(d, session.current, CHUNK_SIZE));
  }, []);

  // Reset the session on cold start, or on foreground after >= 30 min in background.
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt.current = Date.now();
      } else if (next === "active" && backgroundedAt.current !== null) {
        if (Date.now() - backgroundedAt.current >= SESSION_IDLE_MS) {
          restartSession(deps());
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [deps, restartSession]);

  // Skip the first fetch for a first-run user: they are about to be redirected to
  // onboarding, so loading a feed chunk here would be wasted work.
  useEffect(() => {
    if (!needsOnboarding) loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Persist the chosen subjects and immediately rebuild the feed from them. The new
  // domains are threaded straight into deps so the restart does not race the state update.
  const applyDomains = useCallback(
    (domains: Domain[]) => {
      store.putSetting("selectedDomains", JSON.stringify(domains));
      setSelectedDomains(domains);
      setSheetOpen(false);
      restartSession({ corpus, store, now: Date.now(), rng, domains });
    },
    [corpus, store, restartSession],
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

  if (needsOnboarding) return <Redirect href="/onboarding" />;

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <TopBar
        domainLabel={labelForDomains(selectedDomains)}
        onPressDomains={() => setSheetOpen(true)}
        onPressStats={() => router.push("/stats")}
      />
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
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
      <DomainSheet
        visible={sheetOpen}
        selected={selectedDomains}
        onApply={applyDomains}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
