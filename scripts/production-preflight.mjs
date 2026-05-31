import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const optionalAuth = process.argv.includes("--allow-missing-auth");
const allowDirty = process.argv.includes("--allow-dirty");
const requiredEnv = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "VERCEL_TOKEN",
  "VERCEL_SCOPE",
  "VERCEL_PROJECT",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

/** Runs a small production readiness check without printing secret values. */
function main() {
  const failures = [];
  const warnings = [];

  checkCleanWorktree(failures);
  checkVercelConfig(failures);
  checkEnvironment(failures, warnings);

  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  if (failures.length > 0) {
    console.error("Production preflight failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("Production preflight passed.");
}

/** Requires deploys to start from a reproducible git state. */
function checkCleanWorktree(failures) {
  if (allowDirty) return;
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  if (status.length > 0) {
    failures.push("git worktree is not clean");
  }
}

/** Confirms Vercel is configured as a single-page app. */
function checkVercelConfig(failures) {
  try {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
    const hasSpaRewrite = rewrites.some(
      (rewrite) => rewrite.source === "/(.*)" && ["/", "/index.html"].includes(rewrite.destination),
    );
    if (!hasSpaRewrite) {
      failures.push("vercel.json does not contain the SPA rewrite");
    }
  } catch (error) {
    failures.push(`vercel.json is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Validates production tokens and the two browser-safe Supabase values. */
function checkEnvironment(failures, warnings) {
  for (const name of requiredEnv) {
    if (!process.env[name] || process.env[name]?.trim().length === 0) {
      const message = `${name} is missing`;
      if (optionalAuth) warnings.push(message);
      else failures.push(message);
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
        failures.push("VITE_SUPABASE_URL must be an https://*.supabase.co project URL");
      }
    } catch {
      failures.push("VITE_SUPABASE_URL is not a valid URL");
    }
  }

  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (publishableKey && !publishableKey.startsWith("sb_publishable_")) {
    failures.push("VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key, not a service_role or secret key");
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith("VITE_") || !value) continue;
    if (/service_role|sb_secret_|private[_-]?key|client[_-]?secret/i.test(value)) {
      failures.push(`${name} appears to contain a secret-bearing value`);
    }
  }
}

main();
