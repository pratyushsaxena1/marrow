import * as fs from "fs";
import * as path from "path";
import { validateCorpus } from "../src/corpus/schema";
import { DOMAINS } from "../src/constants";

const EXPECTED: Record<string, number> = { cs: 38, math: 38, finance: 37, science: 37 };

let failed = false;
for (const domain of DOMAINS) {
  const file = path.join(__dirname, "..", "corpus", `${domain}.json`);
  const cards = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
  const errors = validateCorpus(cards, domain);
  if (errors.length > 0) {
    failed = true;
    console.error(`\n${domain}.json — ${errors.length} error(s):`);
    for (const e of errors) console.error(`  ${e}`);
  }
  const want = EXPECTED[domain];
  const status = cards.length === want ? "ok" : `expected ${want}`;
  console.log(`${domain}.json: ${cards.length} cards (${status}), ${errors.length} errors`);
}
process.exit(failed ? 1 : 0);
