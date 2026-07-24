import type { LeagueStandingRow } from "@/lib/league-standings";

// Prize pool pooling: every N total session-attendances (played >= 1 round,
// same definition as the league attendance point) within a scope adds 1 pack
// to that scope's pool. Quarter and year are two independently-sized scopes.
export const QUARTER_POOL_SIZE = 5;
export const YEAR_POOL_SIZE = 10;

export function computePrizePool(
  rows: LeagueStandingRow[],
  perPlayers: number,
): number {
  const totalAttendance = rows.reduce((sum, r) => sum + r.attended, 0);
  return Math.floor(totalAttendance / perPlayers);
}
