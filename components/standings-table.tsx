import Link from "next/link";
import type { StandingRow } from "@/lib/scoring";

type Chip = { key: string; name: string; icon: string | null };

export function StandingsTable({
  rows,
  names,
  archetypes,
  labels,
}: {
  rows: StandingRow[];
  names: Map<string, string>;
  archetypes?: Map<string, Chip[]>;
  labels: {
    rank: string;
    player: string;
    points: string;
    record: string;
    oppWinRate: string;
  };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-2 font-medium">{labels.rank}</th>
            <th className="py-2 pr-2 font-medium">{labels.player}</th>
            <th className="py-2 pr-2 text-right font-medium">{labels.points}</th>
            <th className="py-2 pr-2 text-right font-medium">{labels.record}</th>
            <th className="py-2 text-right font-medium">
              {labels.oppWinRate}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId} className="border-b last:border-0">
              <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                {r.rank}
              </td>
              <td className="py-2 pr-2">
                <span className="flex items-center gap-1.5">
                  <Link
                    href={`/players/${r.playerId}`}
                    className="hover:text-primary hover:underline"
                  >
                    {names.get(r.playerId) ?? "—"}
                  </Link>
                  {archetypes?.get(r.playerId)?.map((c) =>
                    c.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={c.key}
                        src={c.icon}
                        alt={c.name}
                        title={c.name}
                        className="h-5 w-5"
                      />
                    ) : null,
                  )}
                </span>
              </td>
              <td className="py-2 pr-2 text-right font-medium tabular-nums">
                {r.points}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                {r.wins}-{r.losses}-{r.draws}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {(r.oppWinRate * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
