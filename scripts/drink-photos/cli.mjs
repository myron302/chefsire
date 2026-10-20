#!/usr/bin/env node
// ChefSire original drink photography — preservation CLI. See docs/drink-photography-preservation.md.
import fs from "node:fs";
import { adoptLegacy, DEFAULT_ROOT, importBatch, recordDecision, refreshDerived, verify } from "./lib/core.mjs";

const [command, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const key = rest[i].slice(2);
    flags[key] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
  } else positional.push(rest[i]);
}
const root = flags.root ? String(flags.root) : DEFAULT_ROOT;

const USAGE = `Usage:
  photos import <dir-or-archive> --batch <id> [--dry-run] [--summary-file <path>] [--root <dir>]
  photos review <categoryId> --sha <sha256> --status approved|rejected|pending --by <name> [--note <text>]
  photos adopt-legacy      Create generation records for the five PR #1322 masters
  photos refresh           Rebuild manifest.json and REPORT.md
  photos verify            Check every master, record, approval and derived file
  photos report            Print the owner status report`;

function fail(message) { console.error(message); process.exit(1); }

try {
  switch (command) {
    case "import": {
      if (!positional[0]) fail(USAGE);
      const r = importBatch({ root, input: positional[0], batchId: flags.batch, dryRun: Boolean(flags["dry-run"]) });
      const lines = [
        `Batch ${r.batchId} from ${r.source.kind} "${r.source.name}"${r.dryRun ? " (dry run: nothing written)" : ""}`,
        `  imported:  ${r.imported.length}`, ...r.imported.map((x) => `    + ${x.categoryId}  ${x.sha256}`),
        `  unchanged: ${r.unchanged.length}`, ...r.unchanged.map((x) => `    = ${x.categoryId}`),
        `  rejected:  ${r.rejected.length}`, ...r.rejected.map((x) => `    ! ${x.file}: ${x.reason}`),
        ...r.warnings.map((w) => `  warning: ${w}`),
      ];
      console.log(lines.join("\n"));
      if (typeof flags["summary-file"] === "string") fs.writeFileSync(flags["summary-file"], `${JSON.stringify(r, null, 2)}\n`);
      process.exit(r.rejected.length ? 2 : 0);
    }
    case "review": {
      const d = recordDecision({ root, categoryId: positional[0], sha256: flags.sha, status: flags.status, decidedBy: flags.by, note: typeof flags.note === "string" ? flags.note : null });
      console.log(`Recorded ${d.status} for ${d.categoryId} (${d.sha256.slice(0, 12)}…) by ${d.decidedBy}`);
      break;
    }
    case "adopt-legacy": {
      const r = adoptLegacy({ root });
      console.log(`legacy records created: ${r.created.length}, unchanged: ${r.unchanged.length}`);
      break;
    }
    case "refresh": {
      const m = refreshDerived(root);
      console.log(JSON.stringify(m.counts));
      break;
    }
    case "verify": {
      const r = verify(root);
      r.warnings.forEach((w) => console.log(`warning: ${w}`));
      if (!r.ok) { r.errors.forEach((e) => console.error(`error: ${e}`)); process.exit(1); }
      console.log("verify: OK");
      break;
    }
    case "report":
      console.log(fs.readFileSync(`${root}/REPORT.md`, "utf8"));
      break;
    default:
      fail(USAGE);
  }
} catch (err) {
  fail(`error: ${err.message}`);
}
