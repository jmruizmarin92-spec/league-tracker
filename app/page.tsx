import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Home() {
  const t = useTranslations("home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {t("badge")}
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <Button size="lg">{t("cta")}</Button>
    </main>
  );
}
