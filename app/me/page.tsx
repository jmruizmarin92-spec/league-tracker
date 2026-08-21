import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getMyPlayer, getMyClaims, listUnclaimedPlayers } from "@/lib/players";
import { requestClaimAction, updateMyPlayerAction } from "@/app/actions/players";
import { saveDeckAction, deleteDeckAction } from "@/app/actions/decks";
import { listMyDecks } from "@/lib/decks";
import { listCustoms } from "@/lib/archetypes";
import { pairingName } from "@/lib/player-name";
import { PlayerFieldsForm } from "@/components/player-fields-form";
import { SavedDecksManager } from "@/components/saved-decks-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MePage() {
  await requireUser();
  const t = await getTranslations("me");

  const [player, myClaims, decks, customsAll] = await Promise.all([
    getMyPlayer(),
    getMyClaims(),
    listMyDecks(),
    listCustoms(),
  ]);
  const activeCustoms = customsAll
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, game: c.game, name: c.name, icon_url: c.icon_url }));

  const pendingClaims = myClaims.filter((c) => c.status === "pending");
  const unclaimed = player ? [] : await listUnclaimedPlayers();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {player && (
          <p className="text-sm text-muted-foreground">
            {t("pairingPreview")}{" "}
            <span className="font-medium text-foreground">
              {pairingName(player)}
            </span>
          </p>
        )}
        {player && (
          <Link
            href={`/players/${player.id}`}
            className="w-fit text-sm text-primary hover:underline"
          >
            {t("viewPublicProfile")}
          </Link>
        )}
      </div>

      {/* Profile fields */}
      {player && (
        <Card>
          <CardHeader>
            <CardTitle>{t("editTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerFieldsForm
              action={updateMyPlayerAction}
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
      )}

      {/* Saved decks (PL-3): the combos offered as chips in the session/event
          picker. Sessions/events add to this list automatically on save. */}
      {player && (
        <Card>
          <CardHeader>
            <CardTitle>{t("decksTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("decksDesc")}</p>
            <SavedDecksManager
              decks={decks.map((d) => ({ id: d.id, game: d.game, chips: d.chips }))}
              customs={activeCustoms}
              saveAction={saveDeckAction}
              deleteAction={deleteDeckAction}
              labels={{
                games: { tcg: t("decksTcg"), vgc: t("decksVgc") },
                none: t("decksNone"),
                slot1: t("deckSlot1"),
                slot2: t("deckSlot2"),
                placeholder: t("deckPlaceholder"),
                search: t("deckSearch"),
                clear: t("deckClear"),
                noResults: t("deckNoResults"),
                add: t("deckAdd"),
                added: t("deckAdded"),
                delete: t("deckDelete"),
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Link an admin-created managed player (dedup) — only relevant before
          the account has one; afterwards, admins merge duplicates manually. */}
      {!player && (
        <Card>
          <CardHeader>
            <CardTitle>{t("claimTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("claimDesc")}</p>

            {pendingClaims.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <span className="text-sm font-medium">{t("pendingTitle")}</span>
                {pendingClaims.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm">{c.player_name ?? "—"}</span>
                    <Badge variant="secondary">{t("statusPending")}</Badge>
                  </div>
                ))}
              </div>
            )}

            {unclaimed.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noUnclaimed")}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {unclaimed.map((p) => {
                  const alreadyRequested = pendingClaims.some(
                    (c) => c.player_id === p.id,
                  );
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span>{p.display_name}</span>
                      <form action={requestClaimAction}>
                        <input type="hidden" name="player_id" value={p.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={alreadyRequested}
                        >
                          {alreadyRequested ? t("statusPending") : t("claimCta")}
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
