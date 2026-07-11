import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { getPlayersByIds } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import { formatDateTime } from "@/lib/format";
import { buildFilterHref } from "@/lib/filter-href";
import {
  computeCareerTotals,
  computeHeadToHead,
  computeLeagueHistory,
} from "@/lib/player-profile";
import {
  getPlayer,
  getPlayerMatchRecords,
  getLeagueConfigs,
  getArchetypeHistory,
} from "@/lib/player-profile-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const t = await getTranslations("playerProfile");
  const sp = await searchParams;
  const gameFilter = sp.game === "tcg" || sp.game === "vgc" ? sp.game : null;

  const [viewerProfile, allRecords] = await Promise.all([
    getProfile(),
    getPlayerMatchRecords(id),
  ]);
  const isOwner = viewerProfile != null && player.user_id === viewerProfile.id;
  const canSeePrivate = isOwner || !!viewerProfile?.is_admin;

  const allLeagueIds = [...new Set(allRecords.map((r) => r.leagueId))];
  const leagueConfigs = await getLeagueConfigs(allLeagueIds);

  const records = gameFilter
    ? allRecords.filter((r) => leagueConfigs.get(r.leagueId)?.game === gameFilter)
    : allRecords;

  const career = computeCareerTotals(records);
  const leagueHistory = computeLeagueHistory(records, leagueConfigs);
  const h2h = computeHeadToHead(records);

  const allArchetypeHistory = await getArchetypeHistory(id, canSeePrivate);
  const archetypeHistory = gameFilter
    ? allArchetypeHistory.filter((e) => e.game === gameFilter)
    : allArchetypeHistory;

  const opponentIds = h2h.map((r) => r.opponentId);
  const opponentNames = await getPlayersByIds(opponentIds);
  const nameOf = (pid: string) => {
    const p = opponentNames.get(pid);
    return p ? pairingName(p) : "—";
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {pairingName(player)}
        </h1>
        {(player.pokemon_id || player.game_id) && (
          <p className="text-sm text-muted-foreground">
            {[
              player.pokemon_id ? `${t("pokemonId")}: ${player.pokemon_id}` : null,
              player.game_id ? `${t("gameId")}: ${player.game_id}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {!player.user_id && (
          <Badge variant="secondary" className="w-fit">
            {t("managedBadge")}
          </Badge>
        )}
      </div>

      {/* Game filter */}
      {allLeagueIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {t("filterGameLabel")}
          </span>
          {(["", "tcg", "vgc"] as const).map((g) => (
            <Button
              key={g || "all"}
              asChild
              size="sm"
              variant={(gameFilter ?? "") === g ? "default" : "outline"}
            >
              <Link href={buildFilterHref(`/players/${id}`, sp, { game: g || undefined })}>
                {g ? g.toUpperCase() : t("filterAllGames")}
              </Link>
            </Button>
          ))}
        </div>
      )}

      {/* Career totals */}
      <Card>
        <CardHeader>
          <CardTitle>{t("careerTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={t("wins")} value={career.wins} />
            <Stat label={t("losses")} value={career.losses} />
            <Stat label={t("draws")} value={career.draws} />
            <Stat label={t("sessionsAttended")} value={career.sessionsAttended} />
          </div>
        </CardContent>
      </Card>

      {/* Per-league history */}
      <Card>
        <CardHeader>
          <CardTitle>{t("leaguesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {leagueHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLeagues")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {leagueHistory.map((row) => {
                const cfg = leagueConfigs.get(row.leagueId);
                return (
                  <li
                    key={row.leagueId}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Link
                      href={cfg ? `/leagues/${cfg.slug}` : "#"}
                      className="font-medium hover:text-primary"
                    >
                      {cfg?.name ?? "—"}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {t("recordLine", {
                        points: row.leaguePoints,
                        w: row.wins,
                        l: row.losses,
                        d: row.draws,
                        sessions: row.sessionsAttended,
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Archetype history */}
      <Card>
        <CardHeader>
          <CardTitle>{t("archetypesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {archetypeHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noArchetypes")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {archetypeHistory.map((entry) => (
                <li
                  key={entry.sessionId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="flex flex-col">
                    <Link
                      href={`/sessions/${entry.sessionId}`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {entry.leagueName}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(entry.startsAt) ?? "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {entry.chips.map((c) =>
                      c.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={c.key}
                          src={c.icon}
                          alt={c.name}
                          title={c.name}
                          className="h-6 w-6"
                        />
                      ) : (
                        <span
                          key={c.key}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs"
                        >
                          {c.name}
                        </span>
                      ),
                    )}
                    {!entry.isPublic && (
                      <Badge variant="outline">{t("privateBadge")}</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Head-to-head */}
      <Card>
        <CardHeader>
          <CardTitle>{t("h2hTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {h2h.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noH2h")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {h2h.map((row) => (
                <li
                  key={row.opponentId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <Link
                    href={`/players/${row.opponentId}`}
                    className="hover:text-primary"
                  >
                    {nameOf(row.opponentId)}
                  </Link>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {row.wins}-{row.losses}-{row.draws}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
