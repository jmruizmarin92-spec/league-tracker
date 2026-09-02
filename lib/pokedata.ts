// pokedata.ovh events API (PL-21): a JSON mirror of the official Play!
// Pokémon event locator. One GET returns every announced League Cup /
// League Challenge in a zone and date window, which is how the import page
// on /admin/events/import finds the events of our area instead of pasting
// each tournament page by hand (PL-16).
//
//   https://pokedata.ovh/events/api/help
//   …/api/_tcg/cups/challenges/_vg/cups/challenges
//        /_latitude/37.1773/_longitude/-3.5986/_radius/30/_unit/km
//        /_start/2026-09-01/_end/2026-12-31/
//
// Everything below `fetchPokedataEvents` is pure and unit-tested in
// pokedata.test.ts against a verbatim record of the API.

import { composeEventName, categoryFromType } from "./play-event-paste";
import type { Category } from "./event-category";
import type { Game } from "./league-format";
import { TZ } from "./format";

export const POKEDATA_BASE = "https://pokedata.ovh/events/api";

// Granada city and its belt (~30 km): Alcazaba Juegos and Nueva Lotus are
// both inside; Jaén, Almería and Málaga are not.
export const POKEDATA_ZONE = { latitude: 37.1773, longitude: -3.5986, radiusKm: 30 };
export const POKEDATA_LOOKAHEAD_DAYS = 120;

// The API's record, all strings. Only the fields we read are declared; the
// rest ("guid", "juniors", "TCaccounts"…) ride along untouched.
export type PokedataRaw = {
  type?: string;
  name?: string;
  date?: string;
  time?: string;
  when?: string;
  shop?: string;
  street_address?: string;
  city?: string;
  pokemon_url?: string;
  guid?: string;
  league?: string;
  product?: string;
  cost?: string;
  [key: string]: string | undefined;
};

export type PokedataEvent = {
  guid: string;
  // TOM's id (26-09-005734), from the pokemon.com URL; the dedupe key against
  // events.tournament_id.
  tournamentId: string | null;
  // The Play! "League ID" = the store (stores.play_league_id).
  playLeagueId: string | null;
  eventType: string; // "League Cup" / "League Challenge"
  title: string; // the API's own name, as the TO typed it
  category: Category;
  game: Game | null; // null for an unsupported product (GO)
  product: string;
  shop: string;
  city: string;
  location: string;
  // "YYYY-MM-DDTHH:mm" wall-clock time as the locator prints it, and that same
  // moment as an instant in Europe/Madrid.
  startsAtLocal: string | null;
  startsAtIso: string | null;
  cost: number;
  url: string | null;
  // Play! season quarter the date falls in, and the series line the Play!
  // page would print for it ("TCG League Cup Season 1") — what
  // composeEventName expects, so the import names events like the paste.
  quarter: number | null;
  series: string | null;
};

export type PokedataQuery = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
};

export function pokedataUrl(q: PokedataQuery): string {
  return (
    `${POKEDATA_BASE}/_tcg/cups/challenges/_vg/cups/challenges` +
    `/_latitude/${q.latitude}/_longitude/${q.longitude}` +
    `/_radius/${q.radiusKm}/_unit/km/_start/${q.start}/_end/${q.end}/`
  );
}

function ymdInTz(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Today (app timezone) through the next POKEDATA_LOOKAHEAD_DAYS days.
export function pokedataWindow(now: Date = new Date()): { start: string; end: string } {
  const start = ymdInTz(now);
  const end = new Date(Date.parse(`${start}T00:00:00Z`) + POKEDATA_LOOKAHEAD_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { start, end };
}

// https://www.pokemon.com/us/pokemon-trainer-club/play-pokemon-tournaments/26-09-005734/
export function tournamentIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /play-pokemon-tournaments\/([\w.-]+)\/?(?:[?#].*)?$/i.exec(url.trim());
  return m ? m[1] : null;
}

// The API's `product`: "tcg" or "vg" (the help page also lists "go").
export function gameFromPokedataProduct(product: string | null | undefined): Game | null {
  const p = (product ?? "").trim().toLowerCase();
  if (p === "tcg") return "tcg";
  if (p === "vg" || p === "vgc") return "vgc";
  return null;
}

// Play! League Cup / Challenge seasons are quarters that roll on September:
// Season 1 = Sep–Nov (the 2027 series opened 1 Sep 2026 and closes 30 Nov),
// Season 2 = Dec–Feb, Season 3 = Mar–May, Season 4 = Jun–Aug. The season is
// named after the year it ends in (Sep 2026 → 2027 season).
export function playSeasonQuarter(ymd: string | null | undefined): {
  season: number;
  quarter: number;
} | null {
  const m = /^(\d{4})-(\d{2})/.exec(ymd ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const sinceSeptember = (month - 9 + 12) % 12;
  return { season: month >= 9 ? year + 1 : year, quarter: Math.floor(sinceSeptember / 3) + 1 };
}

// Offset (ms) of `tz` from UTC at a given instant, via Intl.
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const p: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
  const hour = p.hour === 24 ? 0 : p.hour;
  return Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second) - utcMs;
}

// "YYYY-MM-DDTHH:mm" read as wall-clock time in `tz` → ISO instant. The
// paste form does this in the browser with `new Date(local)`; the import runs
// on the server (UTC on Vercel), so the zone has to be explicit.
export function localToIso(local: string | null | undefined, tz: string = TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local ?? "");
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0));
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  if (Number.isNaN(asUtc)) return null;
  // Two passes: the offset at the naive instant, then re-measured at the
  // corrected one so a time near a DST switch lands on the right side.
  let guess = asUtc - tzOffsetMs(asUtc, tz);
  const offset = tzOffsetMs(guess, tz);
  if (asUtc - offset !== guess) guess = asUtc - offset;
  return new Date(guess).toISOString();
}

