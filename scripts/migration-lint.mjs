// Idempotency lint for supabase/migrations/.
//
//   node scripts/migration-lint.mjs [dir]
//
// Every migration written after the hand-applied baseline (0001–0052) must be
// safe to run twice: the db-migrate workflow only runs a file once, but a
// half-failed push, a manual re-run in the SQL editor or a restored backup all
// end up re-executing SQL, and the PL-25 incident came from exactly that kind
// of drift. The rules below are regex checks over the SQL with comments,
// string literals and dollar-quoted bodies removed, so they only see
// top-level statements. They are deliberately strict; when a statement really
// cannot be made idempotent, wrap it in a `do $$ ... $$` block that checks the
// catalog first — bodies are not inspected.
//
// Also imported by lib/migration-lint.test.ts, so `npm test` runs it too.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Migrations up to and including this version were applied by hand and are never re-run. */
export const BASELINE_VERSION = 52n;

export const MIGRATION_FILE = /^(\d+)_([A-Za-z0-9_-]+)\.sql$/;

export function parseMigrationName(fileName) {
  const m = MIGRATION_FILE.exec(fileName);
  return m ? { version: m[1], name: m[2] } : null;
}

export function isAfterBaseline(version) {
  return BigInt(version) > BASELINE_VERSION;
}

