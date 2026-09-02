// Parser for the text of a tournament page on the Play! Pokémon organiser
// site, pasted as-is (select all → copy) into the create-event form. There is
// no API for that site, so the page text is the only input we get.
//
// The page is a flat list of label / value lines ("Tournament ID:" then the
// id on the next line, "Product" then "Trading Card Game"...). Everything here
// is best effort: a label that isn't found simply leaves its field null and
// the form shows what it could fill. The only hard failure is a text with no
// Tournament ID at all, which means it isn't a tournament page.
//
// Pure module, no React/Supabase — unit-tested in play-event-paste.test.ts.

import type { Category } from "@/lib/event-category";
import type { Game } from "@/lib/league-format";

export type PlayEventStatus = "open" | "closed" | "complete";

export type PlayEventPaste = {
  name: string | null;
  tournamentId: string | null;
  playLeagueId: string | null;
  // "YYYY-MM-DDTHH:mm", the value an <input type="datetime-local"> takes. Kept
  // as wall-clock time on purpose: the form turns it into an instant in the
  // browser's timezone, exactly as if the TO had typed it.
  startsAtLocal: string | null;
  game: Game | null;
  format: string | null;
  eventType: string | null;
  series: string | null;
  category: Category;
  location: string | null;
  website: string | null;
  activityGroup: string | null;
  organizer: string | null;
  players: { junior: number; senior: number; masters: number; total: number } | null;
  status: PlayEventStatus;
};

export class PlayPasteError extends Error {}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

// "August 2, 2026 10:00AM" — the page prints times without a zone; the
// created/uploaded stamps further down carry " UTC" and are deliberately not
// matched by the anchored $ so the first hit is always the start date.
const DATE_RE = /^([A-Za-z]+) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2})\s*(AM|PM)$/i;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

// Index of the first line equal to `label` (case-insensitive) at or after
// `from`, or -1.
function indexOfLabel(ls: string[], label: string, from = 0): number {
  const want = label.toLowerCase();
  for (let i = from; i < ls.length; i++) {
    if (ls[i].toLowerCase() === want) return i;
  }
  return -1;
}

// Value on the line following `label`, unless that line is itself one of the
// known section headers (a label with no value).
function valueAfter(ls: string[], label: string, from = 0): string | null {
  const i = indexOfLabel(ls, label, from);
  if (i < 0 || i + 1 >= ls.length) return null;
  return ls[i + 1];
}

function parseCount(ls: string[], label: string, from: number): number | null {
  const v = valueAfter(ls, label, from);
  if (v === null || !/^\d+$/.test(v)) return null;
  return Number(v);
}

