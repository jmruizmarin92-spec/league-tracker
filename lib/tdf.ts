// Parser for TOM (Tournament Operations Manager) `.tdf` exports — the file the
// official software writes for a Play! Pokémon event. Pure, no DB, no Node
// APIs: unit-tested in tdf.test.ts.
//
// The format is small, flat XML: <tournament><data/><players/><pods/></tournament>.
// Rather than pull in an XML dependency for one screen, this file carries a
// minimal reader. It is deliberately tolerant (unknown elements are ignored)
// but not a general XML parser: a literal ">" inside an attribute value would
// confuse it. TOM escapes those, so in practice it doesn't come up.

export class TdfParseError extends Error {}

// ---------------------------------------------------------------------------
// Minimal XML reader.
// ---------------------------------------------------------------------------

export type XmlNode = {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1] === "x" || entity[1] === "X";
      const code = parseInt(hex ? entity.slice(2) : entity.slice(1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[entity] ?? whole;
  });
}

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? "");
  }
  return out;
}

export function parseXml(src: string): XmlNode {
  const root: XmlNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  let i = 0;

  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) break;

    if (lt > i) {
      const txt = src.slice(i, lt);
      if (txt.trim()) stack[stack.length - 1].text += decode(txt);
    }

    if (src.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith("<![CDATA[", lt)) {
      const end = src.indexOf("]]>", lt);
      stack[stack.length - 1].text += src.slice(lt + 9, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    // <?xml ... ?> and <!DOCTYPE ...> carry nothing we need.
    if (src.startsWith("<?", lt) || src.startsWith("<!", lt)) {
      const end = src.indexOf(">", lt);
      i = end === -1 ? src.length : end + 1;
      continue;
    }

    const gt = src.indexOf(">", lt);
    if (gt === -1) break;
    const raw = src.slice(lt + 1, gt).trim();
    i = gt + 1;

    if (raw.startsWith("/")) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const sp = body.search(/\s/);
    const node: XmlNode = {
      name: (sp === -1 ? body : body.slice(0, sp)).toLowerCase(),
      attrs: sp === -1 ? {} : parseAttrs(body.slice(sp)),
      children: [],
      text: "",
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }

  return root;
}

function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

function childrenOf(node: XmlNode | undefined, name: string): XmlNode[] {
  return node?.children.filter((c) => c.name === name) ?? [];
}

function textOf(node: XmlNode | undefined, name: string): string {
  return child(node, name)?.text.trim() ?? "";
}

function intOr(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// TDF domain.
// ---------------------------------------------------------------------------

// TOM writes the result of a match as a numeric `outcome` attribute. 0 is the
// "not reported yet" state every freshly paired round carries. The raw code is
// kept alongside the mapped value so an unknown one (a TOM version we haven't
// seen) shows as pending instead of silently becoming a win for somebody.
export const TDF_OUTCOMES: Record<number, TdfResult> = {
  0: "pending",
  1: "p1_win",
  2: "p2_win",
  3: "draw",
  4: "double_loss",
  5: "bye",
};

export type TdfResult =
  | "pending"
  | "p1_win"
  | "p2_win"
  | "draw"
  | "double_loss"
  | "bye";

// Pod `category`: the age division the pod belongs to.
const DIVISION_LABELS: Record<number, string> = {
  0: "Junior",
  1: "Senior",
  2: "Master",
};

export function divisionLabel(division: number): string {
  return DIVISION_LABELS[division] ?? `División ${division}`;
}

export type TdfPlayer = {
  userid: string; // Pokémon ID / POP ID
  firstName: string;
  lastName: string;
  birthdate: string | null; // ISO yyyy-mm-dd
  fullName: string;
};

export type TdfMatch = {
  // Stable natural key for a pairing inside a round, so re-importing the same
  // tournament updates the row it already created instead of duplicating it.
  pairKey: string;
  table: number | null;
  userid1: string;
  userid2: string | null; // null = bye
  outcomeCode: number;
  result: TdfResult;
};

// Round `type` in the file: 3 is a swiss round, 1 a single-elimination one.
// The cut continues the same numbering (a 4-round swiss + top 4 runs 1..6), so
// the number alone identifies a round within its division.
const ROUND_TYPE_SINGLE_ELIMINATION = 1;

export type TdfRound = {
  division: number; // pod category
  number: number;
  isFinals: boolean;
  matches: TdfMatch[];
};

// Final placings, written into a <standings> block once the TO closes the
// tournament. This is TOM's own answer, tiebreakers and all — worth far more
// than anything we could recompute, so it replaces the provisional table.
export type TdfStanding = {
  division: number;
  userid: string;
  place: number;
};

export type TdfTournament = {
  tdfId: string;
  name: string;
  city: string | null;
  country: string | null;
  startDate: string | null; // ISO yyyy-mm-dd
  roundMinutes: number | null;
  organizer: string | null;
  players: TdfPlayer[];
  rounds: TdfRound[];
  standings: TdfStanding[];
};

export function pairKeyOf(userid1: string, userid2: string | null): string {
  if (!userid2) return `${userid1}~bye`;
  return [userid1, userid2].sort().join("~");
}

// TOM writes dates as MM/DD/YYYY (optionally followed by a time).
export function parseTomDate(raw: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export function parseTdf(xml: string): TdfTournament {
  const root = parseXml(xml);
  const tournament = child(root, "tournament");
  if (!tournament) {
    throw new TdfParseError("El archivo no parece un export de TOM (falta <tournament>).");
  }

  const data = child(tournament, "data");
  const organizer = child(data, "organizer");

  const players: TdfPlayer[] = childrenOf(child(tournament, "players"), "player")
    .map((p) => {
      const firstName = textOf(p, "firstname");
      const lastName = textOf(p, "lastname");
      return {
        userid: (p.attrs.userid ?? "").trim(),
        firstName,
        lastName,
        birthdate: parseTomDate(textOf(p, "birthdate")),
        fullName: [firstName, lastName].filter(Boolean).join(" ").trim(),
      };
    })
    .filter((p) => p.userid !== "");

  if (players.length === 0) {
    throw new TdfParseError("El archivo no contiene jugadores.");
  }

  const rounds: TdfRound[] = [];
  // Note what is NOT read here: the pod's own `stage`. It tracks the pod's
  // progress (0 while swiss is running, 1 once the cut starts), so it changes
  // under the same rounds mid-tournament — keying anything on it would make
  // rounds 1..n reappear as duplicates the moment the top cut is paired.
  for (const pod of childrenOf(child(tournament, "pods"), "pod")) {
    const division = intOr(pod.attrs.category, 0);

    for (const round of childrenOf(child(pod, "rounds"), "round")) {
      const number = intOr(round.attrs.number, rounds.length + 1);
      const matches: TdfMatch[] = [];

      for (const match of childrenOf(child(round, "matches"), "match")) {
        const userid1 = (child(match, "player1")?.attrs.userid ?? "").trim();
        // A bye is written as a single <player> (or only <player1>), so both
        // shapes collapse to "player 1 with no opponent".
        const userid2 =
          (child(match, "player2")?.attrs.userid ?? "").trim() || null;
        const solo = (child(match, "player")?.attrs.userid ?? "").trim();
        const p1 = userid1 || solo;
        if (!p1) continue;

        const outcomeCode = intOr(match.attrs.outcome, 0);
        const mapped = TDF_OUTCOMES[outcomeCode] ?? "pending";
        matches.push({
          pairKey: pairKeyOf(p1, userid2),
          table: child(match, "tablenumber")
            ? intOr(textOf(match, "tablenumber"), 0) || null
            : null,
          userid1: p1,
          userid2,
          outcomeCode,
          result: userid2 === null && mapped === "pending" ? "bye" : mapped,
        });
      }

      rounds.push({
        division,
        number,
        isFinals: intOr(round.attrs.type, 0) === ROUND_TYPE_SINGLE_ELIMINATION,
        matches,
      });
    }
  }

  rounds.sort((a, b) => a.division - b.division || a.number - b.number);

  const standings: TdfStanding[] = childrenOf(
    child(tournament, "standings"),
    "pod",
  ).flatMap((pod) => {
    // The <standings> block repeats a pod per division and per outcome
    // ("finished" / "dnf"); only the finished one carries places.
    if (pod.attrs.type !== "finished") return [];
    const division = intOr(pod.attrs.category, 0);
    return childrenOf(pod, "player")
      .map((p) => ({
        division,
        userid: (p.attrs.id ?? "").trim(),
        place: intOr(p.attrs.place, 0),
      }))
      .filter((s) => s.userid !== "" && s.place > 0);
  });
  standings.sort((a, b) => a.division - b.division || a.place - b.place);

  return {
    tdfId: textOf(data, "id"),
    name: textOf(data, "name") || "Torneo sin nombre",
    city: textOf(data, "city") || null,
    country: textOf(data, "country") || null,
    startDate: parseTomDate(textOf(data, "startdate")),
    roundMinutes: intOr(textOf(data, "roundtime"), 0) || null,
    organizer: organizer?.attrs.name?.trim() || null,
    players,
    rounds,
    standings,
  };
}

// ---------------------------------------------------------------------------
// Matching TDF players against the player table.
// ---------------------------------------------------------------------------

export type TdfMatchSource = "mapped" | "pokemon_id" | "name" | "none";

export type TdfPlayerMatch = {
  userid: string;
  fullName: string;
  firstName: string;
  lastName: string;
  playerId: string | null; // resolved (mapped) or suggested
  source: TdfMatchSource;
};

export type MatchablePlayer = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  pokemon_id: string | null;
};

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents so "Óscar" matches "Oscar"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Resolution order: a mapping this event already stored wins, then an exact
// Pokémon ID hit, then an unambiguous full-name hit. A name that matches two
// different players resolves to nothing — silently linking a result to the
// wrong person is worse than making the TO pick.
export function matchTdfPlayers(
  players: TdfPlayer[],
  dbPlayers: MatchablePlayer[],
  mapping: Map<string, string>,
): TdfPlayerMatch[] {
  const byPokemonId = new Map<string, string>();
  const byName = new Map<string, string[]>();

  for (const p of dbPlayers) {
    const pid = p.pokemon_id?.trim();
    if (pid && !byPokemonId.has(pid)) byPokemonId.set(pid, p.id);

    const keys = new Set(
      [
        normalizeName([p.first_name ?? "", p.last_name ?? ""].join(" ")),
        normalizeName(p.display_name ?? ""),
      ].filter(Boolean),
    );
    for (const key of keys) {
      const list = byName.get(key) ?? [];
      if (!list.includes(p.id)) list.push(p.id);
      byName.set(key, list);
    }
  }

  return players.map((p) => {
    const base = {
      userid: p.userid,
      fullName: p.fullName,
      firstName: p.firstName,
      lastName: p.lastName,
    };

    const mapped = mapping.get(p.userid);
    if (mapped) return { ...base, playerId: mapped, source: "mapped" as const };

    const byId = byPokemonId.get(p.userid);
    if (byId) return { ...base, playerId: byId, source: "pokemon_id" as const };

    const named = byName.get(normalizeName(p.fullName));
    if (named && named.length === 1) {
      return { ...base, playerId: named[0], source: "name" as const };
    }

    return { ...base, playerId: null, source: "none" as const };
  });
}
