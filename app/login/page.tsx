import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  const t = await getTranslations("auth");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("loginTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
        </div>
        <GoogleSignInButton />
      </div>
    </main>
  );
}
