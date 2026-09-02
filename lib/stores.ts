import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/auth";

// A store/organiser as the Play! Pokémon site sees it: its "League ID" is
// permanent (WAR LOTUS STORE = 6236068) and every season league and every
// pasted event hangs off it (0045).
export type Store = {
  id: string;
  name: string;
  slug: string;
  play_league_id: string | null;
  created_at: string;
};

export async function listStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .order("name", { ascending: true });
  return (data as Store[] | null) ?? [];
}

export const getStoreById = cache(async (id: string): Promise<Store | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as Store | null;
});

export const getStoreBySlug = cache(async (slug: string): Promise<Store | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data as Store | null;
});

// --- Store roster (0046) ---
//
// Same shape as league_members: owners manage the store's admins, site
// admins manage owners. A store admin is an admin of every league and event
// of the store — the SQL helpers is_league_admin / is_event_admin take care
// of that, so nothing here has to expand the membership.

export type StoreRole = "owner" | "admin";

export type StoreAdmin = {
  user_id: string;
  role: StoreRole;
  display_name: string;
  avatar_url: string | null;
};

type MemberRow = { store_id: string; user_id: string; role: StoreRole };
type ProfileRow = { id: string; display_name: string; avatar_url: string | null };

function toStoreAdmins(rows: MemberRow[], profiles: ProfileRow[]): StoreAdmin[] {
  const profMap = new Map(profiles.map((p) => [p.id, p]));
  return rows
    .map((m) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: profMap.get(m.user_id)?.display_name ?? "—",
      avatar_url: profMap.get(m.user_id)?.avatar_url ?? null,
    }))
    .sort((a, b) =>
      a.role === b.role
        ? a.display_name.localeCompare(b.display_name)
        : a.role === "owner"
          ? -1
          : 1,
    );
}

export async function listStoreAdmins(storeId: string): Promise<StoreAdmin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_admins")
    .select("store_id, user_id, role")
    .eq("store_id", storeId);
  const rows = (data as MemberRow[] | null) ?? [];
  if (rows.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in(
      "id",
      rows.map((m) => m.user_id),
    );
  return toStoreAdmins(rows, (profs as ProfileRow[] | null) ?? []);
}

// Every store's roster in one go, for /admin/stores.
export async function listAllStoreAdmins(): Promise<Map<string, StoreAdmin[]>> {
  const supabase = await createClient();
  const { data } = await supabase.from("store_admins").select("store_id, user_id, role");
  const rows = (data as MemberRow[] | null) ?? [];
  const out = new Map<string, StoreAdmin[]>();
  if (rows.length === 0) return out;
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", [...new Set(rows.map((m) => m.user_id))]);
  const profiles = (profs as ProfileRow[] | null) ?? [];
  for (const storeId of new Set(rows.map((m) => m.store_id))) {
    out.set(
      storeId,
      toStoreAdmins(
        rows.filter((m) => m.store_id === storeId),
        profiles,
      ),
    );
  }
  return out;
}

// Registered users, for the add-admin pickers (the caller filters out the
// ones already on a roster).
export async function listProfilesForPicker(): Promise<{ id: string; display_name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");
  return (data as { id: string; display_name: string }[] | null) ?? [];
}

export async function listAddableStoreUsers(
  storeId: string,
): Promise<{ id: string; display_name: string }[]> {
  const [admins, profiles] = await Promise.all([listStoreAdmins(storeId), listProfilesForPicker()]);
  const existing = new Set(admins.map((a) => a.user_id));
  return profiles.filter((p) => !existing.has(p.id));
}

// Membership checks go through the SQL helpers so a page gate can never
// disagree with what RLS and the RPCs will accept.
export const isStoreAdmin = cache(async (storeId: string): Promise<boolean> => {
  const profile = await getProfile();
  if (profile?.is_admin) return true;
  if (!(await getUser())) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_store_admin", { p_store: storeId });
  return data === true;
});

export const isStoreOwner = cache(async (storeId: string): Promise<boolean> => {
  const profile = await getProfile();
  if (profile?.is_admin) return true;
  if (!(await getUser())) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_store_owner", { p_store: storeId });
  return data === true;
});

// Stores the current user is on the roster of (site admins are not
// expanded to every store: this feeds the user menu, /admin/stores already
// lists them all).
export const listMyStores = cache(async (): Promise<Store[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_admins")
    .select("store_id")
    .eq("user_id", user.id);
  const ids = ((data as { store_id: string }[] | null) ?? []).map((m) => m.store_id);
  if (ids.length === 0) return [];
  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .in("id", ids)
    .order("name", { ascending: true });
  return (stores as Store[] | null) ?? [];
});