// "2026-09-05 16:30:00" (or `date` + `time`) → "2026-09-05T16:30".
export function parsePokedataWhen(
  when: string | null | undefined,
  date: string | null | undefined,
  time: string | null | undefined,
): string | null {
  const w = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec((when ?? "").trim());
  if (w) return `${w[1]}T${w[2]}`;
  const d = (date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = /^(\d{2}:\d{2})/.exec((time ?? "").trim());
  return `${d}T${t ? t[1] : "00:00"}`;
}

function parseCost(cost: string | null | undefined): number {
  const n = Number((cost ?? "").replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function mapPokedataEvent(raw: PokedataRaw): PokedataEvent {
  const eventType = (raw.type ?? "").trim();
  const title = (raw.name ?? "").trim();
  const game = gameFromPokedataProduct(raw.product);
  const startsAtLocal = parsePokedataWhen(raw.when, raw.date, raw.time);
  const quarter = playSeasonQuarter(startsAtLocal ?? raw.date)?.quarter ?? null;
  const gameToken = game === "tcg" ? "TCG" : game === "vgc" ? "VGC" : null;
  const series =
    gameToken && eventType && quarter !== null
      ? `${gameToken} ${eventType} Season ${quarter}`
      : null;
  return {
    guid: (raw.guid ?? "").trim() || `${raw.pokemon_url ?? ""}#${raw.when ?? ""}`,
    tournamentId: tournamentIdFromUrl(raw.pokemon_url),
    playLeagueId: /^\d+$/.test((raw.league ?? "").trim()) ? (raw.league ?? "").trim() : null,
    eventType,
    title,
    category: categoryFromType(eventType, title),
    game,
    product: (raw.product ?? "").trim(),
    shop: (raw.shop ?? "").trim(),
    city: (raw.city ?? "").trim(),
    location: (raw.street_address ?? "").trim(),
    startsAtLocal,
    startsAtIso: localToIso(startsAtLocal),
    cost: parseCost(raw.cost),
    url: (raw.pokemon_url ?? "").trim() || null,
    quarter,
    series,
  };
}

// Same name the paste would produce for this tournament (PL-20):
// "League Cup Dune Cómics Q1 TCG". `storeName` is our store's name when the
// League ID matched one, else the shop as the locator prints it.
export function proposedEventName(ev: PokedataEvent, storeName: string | null): string | null {
  return composeEventName({
    title: ev.title || null,
    series: ev.series,
    eventType: ev.eventType || null,
    game: ev.game,
    storeName,
  });
}

// What matchSeasonLeague's `format` input would read on the Play! page. Cups
// and Challenges are Standard for TCG; VGC is always Champions on our side.
export function seasonFormatFor(game: Game | null): string | null {
  if (game === "tcg") return "TCG - Standard";
  if (game === "vgc") return "VGC";
  return null;
}

export type PokedataFetch = {
  events: PokedataEvent[];
  error: string | null;
  url: string;
};

// Server-only. Never cached: the admin wants what the locator says right now,
// and the query is cheap. Failures come back as `error`, not as a throw, so
// the import page still renders.
export async function fetchPokedataEvents(q: PokedataQuery): Promise<PokedataFetch> {
  const url = pokedataUrl(q);
  try {
    const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
    if (!res.ok) return { events: [], error: `HTTP ${res.status}`, url };
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return { events: [], error: "Respuesta inesperada", url };
    const events = (data as PokedataRaw[])
      .map(mapPokedataEvent)
      .sort((a, b) => (a.startsAtIso ?? "").localeCompare(b.startsAtIso ?? ""));
    return { events, error: null, url };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : String(e), url };
  }
}
