import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SnakeGame } from "@/components/snake-game";

export default async function NoTocarPage() {
  const t = await getTranslations("snake");
  const tb = await getTranslations("breadcrumbs");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Breadcrumbs items={[{ label: tb("home"), href: "/" }, { label: t("title") }]} />
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <SnakeGame
        labels={{
          score: t("score"),
          start: t("start"),
          gameOver: t("gameOver"),
          restart: t("restart"),
          up: t("up"),
          down: t("down"),
          left: t("left"),
          right: t("right"),
        }}
      />
    </main>
  );
}
