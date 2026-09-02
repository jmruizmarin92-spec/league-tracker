// Guest decklist submission on standalone events (PL-19). Pure helpers shared
// by the server actions and the page, kept free of Supabase/server imports so
// they stay unit-testable. The SQL side (0048) applies the same ID rule.

// Play! Pokémon Player IDs are 1–10 digits. Whitespace is dropped so a pasted
// "123 456 7" still counts; anything else is rejected.
export const POKEMON_ID_RE = /^[0-9]{1,10}$/;

export function normalizePokemonId(raw: string): string {
  return raw.replace(/\s/g, "");
}

export function isValidPokemonId(raw: string): boolean {
  return POKEMON_ID_RE.test(normalizePokemonId(raw));
}

// The edit token the submit RPC returns: two v4 UUIDs without dashes.
export const GUEST_TOKEN_RE = /^[0-9a-f]{64}$/;

export function isGuestToken(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && GUEST_TOKEN_RE.test(raw);
}

// One cookie per event so a browser can hold entries for several events.
export function guestCookieName(eventId: string): string {
  return `event_guest_${eventId}`;
}

export const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 24 * 60 * 60; // 60 days

// Where the cookie is sent: only the event's own page.
export function guestCookiePath(slug: string): string {
  return `/events/${slug}`;
}

// The private link shown after submitting: same page plus the token.
export function guestEntryPath(slug: string, token: string): string {
  return `/events/${slug}?guest=${token}`;
}
