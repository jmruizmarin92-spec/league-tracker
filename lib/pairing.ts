// Pure Swiss pairing (no DB). Unit-tested in pairing.test.ts.

export type Pairing = { player1: string; player2: string | null }; // null = bye

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Generate the next round's pairings.
 * @param ordered  Active player ids, best-standing first.
 * @param played   Set of pairKey()s already played (to avoid rematches).
 * @param hadBye   Player ids that already received a bye this session.
 *
 * Greedy: pair from the top, each player with the highest-ranked opponent they
 * haven't met; fall back to a rematch only if every remaining option was met.
 * On an odd count, the lowest-ranked player without a prior bye gets the bye.
 */
export function generateSwissPairings(
  ordered: string[],
  played: Set<string> = new Set(),
  hadBye: Set<string> = new Set(),
): Pairing[] {
  const pool = [...ordered];
  const pairings: Pairing[] = [];

  // Odd field → assign a bye to the lowest-ranked bye-eligible player.
  if (pool.length % 2 === 1) {
    let byeIndex = -1;
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!hadBye.has(pool[i])) {
        byeIndex = i;
        break;
      }
    }
    if (byeIndex === -1) byeIndex = pool.length - 1; // everyone had one; give it to last
    const [byePlayer] = pool.splice(byeIndex, 1);
    pairings.push({ player1: byePlayer, player2: null });
  }

  const used = new Array(pool.length).fill(false);

  for (let i = 0; i < pool.length; i++) {
    if (used[i]) continue;
    used[i] = true;

    // Prefer the nearest opponent not yet played.
    let opp = -1;
    for (let j = i + 1; j < pool.length; j++) {
      if (used[j]) continue;
      if (!played.has(pairKey(pool[i], pool[j]))) {
        opp = j;
        break;
      }
    }
    // Fallback: nearest available even if it's a rematch.
    if (opp === -1) {
      for (let j = i + 1; j < pool.length; j++) {
        if (!used[j]) {
          opp = j;
          break;
        }
      }
    }
    if (opp !== -1) {
      used[opp] = true;
      pairings.push({ player1: pool[i], player2: pool[opp] });
    }
  }

  return pairings;
}
