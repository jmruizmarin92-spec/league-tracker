"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isEventAdmin } from "@/lib/events";
import { listPlayers } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import { getEventTdfMapping } from "@/lib/event-rounds";
import {
  parseTdf,
  matchTdfPlayers,
  divisionLabel,
  TdfParseError,
  type TdfMatchSource,
} from "@/lib/tdf";

// A .tdf is a few KB of XML. The cap is only here so a mis-picked file can't
// tie up the server parsing something enormous.
const MAX_TDF_BYTES = 2 * 1024 * 1024;

export type TdfPreviewPlayer = {
  userid: string;
  fullName: string;
  playerId: string | null;
  playerLabel: string | null;
  source: TdfMatchSource;
};

export type TdfPreview = {
  fileName: string;
  tdfId: string;
  name: string;
  startDate: string | null;
  city: string | null;
  organizer: string | null;
  rounds: { label: string; number: number; matches: number; isFinals: boolean }[];
  matchCount: number;
  standingsCount: number;
  players: TdfPreviewPlayer[];
  // Every player in the system, so the review step can re-point a bad guess.
  candidates: { id: string; label: string }[];
  // Echoed back to the confirm step so the file is only read once.
  xml: string;
};

export type TdfPreviewState = { error?: string; preview?: TdfPreview };
export type TdfImportState = { error?: string; ok?: boolean; summary?: string };

async function readTdf(
  formData: FormData,
): Promise<{ xml: string; fileName: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elige un archivo .tdf." };
  }
  if (file.size > MAX_TDF_BYTES) {
    return { error: "El archivo es demasiado grande para ser un .tdf." };
  }
  return { xml: await file.text(), fileName: file.name };
}

// Step 1: parse the upload and show what it would do. Writes nothing.
export async function previewTdfAction(
  _prev: TdfPreviewState,
  formData: FormData,
): Promise<TdfPreviewState> {
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId || !(await isEventAdmin(eventId))) {
    return { error: "No tienes permisos sobre este torneo." };
  }

  const read = await readTdf(formData);
  if ("error" in read) return { error: read.error };

  try {
    const tdf = parseTdf(read.xml);
    const [dbPlayers, mapping] = await Promise.all([
      listPlayers(),
      getEventTdfMapping(eventId),
    ]);
    const byId = new Map(dbPlayers.map((p) => [p.id, p]));
    const matches = matchTdfPlayers(tdf.players, dbPlayers, mapping);

    return {
      preview: {
        fileName: read.fileName,
        tdfId: tdf.tdfId,
        name: tdf.name,
        startDate: tdf.startDate,
        city: tdf.city,
        organizer: tdf.organizer,
        rounds: tdf.rounds.map((r) => ({
          label: divisionLabel(r.division),
          number: r.number,
          matches: r.matches.length,
          isFinals: r.isFinals,
        })),
        matchCount: tdf.rounds.reduce((n, r) => n + r.matches.length, 0),
        standingsCount: tdf.standings.length,
        players: matches.map((m) => {
          const p = m.playerId ? byId.get(m.playerId) : undefined;
          return {
            userid: m.userid,
            fullName: m.fullName,
            playerId: m.playerId,
            playerLabel: p ? pairingName(p) : null,
            source: m.source,
          };
        }),
        candidates: dbPlayers.map((p) => ({ id: p.id, label: pairingName(p) })),
        xml: read.xml,
      },
    };
  } catch (e) {
    if (e instanceof TdfParseError) return { error: e.message };
    return { error: "No se ha podido leer el archivo .tdf." };
  }
}

// Step 2: commit the file the TO just reviewed. Re-parses rather than trusting
// anything the browser sends back beyond the per-player choices.
export async function importTdfAction(
  _prev: TdfImportState,
  formData: FormData,
): Promise<TdfImportState> {
  const eventId = String(formData.get("event_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const fileName = String(formData.get("file_name") ?? "");
  const xml = String(formData.get("xml") ?? "");
  if (!eventId || !(await isEventAdmin(eventId))) {
    return { error: "No tienes permisos sobre este torneo." };
  }
  if (!xml) return { error: "Vuelve a subir el archivo." };
  if (xml.length > MAX_TDF_BYTES) {
    return { error: "El archivo es demasiado grande para ser un .tdf." };
  }

  let tdf;
  try {
    tdf = parseTdf(xml);
  } catch (e) {
    if (e instanceof TdfParseError) return { error: e.message };
    return { error: "No se ha podido leer el archivo .tdf." };
  }

  // "" (or a missing choice) means "create a managed player for them".
  const players = tdf.players.map((p) => ({
    userid: p.userid,
    first_name: p.firstName,
    last_name: p.lastName,
    player_id: String(formData.get(`player_${p.userid}`) ?? "") || null,
  }));

  const rounds = tdf.rounds.map((r) => ({
    division: r.division,
    number: r.number,
    is_finals: r.isFinals,
    matches: r.matches.map((m) => ({
      pair_key: m.pairKey,
      table: m.table,
      userid1: m.userid1,
      userid2: m.userid2,
      result: m.result,
      code: m.outcomeCode,
    })),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_event_tdf", {
    p_event: eventId,
    p_tdf_id: tdf.tdfId,
    p_file_name: fileName,
    p_players: players,
    p_rounds: rounds,
    p_standings: tdf.standings.map((s) => ({
      division: s.division,
      userid: s.userid,
      place: s.place,
    })),
  });
  if (error) return { error: error.message };

  revalidatePath(`/events/${slug}`);
  const summary = data as {
    players: number;
    rounds: number;
    matches: number;
    places: number;
  } | null;
  if (!summary) return { ok: true };
  const parts = [
    `${summary.players} jugadores`,
    `${summary.rounds} rondas`,
    `${summary.matches} emparejamientos`,
  ];
  if (summary.places > 0) parts.push(`${summary.places} puestos finales`);
  return { ok: true, summary: parts.join(" · ") };
}

// A player's own call on their match. Advisory: the judge still enters it in
// TOM, and the next import is what makes it official.
export async function reportEventMatchAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const matchId = String(formData.get("match_id") ?? "");
  const result = String(formData.get("result") ?? "");
  if (!matchId) return;
  const supabase = await createClient();
  await supabase.rpc("report_event_match", {
    p_match: matchId,
    p_result: result,
  });
  revalidatePath(`/events/${slug}`);
}

export async function clearEventTdfAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) return;
  const supabase = await createClient();
  await supabase.rpc("clear_event_tdf", { p_event: eventId });
  revalidatePath(`/events/${slug}`);
}
