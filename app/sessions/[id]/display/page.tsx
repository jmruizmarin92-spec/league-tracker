import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { getSession, listParticipants } from "@/lib/sessions";
import { getRounds, getSessionMatches } from "@/lib/rounds";
import { computeStandings, type MatchInput } from "@/lib/scoring";
import { getPlayersByIds } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import { resolveArchetypes, type ArchetypeChip } from "@/lib/archetypes";
import { formatDateTime } from "@/lib/format";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { Badge } from "@/components/ui/badge";

export default async function SessionDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const t = await getTranslations("display");

  const [participants, rounds, matches] = await Promise.all([
    listParticipants(id),
    getRounds(id),
    getSessionMatches(id),
  ]);

  const registered = participants.filter((p) => p.status === "registered");
  const standingIds = [
    ...new Set([
      ...registered.map((p) => p.player_id),
      ...matches.flatMap(
        (m) => [m.player1_id, m.player2_id].filter(Boolean) as string[],
      ),
    ]),
  ];
  const standings = computeStandings(
    standingIds,
    matches.map<MatchInput>((m) => ({
      player1: m.player1_id,
      player2: m.player2_id,
      result: m.result,
    })),
  );
  const nameMap = await getPlayersByIds(standingIds);
  const name = (pid: string) => {
    const p = nameMap.get(pid);
    return p ? pairingName(p) : "—";
  };

  const chips = await resolveArchetypes(
    participants.flatMap((p) => [p.archetype1, p.archetype2]),
  );
  const publicArch = new Map<string, ArchetypeChip[]>();
  for (const p of participants) {
    if (!p.archetype_public) continue;
    const arr = [p.archetype1, p.archetype2]
      .filter((k): k is string => !!k)
      .map((k) => chips.get(k))
      .filter((c): c is ArchetypeChip => !!c);
    if (arr.length > 0) publicArch.set(p.player_id, arr);
  }

  const currentRound = rounds.at(-1);
  const currentMatches = currentRound
    ? matches.filter((m) => m.round_id === currentRound.id)
    : [];

  const title =
    session.name ?? formatDateTime(session.starts_at) ?? t("session");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 p-8">
      <RealtimeRefresher sessionId={id} />

      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex flex-col gap-1">
          {session.league && (
            <span className="text-xl text-muted-foreground">
              {session.league.name}
            </span>
          )}
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <span className="text-lg font-medium text-muted-foreground">
            {t("live")}
          </span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Current round pairings */}
        <section className="flex flex-col gap-4 lg:col-span-3">
          <h2 className="text-2xl font-semibold">
            {currentRound ? t("round", { n: currentRound.number }) : t("rounds")}
          </h2>
          {currentMatches.length === 0 ? (
            <p className="text-xl text-muted-foreground">{t("waitingRound")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {currentMatches.map((m) => {
                const decided =
                  m.result === "p1_win" ||
                  m.result === "p2_win" ||
                  m.result === "loss";
                const nameClass = (won: boolean) =>
                  won
                    ? "font-bold text-primary"
                    : decided
                      ? "text-muted-foreground"
                      : "font-medium";
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-5 py-4"
                  >
                    <span className="flex flex-wrap items-center gap-2 text-xl">
                      {m.table_number != null && (
                        <span className="mr-1 min-w-9 rounded-md bg-muted px-2 py-0.5 text-center text-base font-semibold tabular-nums text-muted-foreground">
                          {m.table_number}
                        </span>
                      )}
                      {m.result === "p1_win" && (
                        <Trophy className="h-5 w-5 text-primary" />
                      )}
                      <span className={nameClass(m.result === "p1_win")}>
                        {name(m.player1_id)}
                      </span>
                      {m.player2_id ? (
                        <>
                          <span className="text-muted-foreground">vs</span>
                          {m.result === "p2_win" && (
                            <Trophy className="h-5 w-5 text-primary" />
                          )}
                          <span className={nameClass(m.result === "p2_win")}>
                            {name(m.player2_id)}
                          </span>
                        </>
                      ) : m.result === "loss" ? (
                        <Badge variant="outline" className="text-base">
                          {t("loss")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-base">
                          {t("bye")}
                        </Badge>
                      )}
                      {m.result === "draw" && (
                        <Badge variant="outline" className="text-base">
                          {t("draw")}
                        </Badge>
                      )}
                    </span>
                    {m.result === "pending" && (
                      <Badge variant="secondary" className="text-base">
                        {t("pending")}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Standings */}
        <section className="flex flex-col gap-4 lg:col-span-2">
          <h2 className="text-2xl font-semibold">{t("standings")}</h2>
          {standings.length === 0 ? (
            <p className="text-xl text-muted-foreground">{t("noStandings")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-lg">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="py-3 pl-4 pr-2 font-medium">{t("rank")}</th>
                    <th className="py-3 pr-2 font-medium">{t("player")}</th>
                    <th className="py-3 pr-2 text-right font-medium">
                      {t("points")}
                    </th>
                    <th className="py-3 pr-4 text-right font-medium">
                      {t("record")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((r) => (
                    <tr key={r.playerId} className="border-b last:border-0">
                      <td className="py-3 pl-4 pr-2 tabular-nums text-muted-foreground">
                        {r.rank}
                      </td>
                      <td className="py-3 pr-2">
                        <span className="flex items-center gap-2">
                          {name(r.playerId)}
                          {publicArch.get(r.playerId)?.map((c) =>
                            c.icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={c.key}
                                src={c.icon}
                                alt={c.name}
                                title={c.name}
                                className="h-6 w-6"
                              />
                            ) : null,
                          )}
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-right font-bold tabular-nums">
                        {r.points}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                        {r.wins}-{r.losses}-{r.draws}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
