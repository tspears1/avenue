#!/usr/bin/env node
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncFigma } from "../src/figma-sync.js";

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node bin/sync-figma.js [--apply]\n\nDry run by default. Requires Node 24+, FIGMA_FILE_KEY and FIGMA_ACCESS_TOKEN.\nBuild dist/figma-tokens.json first. Reports are saved to .figma-sync/.");
} else {
  try {
    if (args.some((arg) => arg !== "--apply") || args.length > 1) throw new Error("Only --apply is supported. Omit it for a dry run.");
    const apply = args.includes("--apply");
    const artifact = JSON.parse(await readFile(path.join(packageDirectory, "dist/figma-tokens.json"), "utf8"));
    const reportDirectory = path.join(packageDirectory, ".figma-sync");
    await mkdir(reportDirectory, { recursive: true });
    const save = (name, value) => writeFile(path.join(reportDirectory, name), `${JSON.stringify(value, null, 2)}\n`);
    const result = await syncFigma({
      artifact, apply,
      fileKey: process.env.FIGMA_FILE_KEY,
      token: process.env.FIGMA_ACCESS_TOKEN,
      onSnapshot: (snapshot) => save("before.json", snapshot),
      onReadback: (snapshot) => save("after.json", snapshot),
      onVerification: async (verification) => {
        await save("verification.json", verification);
        if (!verification.matches) {
          const kinds = {};
          for (const operation of verification.plan.operations) kinds[operation.kind] = (kinds[operation.kind] ?? 0) + 1;
          const detail = `Read-back verification: ${verification.plan.operations.length} remaining operations (${Object.entries(kinds).map(([kind, count]) => `${kind}: ${count}`).join(", ")}). See after.json and verification.json in the reports artifact.`;
          console.log(detail);
          if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${detail}\n`);
        }
      },
      onPlan: async ({ plan, payload, ignoredEffectStyles }) => {
        await save("plan.json", { fileKey: process.env.FIGMA_FILE_KEY, commit: process.env.GITHUB_SHA, counts: plan.counts, operations: plan.operations, ignoredEffectStyles });
        await save("payload.json", payload);
        const summary = [
          "## Figma sandbox token sync", "",
          `Mode: **${apply ? "apply requested" : "dry run — no writes"}**`,
          `Target file: \`${process.env.FIGMA_FILE_KEY}\``,
          `Commit: \`${process.env.GITHUB_SHA ?? "local"}\``, "",
          "| Entity | Create | Update | Unchanged |", "|---|---:|---:|---:|",
          ...["collections", "modes", "variables"].map((kind) => {
            const count = plan.counts[kind];
            return `| ${kind} | ${count.create} | ${count.update} | ${count.unchanged} |`;
          }), "",
          `${plan.operations.length} planned operations. Deletes are disabled.`,
          `${ignoredEffectStyles} Effect Styles are NOT synced by REST; use the plugin.`,
          "Library publishing and consumer-file updates are not performed.", "",
        ].join("\n");
        console.log(summary);
        if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
      },
    });
    const status = result.applied ? "Applied and verified by reading Figma back." : result.plan.operations.length ? "Dry run complete. No changes were written." : "Already current. No changes were written.";
    await save("result.json", { applied: result.applied, verified: result.verified, status });
    console.log(status);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n**${status}**\n`);
  } catch (error) {
    console.error(`Figma sync failed: ${error.message}`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, "\n**Sync failed. Check the failed step and saved reports; do not assume the file is current.**\n");
    process.exitCode = 1;
  }
}