export function parseStartDate(value: string): string | null {
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hour = Number(m[4]) % 12;
  if (m[6].toUpperCase() === "PM") hour += 12;
  const minute = Number(m[5]);
  if (day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export function gameFromProduct(product: string | null): Game | null {
  if (!product) return null;
  const p = product.toLowerCase();
  if (p.includes("trading card")) return "tcg";
  if (p.includes("video game")) return "vgc";
  return null;
}

// Keyword map from what the page calls the event to our category taxonomy.
// Anything we don't recognise lands in `others`; the TO can change it.
export function categoryFromType(...labels: (string | null)[]): Category {
  const text = labels.filter((l): l is string => !!l).join(" ").toLowerCase();
  if (text.includes("league cup")) return "cup";
  if (text.includes("league challenge")) return "challenge";
  if (text.includes("prerelease") || text.includes("pre-release")) return "prerelease";
  if (text.includes("demo")) return "demo";
  return "others";
}

// Lines between "Address" and "Event Locator", joined. The last line is the
// two-letter country, which nobody needs on a local event's card.
function parseAddress(ls: string[]): string | null {
  const start = indexOfLabel(ls, "Address");
  if (start < 0) return null;
  let end = indexOfLabel(ls, "Event Locator", start + 1);
  if (end < 0) end = indexOfLabel(ls, "Organizer Info", start + 1);
  if (end < 0) end = Math.min(ls.length, start + 6);
  const parts = ls.slice(start + 1, end);
  if (parts.length > 1 && /^[A-Z]{2}$/.test(parts[parts.length - 1])) parts.pop();
  const joined = parts.join(", ");
  return joined === "" ? null : joined;
}

function parseStatus(ls: string[]): PlayEventStatus {
  const about = indexOfLabel(ls, "About");
  const v = valueAfter(ls, "Status", about < 0 ? 0 : about);
  if (!v) return "open";
  const s = v.toLowerCase();
  if (s === "complete" || s === "completed") return "complete";
  if (s === "closed" || s === "cancelled" || s === "canceled") return "closed";
  return "open";
}

export function parsePlayEventPaste(text: string): PlayEventPaste {
  const ls = lines(text);
  const tournamentMatch = /Tournament ID:?\s*([0-9]{2}-[0-9]{2}-[0-9]+)/i.exec(text);
  if (!tournamentMatch) {
    throw new PlayPasteError(
      "No se ha encontrado ningún Tournament ID en el texto pegado.",
    );
  }
  const tournamentId = tournamentMatch[1];
  const leagueMatch = /League ID:?\s*([0-9]+)/i.exec(text);
  const playLeagueId = leagueMatch ? leagueMatch[1] : null;

  // The name is the page title — first line — as long as it isn't one of the
  // label lines. A partial paste starting lower down gets null. League Cups
  // and Challenges have no title of their own on the Play! site: the header
  // shows the start date instead, which is no name either (PL-20).
  const first = ls[0] ?? null;
  const name =
    first && !/^(Tournament|League) ID/i.test(first) && parseStartDate(first) === null
      ? first
      : null;

  const startsAtLocal = ls.map(parseStartDate).find((d) => d !== null) ?? null;

  const product = valueAfter(ls, "Product");
  const eventTypeIdx = indexOfLabel(ls, "Event Type");
  const eventType = eventTypeIdx >= 0 ? ls[eventTypeIdx + 1] ?? null : null;
  // "Premier Event Series" shows up twice: as the Event Type's value and then
  // as its own label, whose value is the series name. Skip the value line.
  const seriesIdx = indexOfLabel(ls, "Premier Event Series", eventTypeIdx + 2);
  const series = seriesIdx >= 0 ? ls[seriesIdx + 1] ?? null : null;

  const playersIdx = indexOfLabel(ls, "Players");
  let players: PlayEventPaste["players"] = null;
  if (playersIdx >= 0) {
    const junior = parseCount(ls, "Junior", playersIdx) ?? 0;
    const senior = parseCount(ls, "Senior", playersIdx) ?? 0;
    const masters = parseCount(ls, "Masters", playersIdx) ?? 0;
    const total = parseCount(ls, "Total Players", playersIdx) ?? junior + senior + masters;
    players = { junior, senior, masters, total };
  }

  const website = valueAfter(ls, "Website");
  const organizerIdx = indexOfLabel(ls, "Organizer Info");
  const organizer = organizerIdx >= 0 ? valueAfter(ls, "Name", organizerIdx) : null;

  return {
    name,
    tournamentId,
    playLeagueId,
    startsAtLocal,
    game: gameFromProduct(product),
    format: valueAfter(ls, "Format"),
    eventType,
    series,
    category: categoryFromType(eventType, series, name),
    location: parseAddress(ls),
    website: website && /^https?:\/\//i.test(website) ? website : null,
    activityGroup: valueAfter(ls, "Activity Group"),
    organizer,
    players,
    status: parseStatus(ls),
  };
}

// The name we actually give the event (PL-20). The Play! title is useless as
// a name: cups and challenges don't have one (the header is the date) and the
// series line reads "TCG League Cup Season 1", which says nothing about where.
// So the name is always composed as "<type> <store> Q<n> <GAME>":
// "League Cup Dune Cómics Q1 TCG". The type comes from the series line (or
// the event type, or the page title as a last resort) minus its leading game
// token and its "Season n", which becomes the quarter. The store is our store
// name when the League ID matched one, else the page's Activity Group.
export type EventNameParts = {
  title: string | null;
  series: string | null;
  eventType: string | null;
  game: Game | null;
  storeName: string | null;
};

const GAME_TOKEN_RE = /^(TCG|VGC|Pok[eé]mon GO|GO) +/i;
const SEASON_RE = /(?:^| )Season +([0-9]+) */i;

export function composeEventName(parts: EventNameParts): string | null {
  const base = parts.series ?? parts.eventType ?? parts.title;
  if (!base) return null;

  const tokenMatch = GAME_TOKEN_RE.exec(base);
  let type = tokenMatch ? base.slice(tokenMatch[0].length) : base;

  let quarter: string | null = null;
  const seasonMatch = SEASON_RE.exec(type);
  if (seasonMatch) {
    quarter = "Q" + Number(seasonMatch[1]);
    type = type.slice(0, seasonMatch.index) + " " + type.slice(seasonMatch.index + seasonMatch[0].length);
  }
  type = type.replace(/ +/g, " ").trim();

  const gameLabel =
    parts.game === "tcg" ? "TCG"
    : parts.game === "vgc" ? "VGC"
    : tokenMatch ? tokenMatch[1].toUpperCase()
    : null;

  const out = [type, parts.storeName?.trim() || null, quarter, gameLabel]
    .filter((x): x is string => !!x)
    .join(" ");
  return out === "" ? null : out;
}
