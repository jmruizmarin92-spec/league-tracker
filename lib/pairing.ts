// Pure Swiss pairing (no DB). Unit-tested in pairing.test.ts.

export type Pairing = { player1: string; player2: string | null }; // null = bye

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Official Play! Pokémon Swiss round count by attendance (upper bound → rounds).
const SWISS_ROUND_TABLE: [number, number][] = [
  [8, 3],
  [16, 4],
  [32, 5],
  [64, 6],
  [128, 7],
  [226, 8],
  [409, 9],
  [729, 10],
  [1338, 11],
  [2506, 12],
];

/**
 * Recommended total round count for a Swiss session, from player count.
 * Below the table's floor (4 players) there's no official guidance, so we
 * fall back to a full round-robin (n - 1); above its ceiling we extrapolate
 * with log2(n), since round counts roughly double the field each round.
 */
export function recommendedRoundCount(playerCount: number): number {
  if (playerCount <= 1) return 0;
  if (playerCount <= 3) return playerCount - 1;
  for (const [max, rounds] of SWISS_ROUND_TABLE) {
    if (playerCount <= max) return rounds;
  }
  return Math.ceil(Math.log2(playerCount)) + 4;
}

/**
 * Generate the next round's pairings.
 * @param ordered  Active player ids, best-standing first.
 * @param played   Set of pairKey()s already played this session.
 * @param hadBye   Player ids that already received a bye this session.
 * @returns        Pairings with the bye (if any) last, or `null` when no
 *                 rematch-free pairing exists — a matchup is never repeated
 *                 within a session, so the caller must block the round.
 *
 * Preference order is Swiss-style: pair from the top, each player with the
 * highest-ranked opponent they haven't met. Unlike a plain greedy pass, each
 * pick is checked against the rest of the field first, so the top pairs shift
 * when the bottom would otherwise be left with only a rematch (e.g. A,B,C,D
 * with C–D played: greedy gives A–B then a forced C–D; we give A–C, B–D).
 *
 * On an odd count, the bye goes to the lowest-ranked player without a prior
 * bye — but it climbs the standings (first among players without a bye, then
 * among those who already had one) if that is the only way to pair everyone
 * else fresh. The bye is returned last so it lands on the highest table number.
 */
export function generateSwissPairings(
  ordered: string[],
  played: Set<string> = new Set(),
  hadBye: Set<string> = new Set(),
): Pairing[] | null {
  if (ordered.length % 2 === 0) return matchFresh(ordered, played);

  // Odd field: try bye candidates bottom-up, bye-eligible players first.
  const byeOrder: number[] = [];
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (!hadBye.has(ordered[i])) byeOrder.push(i);
  }
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (hadBye.has(ordered[i])) byeOrder.push(i);
  }
  for (const byeIndex of byeOrder) {
    const rest = ordered.filter((_, i) => i !== byeIndex);
    const pairings = matchFresh(rest, played);
    if (pairings) {
      pairings.push({ player1: ordered[byeIndex], player2: null });
      return pairings;
    }
  }
  return null;
}

export type SeatedPairing = Pairing & { table: number | null }; // null = bye

/**
 * Re-pair a round whose pairings are published but not yet played, after the
 * roster changed (drops, late joiners), keeping as much of the posted pairing
 * as possible.
 * @param ordered   Active player ids, best-standing first — standings as they
 *                  were BEFORE this round (this round's matches excluded).
 * @param existing  The round's current pairings with their table numbers.
 * @param played    pairKey()s played in PREVIOUS rounds of the session.
 * @param hadBye    Players who had a bye in a PREVIOUS round.
 * @returns         The full new pairing for the round, seated, byes last — or
 *                  `null` when even a full re-pair admits no rematch-free
 *                  pairing (the caller leaves the round untouched).
 *
 * A table is "intact" when both its players are still active; intact tables
 * are kept, with their table numbers, as long as the rest can be paired. The
 * pool to re-pair is everyone active who is not at an intact table: orphans
 * whose opponent dropped, the bye holder (a bye is never intact — it is the
 * first thing to give up so an orphan gets a game), and players added since
 * the pairings went up. The pool is paired with the same rules as a fresh
 * round (`generateSwissPairings`: Swiss order, no rematch, bye to the lowest
 * player without one). When the pool alone cannot be paired fresh, the intact
 * table with the highest number (the lowest in the standings) is dissolved
 * into the pool and we try again, down to a full re-pair of the round.
 *
 * Seating: kept tables keep their numbers; new pairings take the freed numbers
 * in ascending order, then continue after the highest one; byes get none.
 */
export function repairSwissPairings(
  ordered: string[],
  existing: SeatedPairing[],
  played: Set<string> = new Set(),
  hadBye: Set<string> = new Set(),
): SeatedPairing[] | null {
  const active = new Set(ordered);
  const intact = existing
    .filter(
      (p) =>
        p.player2 !== null && active.has(p.player1) && active.has(p.player2),
    )
    .sort(byTable);

  // keep = how many intact tables survive, counted from table 1 downwards.
  for (let keep = intact.length; keep >= 0; keep--) {
    const kept = intact.slice(0, keep);
    const seated = new Set(kept.flatMap((p) => [p.player1, p.player2 as string]));
    const pool = ordered.filter((id) => !seated.has(id));
    const fresh = generateSwissPairings(pool, played, hadBye);
    if (!fresh) continue;

    const taken = new Set(
      kept.map((p) => p.table).filter((t): t is number => t !== null),
    );
    let next = 1;
    const nextFreeTable = () => {
      while (taken.has(next)) next++;
      taken.add(next);
      return next;
    };
    const out: SeatedPairing[] = [
      ...kept,
      ...fresh.map((p) => ({
        ...p,
        table: p.player2 === null ? null : nextFreeTable(),
      })),
    ];
    // A kept two-player table without a number (a bye filled by a late joiner
    // keeps the bye's null table) gets one now, after the new tables.
    for (const p of out) {
      if (p.player2 !== null && p.table === null) p.table = nextFreeTable();
    }
    return out.sort(byTable);
  }
  return null;
}

