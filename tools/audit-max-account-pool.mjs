/**
 * Аудит classic max-account: shop + craft reachability (variant A).
 * node tools/audit-max-account-pool.mjs [--json]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditMaxAccountPool,
  createMaxAccountSandbox,
} from "./lib/max-account-sandbox.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const jsonOut = process.argv.includes("--json");

const sandbox = createMaxAccountSandbox(ROOT, "classic");
const report = auditMaxAccountPool(sandbox);

if (jsonOut) {
  console.log(JSON.stringify({
    ...report,
    unreachable: report.unreachableIds,
  }, null, 2));
} else {
  console.log("Max-account pool audit (classic, variant A)");
  console.log(`  catalog:        ${report.catalogTotal}`);
  console.log(`  playable:       ${report.playableTotal}`);
  console.log(`  shop-eligible:  ${report.shopEligible}`);
  console.log(`  craft-only:     ${report.craftOnly}`);
  console.log(`  craft-outputs:  ${report.craftOutputs}`);
  console.log(`  reachable:      ${report.reachable}`);
  console.log(`  unreachable:    ${report.unreachableIds.length}`);
  if (report.unreachableIds.length) {
    console.log("  unreachable ids:");
    report.unreachableIds.forEach((id) => console.log(`    - ${id}`));
  }
}

if (report.unreachableIds.length > 0) {
  process.exitCode = 1;
}
