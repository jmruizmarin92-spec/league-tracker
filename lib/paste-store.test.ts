import { describe, expect, it } from "vitest";
import { resolvePasteStore } from "./paste-store";

const stores = [
  { id: "lotus", playLeagueId: "6236068" },
  { id: "dune", playLeagueId: "7000001" },
  { id: "noid", playLeagueId: null },
];

describe("resolvePasteStore — free store (site admin)", () => {
  it("matches the store carrying the League ID", () => {
    expect(resolvePasteStore(stores, "6236068")).toEqual({ kind: "matched", storeId: "lotus" });
  });

  it("reports an unknown League ID", () => {
    expect(resolvePasteStore(stores, "1")).toEqual({ kind: "unknown", playLeagueId: "1" });
  });

  it("has nothing to do without a League ID", () => {
    expect(resolvePasteStore(stores, null)).toEqual({ kind: "no-id" });
    expect(resolvePasteStore(stores, "")).toEqual({ kind: "no-id" });
  });
});

describe("resolvePasteStore — fixed store (store console)", () => {
  it("confirms the fixed store when the League ID is its own", () => {
    expect(resolvePasteStore(stores, "6236068", "lotus")).toEqual({
      kind: "matched",
      storeId: "lotus",
    });
  });

  it("flags another store's League ID and keeps the fixed store", () => {
    expect(resolvePasteStore(stores, "7000001", "lotus")).toEqual({
      kind: "mismatch",
      storeId: "lotus",
      playLeagueId: "7000001",
    });
  });

  it("flags a League ID nobody has the same way", () => {
    expect(resolvePasteStore(stores, "42", "lotus")).toEqual({
      kind: "mismatch",
      storeId: "lotus",
      playLeagueId: "42",
    });
  });

  it("cannot verify a store without a Play! id and keeps it", () => {
    expect(resolvePasteStore(stores, "6236068", "noid")).toEqual({
      kind: "unverified",
      storeId: "noid",
    });
  });

  it("still has nothing to do without a League ID", () => {
    expect(resolvePasteStore(stores, null, "lotus")).toEqual({ kind: "no-id" });
  });
});
