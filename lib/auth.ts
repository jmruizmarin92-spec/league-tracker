import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_admin: boolean;
};

// Current authenticated user (or null). Memoized per request render.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Current user's profile row (or null if logged out / not yet provisioned).
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, is_admin")
    .eq("id", user.id)
    .single();

  return data;
});

// Redirect to /login if not authenticated.
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Redirect unless the user is a site admin.
export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) redirect("/");
  return profile;
}
