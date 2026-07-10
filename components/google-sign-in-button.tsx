"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const t = useTranslations("auth");
  const [loading, setLoading] = React.useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setLoading(false);
  }

  return (
    <Button onClick={signIn} disabled={loading} size="lg" className="w-full">
      {loading ? t("redirecting") : t("google")}
    </Button>
  );
}
