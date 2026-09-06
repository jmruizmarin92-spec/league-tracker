import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  isAfterBaseline,
  lintMigrationSql,
  lintMigrationsDir,
  parseMigrationName,
  stripSql,
} from "../scripts/migration-lint.mjs";

describe("migration file names", () => {
  it("accepts numeric and timestamp prefixes", () => {
    expect(parseMigrationName("0052_event_prize_budgets.sql")).toEqual({ version: "0052", name: "event_prize_budgets" });
    expect(parseMigrationName("20260906120000_migration_versions.sql")).toEqual({
      version: "20260906120000",
      name: "migration_versions",
    });
  });

  it("rejects names the Supabase CLI would skip", () => {
    expect(parseMigrationName("fix.sql")).toBeNull();
    expect(parseMigrationName("0053-fix.sql")).toBeNull();
    expect(parseMigrationName("0053_fix.SQL")).toBeNull();
  });

  it("only checks files after the hand-applied baseline", () => {
    expect(isAfterBaseline("0052")).toBe(false);
    expect(isAfterBaseline("0053")).toBe(true);
    expect(isAfterBaseline("20260906120000")).toBe(true);
  });
});

describe("stripSql", () => {
  it("drops comments, string literals and dollar-quoted bodies", () => {
    const out = stripSql(`-- create table in a comment
      create or replace function f() returns void language plpgsql as $$
      begin insert into t values (1); create table x (a int); end $$;
      insert into t (a) values ('create table; drop table') on conflict do nothing; /* create table */`);
    expect(out).not.toContain("create table");
    expect(out).toContain("$body$");
    expect(out).toMatch(/insert into t \(a\) values \(''\) on conflict do nothing/);
  });
});

describe("lintMigrationSql", () => {
  const ok = (sql: string) => expect(lintMigrationSql(sql)).toEqual([]);
  const bad = (sql: string, fragment: string) => {
    const problems = lintMigrationSql(sql);
    expect(problems.length, problems.join("\n")).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(fragment);
  };

  it("create table / index / schema / extension / sequence", () => {
    ok("create table if not exists public.t (id uuid primary key);");
    bad("create table public.t (id uuid primary key);", "create table needs");
    ok("create index if not exists t_a_idx on public.t (a);");
    ok("create unique index if not exists t_a_idx on public.t (a);");
    bad("create index t_a_idx on public.t (a);", "create index needs");
    ok("create schema if not exists audit;");
    bad("create schema audit;", "create schema needs");
    ok("create extension if not exists pgcrypto with schema extensions;");
    bad("create extension pgcrypto;", "create extension needs");
    bad("create sequence s;", "create sequence needs");
  });

  it("functions, views and triggers", () => {
    ok("create or replace function public.f() returns int language sql as $$ select 1 $$;");
    bad("create function public.f() returns int language sql as $$ select 1 $$;", "create function needs `or replace`");
    ok("drop function if exists public.f(int); create or replace function public.f(int, int) returns int language sql as $$ select 1 $$;");
    bad("drop function public.f(int);", "drop function needs `if exists`");
    ok("create or replace view public.v as select 1;");
    bad("create view public.v as select 1;", "create view needs");
    ok("create or replace trigger trg before insert on public.t for each row execute function public.f();");
    ok("drop trigger if exists trg on public.t; create trigger trg before insert on public.t for each row execute function public.f();");
    bad("create trigger trg before insert on public.t for each row execute function public.f();", "create trigger needs");
  });

  it("policies need a drop first, matched by name and table", () => {
    ok(`drop policy if exists "t_select" on public.t;
        create policy "t_select" on public.t for select using (true);`);
    bad(`create policy "t_select" on public.t for select using (true);`, "create policy needs");
    bad(`drop policy if exists "t_select" on public.other;
         create policy "t_select" on public.t for select using (true);`, "create policy needs");
    bad(`drop policy "t_select" on public.t;`, "drop policy needs");
  });

  it("types and other objects without if-not-exists must be guarded", () => {
    bad("create type public.mood as enum ('a');", "create type/domain");
    ok(`do $$ begin create type public.mood as enum ('a'); exception when duplicate_object then null; end $$;`);
    ok("alter type public.mood add value if not exists 'b';");
    bad("alter type public.mood add value 'b';", "add value needs");
    bad("alter publication supabase_realtime add table public.t;", "alter publication");
  });

  it("alter table actions", () => {
    ok("alter table public.t add column if not exists a int;");
    bad("alter table public.t add column a int;", "add column needs");
    bad("alter table public.t add a int;", "explicit form `add column if not exists`");
    ok("alter table public.t add column if not exists a int, add column if not exists b int;");
    bad("alter table public.t add column if not exists a int, add column b int;", "add column needs");
    bad("alter table public.t add constraint t_a_check check (a > 0);", "add constraint");
    bad("alter table public.t add check (a > 0);", "unnamed constraints");
    ok("alter table public.t drop column if exists a;");
    bad("alter table public.t drop column a;", "drop column needs");
    ok("alter table public.t drop constraint if exists t_a_check;");
    bad("alter table public.t drop constraint t_a_check;", "drop constraint needs");
    bad("alter table public.t rename column a to b;", "rename is not idempotent");
    ok("alter table public.t enable row level security;");
    ok("alter table public.t alter column a set default 0;");
    ok("alter table public.t alter column a set not null, alter column b type text;");
  });

  it("drops", () => {
    ok("drop table if exists public.t;");
    bad("drop table public.t;", "drop table needs");
    ok("drop index if exists public.t_idx;");
    bad("drop index public.t_idx;", "drop index needs");
    ok("drop view if exists public.v;");
    ok("drop type if exists public.mood;");
  });

  it("inserts", () => {
    ok("insert into public.t (id, name) values (1, 'a') on conflict (id) do nothing;");
    ok("insert into public.t (id, name) values (1, 'a') on conflict (id) do update set name = excluded.name;");
    ok("insert into public.t (id) select 1 where not exists (select 1 from public.t where id = 1);");
    bad("insert into public.t (id, name) values (1, 'a');", "insert needs");
  });

  it("grants, comments and updates are fine as they are", () => {
    ok("grant select on public.t to anon, authenticated;");
    ok("revoke all on function public.f() from public;");
    ok("comment on table public.t is 'x';");
    ok("update public.t set a = 1 where a is null;");
    ok("delete from public.t where a = 1;");
  });
});

describe("supabase/migrations on disk", () => {
  it("every migration after the baseline is idempotent and well named", () => {
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const results = lintMigrationsDir(dir);
    const report = results.map((r) => `${r.file}\n  ${r.problems.join("\n  ")}`).join("\n");
    expect(results, report).toEqual([]);
  });
});
