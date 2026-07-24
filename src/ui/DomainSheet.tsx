import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { DOMAINS, DOMAIN_LABELS } from "../constants";
import type { Domain } from "../types";

// Convention: an empty selection means "All domains". The working copy tracks the
// four individual domains; covering all four (or none) reads as "all". On Apply, a
// selection that covers everything, or an accidentally emptied one, is normalized to
// [] so the caller always receives the canonical "all domains" value.
export function DomainSheet(
  { visible, selected, onApply, onClose }:
  {
    visible: boolean;
    selected: Domain[];
    onApply: (domains: Domain[]) => void;
    onClose: () => void;
  },
) {
  const [working, setWorking] = useState<Domain[]>(selected);

  // Reseed the working copy each time the sheet opens so it reflects the latest
  // applied selection rather than stale local edits from a previous open.
  useEffect(() => {
    if (visible) setWorking(selected);
  }, [visible, selected]);

  const allChecked = working.length === 0 || working.length === DOMAINS.length;

  const toggleAll = () => {
    // If everything is already covered, clear to an empty (still "all") set so the
    // individual rows read as unchecked; otherwise select every domain.
    setWorking(allChecked ? [] : [...DOMAINS]);
  };

  const toggleDomain = (d: Domain) => {
    setWorking((prev) => {
      // An empty "all" state means every row shows checked, so the first tap should
      // remove that one domain from a full set rather than add to nothing.
      const base = prev.length === 0 ? [...DOMAINS] : prev;
      return base.includes(d) ? base.filter((x) => x !== d) : [...base, d];
    });
  };

  const isChecked = (d: Domain) => working.length === 0 || working.includes(d);

  const apply = () => {
    // Covering all four, or unchecking everything, both normalize to "all domains".
    if (working.length === 0 || working.length === DOMAINS.length) {
      onApply([]);
    } else {
      onApply(working);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable
          onPress={() => {}}
          className="bg-neutral-900 rounded-t-3xl px-6 pt-6 pb-10 border-t border-neutral-800"
        >
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-neutral-100 text-xl font-semibold">Subjects</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-neutral-500 text-lg">{"✕"}</Text>
            </Pressable>
          </View>

          <Row label="All domains" checked={allChecked} onPress={toggleAll} />
          {DOMAINS.map((d) => (
            <Row
              key={d}
              label={DOMAIN_LABELS[d]}
              checked={isChecked(d)}
              onPress={() => toggleDomain(d)}
            />
          ))}

          <Pressable
            onPress={apply}
            className="bg-neutral-100 rounded-2xl py-4 items-center mt-6"
          >
            <Text className="text-neutral-900 text-base font-medium">Apply</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row(
  { label, checked, onPress }:
  { label: string; checked: boolean; onPress: () => void },
) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-3">
      <View
        className={
          checked
            ? "w-6 h-6 rounded-md items-center justify-center bg-neutral-100"
            : "w-6 h-6 rounded-md items-center justify-center border border-neutral-600"
        }
      >
        {checked ? <Text className="text-neutral-900 text-sm font-bold">{"✓"}</Text> : null}
      </View>
      <Text className="text-neutral-100 text-base ml-3">{label}</Text>
    </Pressable>
  );
}
