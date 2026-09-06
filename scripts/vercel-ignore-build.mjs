// Vercel "Ignored Build Step" (Settings → Git → Ignored Build Step):
//
//   node scripts/vercel-ignore-build.mjs
//
// Exit 0 cancels the build, exit 1 lets it run. We build only when every file
// in supabase/migrations/ is already recorded as applied on the Supabase
// project, read through the public.migration_versions() RPC. A commit that
// ships a migration the database does not have yet is therefore never
// deployed by the Git integration; the db-migrate GitHub workflow applies the
// migration and re-triggers the build through a deploy hook (deploy-hook
// builds run this script too, and by then the check passes).
//
// Every failure mode is fail-open (build): a missing env var, an unreachable
// API or an RPC that does not exist yet must not brick deployments — that is
// exactly the situation before PL-31 and the app kept deploying then.

import { readdirSync } from "node:fs";

const MIGRATION_FILE = /^(\d+)_.+\.sql$/;

function build(reason) {
  console.log(`[db-gate] build: ${reason}`);
  process.exit(1);
}

function skip(reason) {
  console.log(`[db-gate] skip: ${reason}`);
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) build("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set, cannot check");

let local;
try {
  local = readdirSync("supabase/migrations")
    .map((f) => MIGRATION_FILE.exec(f)?.[1])
    .filter(Boolean)
    .sort();
} catch (e) {
  build(`cannot read supabase/migrations: ${e.message}`);
}

let applied;
try {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/migration_versions`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    build(`migration_versions returned HTTP ${res.status}: ${text}`);
  }
  applied = await res.json();
  if (!Array.isArray(applied)) build(`unexpected migration_versions response: ${JSON.stringify(applied).slice(0, 200)}`);
} catch (e) {
  build(`could not reach Supabase: ${e.message}`);
}

const missing = local.filter((v) => !applied.includes(v));
if (missing.length > 0) {
  skip(
    `${missing.length} migration(s) not applied on Supabase yet (${missing.join(", ")}); ` +
      "the db-migrate workflow applies them and re-triggers this build through the deploy hook",
  );
}
build(`all ${local.length} migrations are applied on Supabase`);
