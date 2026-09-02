import { describe, expect, it } from "vitest";
import {
  guestCookieName,
  guestCookiePath,
  guestEntryPath,
  isGuestToken,
  isValidPokemonId,
  normalizePokemonId,
} from "./event-guest";

describe("Pokémon ID", () => {
  it("accepts 1 to 10 digits", () => {
    expect(isValidPokemonId("1")).toBe(true);
    expect(isValidPokemonId("6054871")).toBe(true);
    expect(isValidPokemonId("1234567890")).toBe(true);
  });

  it("drops whitespace before validating", () => {
    expect(normalizePokemonId(" 605 4871 ")).toBe("6054871");
    expect(isValidPokemonId(" 605 4871 ")).toBe(true);
  });

  it("rejects empty, letters, symbols and more than 10 digits", () => {
    expect(isValidPokemonId("")).toBe(false);
    expect(isValidPokemonId("   ")).toBe(false);
    expect(isValidPokemonId("abc123")).toBe(false);
    expect(isValidPokemonId("123-456")).toBe(false);
    expect(isValidPokemonId("12345678901")).toBe(false);
  });
});

describe("guest token", () => {
  const token = "a".repeat(32) + "0123456789abcdef0123456789abcdef";

  it("is exactly 64 lowercase hex chars", () => {
    expect(isGuestToken(token)).toBe(true);
    expect(isGuestToken(token.toUpperCase())).toBe(false);
    expect(isGuestToken(token.slice(1))).toBe(false);
    expect(isGuestToken(token + "0")).toBe(false);
    expect(isGuestToken("g".repeat(64))).toBe(false);
  });

  it("rejects missing values", () => {
    expect(isGuestToken(null)).toBe(false);
    expect(isGuestToken(undefined)).toBe(false);
    expect(isGuestToken("")).toBe(false);
  });
});

describe("cookie and link helpers", () => {
  it("scopes the cookie to the event", () => {
    expect(guestCookieName("ev-1")).toBe("event_guest_ev-1");
    expect(guestCookiePath("cup-granada")).toBe("/events/cup-granada");
  });

  it("builds the private link on the event page", () => {
    expect(guestEntryPath("cup-granada", "abc")).toBe("/events/cup-granada?guest=abc");
  });
});
