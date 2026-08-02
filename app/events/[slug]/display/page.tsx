import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { getEventBySlug, listRegistrations } from "@/lib/events";
import {
  getEventRounds,
  getEventMatches,
  getEventStandings,
  type EventMatchRow,
  type EventRoundRow,
} from "@/lib/event-rounds";
import { computeStandings, type MatchInput } from "@/lib/scoring";
import { getPlayersByIds } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import { divisionLabel } from "@/lib/tdf";
import { resolveArchetypes, type ArchetypeChip } from "@/lib/archetypes";
import { formatDateTime } from "@/lib/format";
import { EventRealtimeRefresher } from "@/components/event-realtime-refresher";
import { Badge } from "@/components/ui/badge";

// Venue projector view for a TOM-imported event: the current round's pairings
// big enough to read across a hall, standings beside them, nothing to click.
// Twin of the session display, minus the round clock — TOM runs its own.
export default async function EventDisplayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const t = await getTranslations("display");
  const tt = await getTranslations("eventTom");

  const [rounds, matches, places, regs] = await Promise.all([
    getEventRounds(event.id),
    getEventMatches(event.id),
    getEventStandings(event.id),
    listRegistrations(event.id),
  ]);

  const playerIds = [
    ...new Set([
      ...regs.map((r) => r.player_id),
      ...matches.flatMap((m) =>
        [m.player1_id, m.player2_id].filter((id): id is string => !!id),
      ),
    ]),
  ];
  const nameMap = await getPlayersByIds(playerIds);
  const name = (pid: string) => {
    const p = nameMap.get(pid);
    return p ? pairingName(p) : "—";
  };

  const chips = await resolveArchetypes(
    regs.flatMap((r) => [r.archetype1, r.archetype2]),
  );
  const publicArch = new Map<string, ArchetypeChip[]>();
  for (const r of regs) {
    if (!r.archetype_public) continue;
    const arr = [r.archetype1, r.archetype2]
      .filter((k): k is string => !!k)
      .map((k) => chips.get(k))
      .filter((c): c is ArchetypeChip => !!c);
    if (arr.length > 0) publicArch.set(r.player_id, arr);
  }

  const matchesOf = (roundId: string) =>
    matches.filter((m) => m.round_id === roundId);

  const roundName = (r: EventRoundRow) => {
    if (!r.is_finals) return t("round", { n: r.number });
    const n = matchesOf(r.id).length;
    if (n <= 1) return tt("finalLabel");
    if (n === 2) return tt("semifinalLabel");
    if (n === 4) return tt("quarterfinalLabel");
    return tt("topLabel", { n: n * 2 });
  };

  // One current round per age division — they run as parallel tournaments, and
  // the hall needs to see all of them at once.
  const divisions = [...new Set(rounds.map((r) => r.division))].sort(
    (a, b) => a - b,
  );
  const current = divisions
    .map((division) => {
      const round = rounds.filter((r) => r.division === division).at(-1);
      return round
        ? { division, round, matches: matchesOf(round.id) }
        : null;
    })
    .filter((d) => d !== null);

  // Official placings once TOM closes the event, otherwise the running table.
  const officialByDivision = new Map<
    number,
    { place: number; playerId: string }[]
  >();
  for (const p of places) {
    const list = officialByDivision.get(p.division) ?? [];
    list.push({ place: p.place, playerId: p.player_id });
    officialByDivision.set(p.division, list);
  }
  const hasOfficial = places.length > 0;

  const provisional = divisions.map((division) => {
    const rows = rounds
      .filter((r) => r.division === division)
      .flatMap((r) => matchesOf(r.id));
    const ids = [
      ...new Set(
        rows.flatMap((m) =>
          [m.player1_id, m.player2_id].filter((x): x is string => !!x),
        ),
      ),
    ];
    const inputs: MatchInput[] = rows.flatMap((m: EventMatchRow): MatchInput[] => {
      if (m.official_result === "double_loss") {
        return [
          { player1: m.player1_id, player2: null, result: "loss" },
          ...(m.player2_id
            ? [{ player1: m.player2_id, player2: null, result: "loss" as const }]
            : []),
        ];
      }
      return [
        { player1: m.player1_id, player2: m.player2_id, result: m.official_result },
      ];
    });
    return { division, rows: computeStandings(ids, inputs) };
  });

  const multi = divisions.length > 1;
  const title = event.name;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 p-8">
      {event.status !== "complete" && <EventRealtimeRefresher eventId={event.id} />}

      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex flex-col gap-1">
          <span className="text-xl text-muted-foreground">
            {formatDateTime(event.starts_at) ?? event.location ?? ""}
          </span>
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
        {/* Current pairings */}
        <section className="flex flex-col gap-6 lg:col-span-3">
          {current.length === 0 ? (
            <>
              <h2 className="text-2xl font-semibold">{t("rounds")}</h2>
              <p className="text-xl text-muted-foreground">{tt("noPairings")}</p>
            </>
          ) : (
            current.map((d) => (
              <div key={d.division} className="flex flex-col gap-4">
                <h2 className="text-2xl font-semibold">
                  {multi
                    ? `${divisionLabel(d.division)} · ${roundName(d.round)}`
                    : roundName(d.round)}
                </h2>
                <ul className="flex flex-col gap-2">
                  {d.matches.map((m) => {
                    const decided =
                      m.official_result === "p1_win" ||
                      m.official_result === "p2_win" ||
                      m.official_result === "double_loss";
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
                          {m.official_result === "p1_win" && (
                            <Trophy className="h-5 w-5 text-primary" />
                          )}
                          <span
                            className={`min-w-0 flex-1 truncate ${nameClass(m.official_result === "p1_win")}`}
                            title={name(m.player1_id)}
                          >
                            {name(m.player1_id)}
                          </span>
                          {m.player2_id ? (
                            <>
                              <span className="text-muted-foreground">
                                {tt("vs")}
                              </span>
                              {m.official_result === "p2_win" && (
                                <Trophy className="h-5 w-5 text-primary" />
                              )}
                              <span
                                className={`min-w-0 flex-1 truncate ${nameClass(m.official_result === "p2_win")}`}
                                title={name(m.player2_id)}
                              >
                                {name(m.player2_id)}
                              </span>
                            </>
                          ) : (
                            <Badge variant="secondary" className="text-base">
                              {tt("bye")}
                            </Badge>
                          )}
                          {m.official_result === "draw" && (
                            <Badge variant="outline" className="text-base">
                              {tt("draw")}
                            </Badge>
                          )}
                          {m.official_result === "double_loss" && (
                            <Badge variant="outline" className="text-base">
                              {tt("doubleLoss")}
                            </Badge>
                          )}
                        </span>
                        {m.official_result === "pending" && (
                          <Badge variant="secondary" className="text-base">
                            {t("pending")}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* Standings */}
        <section className="flex flex-col gap-6 lg:col-span-2">
          <h2 className="text-2xl font-semibold">
            {hasOfficial ? tt("finalStandingsTitle") : t("standings")}
          </h2>

          {hasOfficial
            ? divisions.map((division) => {
                const rows = officialByDivision.get(division) ?? [];
                if (rows.length === 0) return null;
                return (
                  <div key={division} className="flex flex-col gap-2">
                    {multi && (
                      <span className="text-lg font-medium text-muted-foreground">
                        {divisionLabel(division)}
                      </span>
                    )}
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-lg">
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.place} className="border-b last:border-0">
                              <td className="w-12 py-3 pl-4 pr-2 text-right tabular-nums text-muted-foreground">
                                {r.place}
                              </td>
                              <td
                                className={`py-3 pr-4 ${r.place === 1 ? "font-bold" : ""}`}
                              >
                                {name(r.playerId)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            : provisional.map((d) =>
                d.rows.length === 0 ? null : (
                  <div key={d.division} className="flex flex-col gap-2">
                    {multi && (
                      <span className="text-lg font-medium text-muted-foreground">
                        {divisionLabel(d.division)}
                      </span>
                    )}
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-lg">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                            <th className="py-3 pl-4 pr-2 font-medium">
                              {t("rank")}
                            </th>
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
                          {d.rows.map((r) => (
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
                  </div>
                ),
              )}

          {!hasOfficial && provisional.every((d) => d.rows.length === 0) && (
            <p className="text-xl text-muted-foreground">{t("noStandings")}</p>
          )}
        </section>
      </div>
    </main>
  );
}
