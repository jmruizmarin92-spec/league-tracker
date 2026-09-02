// Which store a pasted Play! Pokémon page lands on (PL-16 / PL-17).
//
// On /admin/events the store is free: the page's League ID picks it among
// every store. On a store's own console the store is fixed, so the League ID
// can only confirm it or flag that the page belongs to somewhere else.

export type PasteStoreCandidate = { id: string; playLeagueId: string | null };

export type PasteStoreResolution =
  // No League ID on the page; nothing to match on.
  | { kind: "no-id" }
  // The League ID names one of the known stores.
  | { kind: "matched"; storeId: string }
  // Free mode: nobody carries that League ID.
  | { kind: "unknown"; playLeagueId: string }
  // Fixed mode: the page carries another store's League ID (or one nobody
  // has). The fixed store stays; the caller should say so.
  | { kind: "mismatch"; storeId: string; playLeagueId: string }
  // Fixed mode, store without a Play! id: nothing to compare, keep it.
  | { kind: "unverified"; storeId: string };

export function resolvePasteStore(
  stores: PasteStoreCandidate[],
  playLeagueId: string | null,
  fixedStoreId?: string,
): PasteStoreResolution {
  if (!playLeagueId) return { kind: "no-id" };
  if (fixedStoreId) {
    const fixed = stores.find((s) => s.id === fixedStoreId);
    if (!fixed?.playLeagueId) return { kind: "unverified", storeId: fixedStoreId };
    return fixed.playLeagueId === playLeagueId
      ? { kind: "matched", storeId: fixedStoreId }
      : { kind: "mismatch", storeId: fixedStoreId, playLeagueId };
  }
  const store = stores.find((s) => s.playLeagueId === playLeagueId);
  return store ? { kind: "matched", storeId: store.id } : { kind: "unknown", playLeagueId };
}
