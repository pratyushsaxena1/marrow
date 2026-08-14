import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { Icon } from "./Icon";
import { Button, IconButton } from "./Button";
import { COLORS } from "./theme";
import { tick } from "./haptics";
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

  const toggleDomain = (d: Domain) => {
    tick();
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

  // The sheet used to carry an "All domains" row above the four subjects: a checkbox
  // that looked exactly like the ones it governed, and that sat checked at the same
  // time as all four, stating the same fact twice. The four subjects are the whole
  // truth now, and this line says what the current set adds up to.
  const summary = allChecked
    ? "Drawing from every subject."
    : `Drawing from ${listNames(working)}.`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable
          onPress={() => {}}
          className="bg-neutral-900 rounded-t-3xl px-6 pt-5 pb-10 border-t border-neutral-800"
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-neutral-100 text-xl font-semibold">Subjects</Text>
            <View className="flex-row items-center -mr-2">
              {allChecked ? null : (
                <Pressable
                  onPress={() => {
                    tick();
                    setWorking([]);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  className="px-2 py-2 active:opacity-60"
                >
                  <Text className="text-neutral-400 text-sm font-medium">Select all</Text>
                </Pressable>
              )}
              <IconButton name="close" size={16} onPress={onClose} label="Close" />
            </View>
          </View>
          <Text className="text-neutral-500 text-sm mb-4">{summary}</Text>

          {DOMAINS.map((d) => (
            <Row
              key={d}
              label={DOMAIN_LABELS[d]}
              checked={isChecked(d)}
              onPress={() => toggleDomain(d)}
            />
          ))}

          <Button label="Apply" onPress={apply} style={{ marginTop: 24 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "Math", "Math and Science", "CS, Math and Science". */
function listNames(domains: Domain[]): string {
  const names = DOMAINS.filter((d) => domains.includes(d)).map((d) => DOMAIN_LABELS[d]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Row(
  { label, checked, onPress }:
  { label: string; checked: boolean; onPress: () => void },
) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      className="flex-row items-center py-3 active:opacity-60"
    >
      <View
        className={
          checked
            ? "w-6 h-6 rounded-lg items-center justify-center bg-neutral-100"
            : "w-6 h-6 rounded-lg items-center justify-center border border-neutral-700"
        }
      >
        {checked ? <Icon name="check" size={14} color={COLORS.bg} /> : null}
      </View>
      <Text className="text-neutral-100 text-base ml-3">{label}</Text>
    </Pressable>
  );
}
