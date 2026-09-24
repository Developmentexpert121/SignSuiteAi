// ─── pnpm snapshot-users CLI ─────────────────────────────────────────────────
// Refreshes lib/db/src/snapshot-data.ts from the live database. Run this
// before deploying to a new production environment to make sure the new
// server boots with an up-to-date copy of all current users + subscriptions.
//
//   Usage:
//     pnpm --filter @workspace/scripts run snapshot-users
//
//   Required env:
//     DO_DATABASE_URL                # source database connection string
//
// The output file is committed to git. After running, review the diff and
// commit so the next deploy includes the refreshed snapshot.

import { buildPoolConfig } from "@workspace/db";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (v instanceof Date) return `new Date(${JSON.stringify(v.toISOString())})`;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function rowToTs(row: Record<string, unknown>, cols: string[]): string {
  const lines = cols.map((c) => `    ${c}: ${fmt(row[c])},`);
  return `  {\n${lines.join("\n")}\n  },`;
}

async function main(): Promise<void> {
  const url = process.env.DO_DATABASE_URL;
  if (!url) {
    console.error("✗ DO_DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool(buildPoolConfig(url));
  try {
    const users   = await pool.query("SELECT * FROM users ORDER BY id");
    const subs    = await pool.query("SELECT * FROM user_subscriptions ORDER BY id");
    const biz     = await pool.query("SELECT * FROM business_details ORDER BY id");
    console.log(
      `Captured ${users.rows.length} users, ${subs.rows.length} subscriptions, ${biz.rows.length} companies`
    );

    const userCols = users.rows.length ? Object.keys(users.rows[0]) : [];
    const subCols  = subs.rows.length  ? Object.keys(subs.rows[0])  : [];
    const bizCols  = biz.rows.length   ? Object.keys(biz.rows[0])   : [];

    const lines: string[] = [];
    lines.push("// AUTO-GENERATED snapshot of production user + subscription data.");
    lines.push(`// Captured ${new Date().toISOString()} via pnpm snapshot-users.`);
    lines.push("// Inserted idempotently by seeds.ts on every fresh deploy so any new");
    lines.push("// production environment is a 1:1 clone of current production data.");
    lines.push("//");
    lines.push("// To refresh this snapshot from the current live database, run:");
    lines.push("//   pnpm --filter @workspace/scripts run snapshot-users");
    lines.push("");
    lines.push("// deno-fmt-ignore-file");
    lines.push("/* eslint-disable */");
    lines.push("");
    lines.push("export interface SnapshotUser { [key: string]: any }");
    lines.push("export interface SnapshotSubscription { [key: string]: any }");
    lines.push("export interface SnapshotBusinessDetail { [key: string]: any }");
    lines.push("");
    lines.push(`export const SNAPSHOT_USER_COLUMNS = ${JSON.stringify(userCols)};`);
    lines.push(`export const SNAPSHOT_SUBSCRIPTION_COLUMNS = ${JSON.stringify(subCols)};`);
    lines.push(`export const SNAPSHOT_BUSINESS_DETAIL_COLUMNS = ${JSON.stringify(bizCols)};`);
    lines.push("");
    lines.push("export const SNAPSHOT_USERS: SnapshotUser[] = [");
    lines.push(users.rows.map((r) => rowToTs(r, userCols)).join("\n"));
    lines.push("];");
    lines.push("");
    lines.push("export const SNAPSHOT_SUBSCRIPTIONS: SnapshotSubscription[] = [");
    lines.push(subs.rows.map((r) => rowToTs(r, subCols)).join("\n"));
    lines.push("];");
    lines.push("");
    lines.push("export const SNAPSHOT_BUSINESS_DETAILS: SnapshotBusinessDetail[] = [");
    lines.push(biz.rows.map((r) => rowToTs(r, bizCols)).join("\n"));
    lines.push("];");
    lines.push("");

    const outPath = resolve(process.cwd(), "../lib/db/src/snapshot-data.ts");
    writeFileSync(outPath, lines.join("\n"));
    console.log(`✓ Wrote ${outPath}`);
    console.log("\nNext steps:");
    console.log("  1. Review the diff: git diff lib/db/src/snapshot-data.ts");
    console.log("  2. Commit: git add lib/db/src/snapshot-data.ts && git commit -m 'refresh user snapshot'");
    console.log("  3. Push and redeploy.");
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error("✗ Snapshot failed:", err);
  process.exitCode = 1;
});