// Table order, byes (null) last.
function byTable(a: SeatedPairing, b: SeatedPairing): number {
  if (a.table === null) return b.table === null ? 0 : 1;
  if (b.table === null) return -1;
  return a.table - b.table;
}

/**
 * Perfect matching of an even pool with no repeated pairKey, preferring (in
 * top-down order) the nearest unplayed opponent for each player. Greedy with
 * lookahead: a pick is only committed if the players left over can still all
 * be paired fresh, so we never paint ourselves into a rematch. `null` if no
 * fresh perfect matching exists at all.
 */
function matchFresh(pool: string[], played: Set<string>): Pairing[] | null {
  // fresh[i][j]: i and j have not met.
  const fresh: boolean[][] = pool.map((a, i) =>
    pool.map((b, j) => i !== j && !played.has(pairKey(a, b))),
  );
  const remaining = pool.map((_, i) => i);
  if (!hasPerfectMatching(remaining, fresh)) return null;

  const out: Pairing[] = [];
  while (remaining.length > 0) {
    const i = remaining[0];
    let picked = -1;
    for (const j of remaining) {
      if (j === i || !fresh[i][j]) continue;
      const rest = remaining.filter((k) => k !== i && k !== j);
      if (hasPerfectMatching(rest, fresh)) {
        picked = j;
        break;
      }
    }
    // Unreachable: the pre-check above guarantees some pick keeps the rest
    // matchable. Kept as a guard so a bug here can never produce a rematch.
    if (picked === -1) return null;
    out.push({ player1: pool[i], player2: pool[picked] });
    remaining.splice(remaining.indexOf(picked), 1);
    remaining.shift();
  }
  return out;
}

/**
 * Does the graph induced by `nodes` (edges where `adj[a][b]`) have a perfect
 * matching? Edmonds' blossom algorithm for maximum matching in a general
 * graph — the "fresh opponents" graph is not bipartite, so a simpler
 * augmenting-path search would not be correct. O(V³), fine for a league.
 */
function hasPerfectMatching(nodes: number[], adj: boolean[][]): boolean {
  const n = nodes.length;
  if (n % 2 === 1) return false;
  if (n === 0) return true;

  // Work on local indices 0..n-1 mapped back through `nodes`.
  const edge = (a: number, b: number) => adj[nodes[a]][nodes[b]];
  const match: number[] = new Array(n).fill(-1);
  const parent: number[] = new Array(n).fill(-1);
  const base: number[] = new Array(n).fill(0);
  let queue: number[] = [];
  let inQueue: boolean[] = [];
  let inBlossom: boolean[] = [];

  const lca = (a: number, b: number): number => {
    const seen: boolean[] = new Array(n).fill(false);
    for (;;) {
      a = base[a];
      seen[a] = true;
      if (match[a] === -1) break;
      a = parent[match[a]];
    }
    for (;;) {
      b = base[b];
      if (seen[b]) return b;
      b = parent[match[b]];
    }
  };

  const markPath = (v: number, b: number, child: number) => {
    while (base[v] !== b) {
      inBlossom[base[v]] = true;
      inBlossom[base[match[v]]] = true;
      parent[v] = child;
      child = match[v];
      v = parent[match[v]];
    }
  };

  // BFS for an augmenting path from `root`; returns its free endpoint or -1.
  const findPath = (root: number): number => {
    inQueue = new Array(n).fill(false);
    parent.fill(-1);
    for (let i = 0; i < n; i++) base[i] = i;
    inQueue[root] = true;
    queue = [root];
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      for (let to = 0; to < n; to++) {
        if (!edge(v, to)) continue;
        if (base[v] === base[to] || match[v] === to) continue;
        if (
          to === root ||
          (match[to] !== -1 && parent[match[to]] !== -1)
        ) {
          // Odd cycle: contract the blossom.
          const cur = lca(v, to);
          inBlossom = new Array(n).fill(false);
          markPath(v, cur, to);
          markPath(to, cur, v);
          for (let i = 0; i < n; i++) {
            if (inBlossom[base[i]]) {
              base[i] = cur;
              if (!inQueue[i]) {
                inQueue[i] = true;
                queue.push(i);
              }
            }
          }
        } else if (parent[to] === -1) {
          parent[to] = v;
          if (match[to] === -1) return to;
          const next = match[to];
          inQueue[next] = true;
          queue.push(next);
        }
      }
    }
    return -1;
  };

  let matched = 0;
  for (let root = 0; root < n; root++) {
    if (match[root] !== -1) continue;
    let v = findPath(root);
    if (v === -1) continue;
    matched++;
    while (v !== -1) {
      const pv = parent[v];
      const ppv = match[pv];
      match[v] = pv;
      match[pv] = v;
      v = ppv;
    }
  }
  return matched * 2 === n;
}
