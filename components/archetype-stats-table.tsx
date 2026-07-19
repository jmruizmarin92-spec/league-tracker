import type { ArchetypeStatRow, EventArchetypeStatRow } from "@/lib/archetype-standings";

type Props =
  | {
      showRecord?: true;
      rows: ArchetypeStatRow[];
      labels: {
        empty: string;
        archetype: string;
        players: string;
        games: string;
        record: string;
        winRate: string;
      };
    }
  | {
      showRecord: false;
      rows: EventArchetypeStatRow[];
      labels: {
        empty: string;
        archetype: string;
        players: string;
        percentage: string;
      };
    };

export function ArchetypeStatsTable(props: Props) {
  const { rows, labels } = props;

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-2 font-medium">{labels.archetype}</th>
            <th className="py-2 pr-2 text-right font-medium">
              {labels.players}
            </th>
            {props.showRecord !== false ? (
              <>
                <th className="py-2 pr-2 text-right font-medium">
                  {props.labels.games}
                </th>
                <th className="py-2 pr-2 text-right font-medium">
                  {props.labels.record}
                </th>
                <th className="py-2 text-right font-medium">
                  {props.labels.winRate}
                </th>
              </>
            ) : (
              <th className="py-2 text-right font-medium">
                {props.labels.percentage}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {props.showRecord !== false
            ? props.rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-1.5">
                      {r.chip?.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.chip.icon} alt="" className="h-6 w-6" />
                      )}
                      <span className="truncate">{r.chip?.name ?? r.key}</span>
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                    {r.players}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                    {r.games}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                    {r.wins}-{r.losses}-{r.draws}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {(r.winRate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))
            : props.rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-1.5">
                      {r.chip?.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.chip.icon} alt="" className="h-6 w-6" />
                      )}
                      <span className="truncate">{r.chip?.name ?? r.key}</span>
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                    {r.players}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {(r.percentage * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
