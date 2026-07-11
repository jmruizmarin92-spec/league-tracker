import type { StandingRow } from "@/lib/scoring";

export function StandingsTable({
  rows,
  names,
  labels,
}: {
  rows: StandingRow[];
  names: Map<string, string>;
  labels: {
    rank: string;
    player: string;
    points: string;
    record: string;
    buchholz: string;
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
            <th className="py-2 text-right font-medium">{labels.buchholz}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId} className="border-b last:border-0">
              <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                {r.rank}
              </td>
              <td className="py-2 pr-2">{names.get(r.playerId) ?? "—"}</td>
              <td className="py-2 pr-2 text-right font-medium tabular-nums">
                {r.points}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                {r.wins}-{r.losses}-{r.draws}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {r.buchholz}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
