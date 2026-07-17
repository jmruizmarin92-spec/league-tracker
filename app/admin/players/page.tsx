import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { listPlayers, listPendingClaims } from "@/lib/players";
import {
  createManagedPlayerAction,
  approveClaimAction,
  rejectClaimAction,
  deletePlayerAction,
} from "@/app/actions/players";
import { PlayerNameForm } from "@/components/player-name-form";
import { MergePlayersForm } from "@/components/merge-players-form";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminPlayersPage() {
  await requireAdmin();
  const t = await getTranslations("adminPlayers");

  const [players, pending] = await Promise.all([
    listPlayers(),
    listPendingClaims(),
  ]);

  const mergeOptions = players.map((p) => ({
    id: p.id,
    label: p.user_id ? `${p.display_name} ✓` : p.display_name,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      {/* Pending claims */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pendingTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPending")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {pending.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm">
                    <span className="font-medium">{c.requester_name}</span>{" "}
                    {t("wantsToClaim")}{" "}
                    <span className="font-medium">{c.player_name ?? "—"}</span>
                  </span>
                  <div className="flex gap-2">
                    <form action={approveClaimAction}>
                      <input type="hidden" name="claim_id" value={c.id} />
                      <Button type="submit" size="sm">
                        {t("approve")}
                      </Button>
                    </form>
                    <form action={rejectClaimAction}>
                      <input type="hidden" name="claim_id" value={c.id} />
                      <Button type="submit" size="sm" variant="outline">
                        {t("reject")}
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create managed player */}
      <Card>
        <CardHeader>
          <CardTitle>{t("createManagedTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {t("createManagedDesc")}
          </p>
          <PlayerNameForm
            action={createManagedPlayerAction}
            placeholder={t("namePlaceholder")}
            submitLabel={t("createManagedCta")}
            successLabel={t("createManagedSuccess")}
          />
        </CardContent>
      </Card>

      {/* All players */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("allPlayersTitle")} ({players.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPlayers")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{p.display_name}</span>
                    <Badge variant={p.user_id ? "default" : "secondary"}>
                      {p.user_id ? t("badgeLinked") : t("badgeManaged")}
                    </Badge>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/players/${p.id}`}>{t("edit")}</Link>
                    </Button>
                    {!p.user_id && (
                      <form action={deletePlayerAction}>
                        <input type="hidden" name="player_id" value={p.id} />
                        <ConfirmDeleteButton
                          confirmMessage={t("confirmDeletePlayer", {
                            name: p.display_name,
                          })}
                        >
                          {t("delete")}
                        </ConfirmDeleteButton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Merge */}
      {players.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("mergeTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("mergeDesc")}</p>
            <MergePlayersForm
              players={mergeOptions}
              labels={{
                from: t("mergeFrom"),
                into: t("mergeInto"),
                cta: t("mergeCta"),
                fromPlaceholder: t("mergeFromPlaceholder"),
                intoPlaceholder: t("mergeIntoPlaceholder"),
                success: t("mergeSuccess"),
              }}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
