import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";

export default async function MePage() {
  await requireUser();
  const t = await getTranslations("placeholder");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("profileTitle")}
      </h1>
      <p className="text-muted-foreground">{t("soon")}</p>
    </main>
  );
}
