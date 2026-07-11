import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getUser, getProfile } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const user = await getUser();
  const profile = await getProfile();
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link href="/" className="truncate font-semibold tracking-tight">
            Liga Pokémon
          </Link>
          <Link
            href="/leagues"
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("leagues")}
          </Link>
          <Link
            href="/events"
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("events")}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {profile && user ? (
            <UserMenu
              name={profile.display_name}
              email={user.email ?? ""}
              avatarUrl={profile.avatar_url}
              isAdmin={profile.is_admin}
              labels={{
                profile: t("profile"),
                settings: t("settings"),
                signOut: t("signOut"),
                admin: t("admin"),
                adminArea: t("adminArea"),
                archetypes: t("archetypes"),
              }}
            />
          ) : (
            <Button asChild size="sm">
              <Link href="/login">{t("signIn")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
