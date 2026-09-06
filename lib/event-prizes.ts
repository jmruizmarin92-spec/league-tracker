// Prize budget of a standalone event (PL-29): what the entry fees bring in,
// what the venue, the judge, the entry packs and any fixed cost take out, and
// how the rest is split across the top cut in whole units — whole packs or
// whole euros, never a fraction. Pure: the page feeds it the player count
// (players imported from TOM) and the saved budget; the client form runs it
// live as the TO types.

export type PrizeKind = "packs" | "cash";

export type PrizeBudgetInput = {
  players: number;
  // Entry fee per player (events.cost).
  entryFee: number;
  // Per player, kept by the venue / paid to the judge.
  venueFee: number;
  judgeFee: number;
  // Every player gets a pack at registration, worth packValue each.
  entryPack: boolean;
  // Cost of one pack — also the unit of a prize handed out in packs.
  packValue: number;
  // Fixed costs of the event (materials, side prizes...).
  extraCosts: number;
  prizeKind: PrizeKind;
  topCut: number;
  // One weight per placing (percentages in practice; any positive numbers
  // work, they are normalised). Missing entries count as 0.
  shares: number[];
};

export type PrizeAward = {
  place: number;
  // Share of the pot as a percentage, after normalisation.
  share: number;
  // Whole packs or whole euros.
  amount: number;
};

export type PrizeBudgetResult = {
  players: number;
  gross: number;
  venueTotal: number;
  judgeTotal: number;
  entryPacksCount: number;
  entryPacksCost: number;
  extraCosts: number;
  // Euros left for the top cut once everything above is taken out. Negative
  // means the entry fees do not even cover the costs.
  remaining: number;
  // Whole units available to the top cut: packs (remaining ÷ packValue) or
  // euros, floored.
  potUnits: number;
  // Euros that the whole-unit rule leaves undistributed (negative when the
  // budget is in deficit — then it is the deficit itself).
  leftover: number;
  awards: PrizeAward[];
};

export const TOP_CUT_SIZES = [2, 4, 8, 16] as const;

// Default percentage per placing for the usual cut sizes. Each row sums to
// 100 so the numbers read as percentages in the form.
export const TOP_CUT_PRESETS: Record<number, number[]> = {
  2: [60, 40],
  4: [40, 30, 15, 15],
  8: [28, 20, 12, 12, 7, 7, 7, 7],
  16: [20, 14, 9, 9, 6, 6, 6, 6, 3, 3, 3, 3, 3, 3, 3, 3],
};

export const DEFAULT_TOP_CUT = 8;
export const MAX_TOP_CUT = 64;

export function isPrizeKind(value: string): value is PrizeKind {
  return value === "packs" || value === "cash";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Splits `total` whole units across `weights` so the parts are integers that
// add up to exactly `total`: floor of the exact share first, then the units
// lost to flooring go to the largest fractional remainders, earlier placings
// winning ties. Non-positive or missing weights get nothing; if every weight
// is non-positive the units are shared equally.
export function splitWhole(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const units = Math.max(0, Math.floor(total));
  let w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  let sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    w = weights.map(() => 1);
    sum = n;
  }
  const exact = w.map((x) => (units * x) / sum);
  const parts = exact.map((x) => Math.floor(x + 1e-9));
  let left = units - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

// Shares for a cut size: the preset when there is one, otherwise a
// descending harmonic split (1, 1/2, 1/3…) rounded to whole percentages.
export function defaultShares(topCut: number): number[] {
  const n = Math.min(MAX_TOP_CUT, Math.max(1, Math.floor(topCut || 1)));
  const preset = TOP_CUT_PRESETS[n];
  if (preset) return [...preset];
  return splitWhole(
    100,
    Array.from({ length: n }, (_, i) => 1 / (i + 1)),
  );
}

export function computePrizeBudget(input: PrizeBudgetInput): PrizeBudgetResult {
  const players = Math.max(0, Math.floor(input.players || 0));
  const fee = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);
  const gross = round2(players * fee(input.entryFee));
  const venueTotal = round2(players * fee(input.venueFee));
  const judgeTotal = round2(players * fee(input.judgeFee));
  const packValue = fee(input.packValue);
  const entryPacksCount = input.entryPack ? players : 0;
  const entryPacksCost = round2(entryPacksCount * packValue);
  const extraCosts = round2(fee(input.extraCosts));
  const remaining = round2(gross - venueTotal - judgeTotal - entryPacksCost - extraCosts);

  const unitValue = input.prizeKind === "packs" ? packValue : 1;
  const potUnits =
    remaining > 0 && unitValue > 0 ? Math.floor(remaining / unitValue + 1e-9) : 0;
  const leftover = round2(remaining - potUnits * unitValue);

  const topCut = Math.min(MAX_TOP_CUT, Math.max(1, Math.floor(input.topCut || 1)));
  const weights = Array.from({ length: topCut }, (_, i) => input.shares[i] ?? 0);
  const amounts = splitWhole(potUnits, weights);
  const positive = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const wsum = positive.reduce((a, b) => a + b, 0);
  const awards = amounts.map((amount, i) => ({
    place: i + 1,
    share: wsum > 0 ? round2((positive[i] / wsum) * 100) : round2(100 / topCut),
    amount,
  }));

  return {
    players,
    gross,
    venueTotal,
    judgeTotal,
    entryPacksCount,
    entryPacksCost,
    extraCosts,
    remaining,
    potUnits,
    leftover,
    awards,
  };
}

export type PrizeSummaryLabels = {
  // "sobre" / "sobres"
  packOne: string;
  packMany: string;
  // "€ en tienda"
  cashUnit: string;
  // Line printed when every player gets an entry pack.
  entryPackLine: string;
};

// The player-facing text the TO publishes into events.prizes: one line per
// placing with a prize, plus the entry-pack line. Empty when nothing is
// handed out.
export function prizeSummaryText(
  result: PrizeBudgetResult,
  prizeKind: PrizeKind,
  labels: PrizeSummaryLabels,
): string {
  const lines: string[] = [];
  for (const a of result.awards) {
    if (a.amount <= 0) continue;
    const unit =
      prizeKind === "packs"
        ? a.amount === 1
          ? labels.packOne
          : labels.packMany
        : labels.cashUnit;
    lines.push(`${a.place}º: ${a.amount} ${unit}`);
  }
  if (result.entryPacksCount > 0) lines.push(labels.entryPackLine);
  return lines.join("\n");
}
