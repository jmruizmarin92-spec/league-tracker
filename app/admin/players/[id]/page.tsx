import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { getPlayer } from "@/lib/player-profile-data";
import { updatePlayerAction } from "@/app/actions/players";
import { pairingName } from "@/lib/player-name";
import { PlayerFieldsForm } from "@/components/player-fields-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminEditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const t = await getTranslations("adminPlayers");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/players"
          className="w-fit text-sm text-muted-foreground hover:text-primary"
        >
          ← {t("title")}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {pairingName(player)}
          <Badge variant={player.user_id ? "default" : "secondary"}>
            {player.user_id ? t("badgeLinked") : t("badgeManaged")}
          </Badge>
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("editTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerFieldsForm
            action={updatePlayerAction}
            playerId={player.id}
            defaults={{
              display_name: player.display_name ?? "",
              first_name: player.first_name ?? "",
              last_name: player.last_name ?? "",
              pokemon_id: player.pokemon_id ?? "",
              game_id: player.game_id ?? "",
            }}
            labels={{
              alias: t("fieldAlias"),
              firstName: t("fieldFirstName"),
              lastName: t("fieldLastName"),
              pokemonId: t("fieldPokemonId"),
              gameId: t("fieldGameId"),
              save: t("save"),
              saved: t("saved"),
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
