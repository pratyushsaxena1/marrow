import { DOMAINS } from "../constants";
import type { CardState, Domain } from "../types";

export type DomainStat = { seen: number; total: number };

export type Stats = {
  learned: number;   // number of card_state rows (cards seen at least once)
  mastered: number;  // rows where status === "review"
  dueToday: number;  // rows where dueAt <= now
  perDomain: Record<Domain, DomainStat>;
};

export type StatsDeps = {
  states: CardState[];
  now: number;
  domainOf: (cardId: string) => Domain | undefined; // resolve a card id to its domain (via corpus.getCard in real use)
  totals: Record<Domain, number>;                   // corpus counts per domain
};

// Derives all figures from card_state at read time, so there is no separate tracking
// to keep in sync. perDomain is seeded for every domain up front so the UI can render
// a stable four-row breakdown even before any card in a domain has been seen. An id
// that domainOf cannot resolve (an orphaned row) still counts toward the totals but
// belongs to no domain, so it is deliberately left out of every perDomain.seen tally.
export function computeStats(deps: StatsDeps): Stats {
  const perDomain = {} as Record<Domain, DomainStat>;
  for (const d of DOMAINS) perDomain[d] = { seen: 0, total: deps.totals[d] };

  let learned = 0;
  let mastered = 0;
  let dueToday = 0;

  for (const st of deps.states) {
    learned += 1;
    if (st.status === "review") mastered += 1;
    if (st.dueAt <= deps.now) dueToday += 1;
    const domain = deps.domainOf(st.cardId);
    if (domain !== undefined) perDomain[domain].seen += 1;
  }

  return { learned, mastered, dueToday, perDomain };
}