/** Comments, dollar-quoted bodies and string literals out; lower-cased; one space per run of whitespace. */
export function stripSql(text) {
  return text
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, " $body$ ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function statements(stripped) {
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function head(st) {
  return st.length > 70 ? `${st.slice(0, 70)}…` : st;
}

function unquote(ident) {
  return ident.replace(/"/g, "");
}

/**
 * @param {string} sql
 * @returns {string[]} problems, empty when the file passes
 */
export function lintMigrationSql(sql) {
  const problems = [];
  const stripped = stripSql(sql);
  const sts = statements(stripped);
  const droppedPolicies = new Set();
  const droppedTriggers = new Set();

  const fail = (st, message) => problems.push(`${message} — "${head(st)}"`);

  for (const st of sts) {
    let m;

    // ---- create ---------------------------------------------------------
    if (/^create (global |local |temporary |temp |unlogged )*table\b/.test(st)) {
      if (!/\btable if not exists\b/.test(st)) fail(st, "create table needs `if not exists`");
      continue;
    }
    if (/^create (unique )?index\b/.test(st)) {
      if (!/\bindex (concurrently )?if not exists\b/.test(st)) fail(st, "create index needs `if not exists`");
      continue;
    }
    if (/^create schema\b/.test(st)) {
      if (!/\bschema if not exists\b/.test(st)) fail(st, "create schema needs `if not exists`");
      continue;
    }
    if (/^create extension\b/.test(st)) {
      if (!/\bextension if not exists\b/.test(st)) fail(st, "create extension needs `if not exists`");
      continue;
    }
    if (/^create sequence\b/.test(st)) {
      if (!/\bsequence if not exists\b/.test(st)) fail(st, "create sequence needs `if not exists`");
      continue;
    }
    if (/^create materialized view\b/.test(st)) {
      if (!/\bview if not exists\b/.test(st)) fail(st, "create materialized view needs `if not exists`");
      continue;
    }
    if (/^create (or replace )?(temp |temporary )?(recursive )?view\b/.test(st)) {
      if (!/^create or replace\b/.test(st)) fail(st, "create view needs `or replace`");
      continue;
    }
    if (/^create (or replace )?(function|procedure)\b/.test(st)) {
      if (!/^create or replace\b/.test(st)) {
        fail(st, "create function needs `or replace` (add `drop function if exists <old signature>` first when the parameters change)");
      }
      continue;
    }
    if ((m = /^create (or replace )?(constraint )?trigger ("?[\w]+"?)/.exec(st))) {
      const name = unquote(m[3]);
      if (!m[1] && !droppedTriggers.has(name)) {
        fail(st, "create trigger needs `or replace` or a preceding `drop trigger if exists <name> on <table>`");
      }
      continue;
    }
    if ((m = /^create policy ("?[\w]+"?) on ("?[\w.]+"?)/.exec(st))) {
      const key = `${unquote(m[1])}@${unquote(m[2])}`;
      if (!droppedPolicies.has(key)) {
        fail(st, "create policy needs a preceding `drop policy if exists <name> on <table>` (policies have no `if not exists`)");
      }
      continue;
    }
    if (/^create (type|domain|role|publication)\b/.test(st)) {
      fail(st, "create type/domain/role/publication has no `if not exists`: wrap it in `do $$ begin ... exception when duplicate_object then null; end $$`");
      continue;
    }

    // ---- drop -----------------------------------------------------------
    if ((m = /^drop (table|function|procedure|policy|trigger|index|type|domain|view|materialized view|schema|sequence|extension|publication)\b/.exec(st))) {
      const kind = m[1];
      if (!new RegExp(`^drop ${kind} (concurrently )?if exists\\b`).test(st)) fail(st, `drop ${kind} needs \`if exists\``);
      if (kind === "policy") {
        const p = /^drop policy if exists ("?[\w]+"?) on ("?[\w.]+"?)/.exec(st);
        if (p) droppedPolicies.add(`${unquote(p[1])}@${unquote(p[2])}`);
      }
      if (kind === "trigger") {
        const t = /^drop trigger if exists ("?[\w]+"?)/.exec(st);
        if (t) droppedTriggers.add(unquote(t[1]));
      }
      continue;
    }

    // ---- alter ----------------------------------------------------------
    if (/^alter table\b/.test(st)) {
      const actions = st.replace(/^alter table (if exists )?(only )?"?[\w.]+"?\s*/, "").split(/\s*,\s*(?=(?:add|drop|alter|rename|enable|disable|force|no force|set|reset|owner|cluster|validate|attach|detach|inherit|no inherit|replica|of|not of)\b)/);
      for (const a of actions) {
        if (/^add column\b/.test(a)) {
          if (!/^add column if not exists\b/.test(a)) fail(st, "add column needs `if not exists`");
        } else if (/^add constraint\b/.test(a)) {
          fail(st, "add constraint has no `if not exists`: wrap it in a `do $$` block that checks pg_constraint first");
        } else if (/^add (check|unique|primary key|foreign key|exclude)\b/.test(a)) {
          fail(st, "unnamed constraints cannot be made idempotent: name it and guard it in a `do $$` block");
        } else if (/^add\b/.test(a)) {
          fail(st, "`add <column>` needs the explicit form `add column if not exists`");
        } else if (/^drop column\b/.test(a)) {
          if (!/^drop column if exists\b/.test(a)) fail(st, "drop column needs `if exists`");
        } else if (/^drop constraint\b/.test(a)) {
          if (!/^drop constraint if exists\b/.test(a)) fail(st, "drop constraint needs `if exists`");
        } else if (/^drop\b/.test(a)) {
          fail(st, "`drop <column>` needs the explicit form `drop column if exists`");
        } else if (/^rename\b/.test(a)) {
          fail(st, "rename is not idempotent: guard it in a `do $$` block that checks information_schema.columns / pg_class first");
        }
      }
      continue;
    }
    if (/^alter type \S+ add value\b/.test(st)) {
      if (!/\badd value if not exists\b/.test(st)) fail(st, "alter type ... add value needs `if not exists`");
      continue;
    }
    if (/^alter (type|function|procedure|index|view|sequence|schema|policy|trigger) .* rename\b/.test(st)) {
      fail(st, "rename is not idempotent: guard it in a `do $$` block");
      continue;
    }
    if (/^alter publication \S+ add table\b/.test(st)) {
      fail(st, "alter publication ... add table fails on a second run: guard it in a `do $$` block that checks pg_publication_tables");
      continue;
    }

    // ---- data -----------------------------------------------------------
    if (/^insert into\b/.test(st)) {
      if (!/\bon conflict\b/.test(st) && !/\bwhere not exists\b/.test(st)) {
        fail(st, "insert needs `on conflict ... do nothing/update` (or `insert ... select ... where not exists`)");
      }
      continue;
    }
  }

  return problems;
}

/**
 * @param {string} dir
 * @returns {{ file: string, problems: string[] }[]} one entry per checked file that has problems
 */
export function lintMigrationsDir(dir) {
  const results = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".sql")) continue;
    const parsed = parseMigrationName(file);
    if (!parsed) {
      results.push({ file, problems: ["file name must be `<digits>_<snake_case_name>.sql` or the Supabase CLI skips it"] });
      continue;
    }
    if (!isAfterBaseline(parsed.version)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    if (/^\s*--\s*migration-lint:\s*ignore\b/m.test(sql)) continue;
    const problems = lintMigrationSql(sql);
    if (problems.length) results.push({ file, problems });
  }
  return results;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = process.argv[2] ?? "supabase/migrations";
  const results = lintMigrationsDir(dir);
  if (results.length === 0) {
    console.log(`migration-lint: ${dir} ok`);
  } else {
    for (const { file, problems } of results) {
      for (const p of problems) console.error(`${file}: ${p}`);
    }
    console.error(`migration-lint: ${results.length} file(s) with problems`);
    process.exit(1);
  }
}
