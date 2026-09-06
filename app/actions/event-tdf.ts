"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEventAdmin } from "@/lib/events";
import { listPlayers } from "@/lib/players";
import { getEventTdfMapping } from "@/lib/event-rounds";
import {
  parseTdf,
  matchTdfPlayers,
  TdfParseError,
  type TdfTournament,
} from "@/lib/tdf";

// A .tdf is a few KB of XML. The cap is only here so a mis-picked file can't
// tie up the server parsing something enormous.
const MAX_TDF_BYTES = 2 * 1024 * 1024;

export type TdfImportState = { error?: string };

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

// One step (PL-26): read the upload, parse it, resolve its players and commit.
// Nothing from the browser is trusted beyond the file itself. Players resolve
// the way the old review step suggested them — existing mapping → Pokémon ID
// → unambiguous name — and anyone left over becomes a managed player. On
// success the caller is sent to the pairings tab; only errors come back.
export async function importTdfAction(
  _prev: TdfImportState,
  formData: FormData,
): Promise<TdfImportState> {
  const eventId = String(formData.get("event_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!eventId || !(await isEventAdmin(eventId))) {
    return { error: "No tienes permisos sobre este torneo." };
  }

  const read = await readTdf(formData);
  if ("error" in read) return { error: read.error };

  let tdf: TdfTournament;
  try {
    tdf = parseTdf(read.xml);
  } catch (e) {
    if (e instanceof TdfParseError) return { error: e.message };
    return { error: "No se ha podido leer el archivo .tdf." };
  }

  const [dbPlayers, mapping] = await Promise.all([
    listPlayers(),
    getEventTdfMapping(eventId),
  ]);
  // null player_id = "create a managed player for them".
  const players = matchTdfPlayers(tdf.players, dbPlayers, mapping).map((m) => ({
    userid: m.userid,
    first_name: m.firstName,
    last_name: m.lastName,
    player_id: m.playerId,
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
  const { error } = await supabase.rpc("import_event_tdf", {
    p_event: eventId,
    p_tdf_id: tdf.tdfId,
    p_file_name: read.fileName,
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
  // `redirect` throws, so it stays outside any try block. The tab strip reads
  // `?tab=` (components/page-tabs.tsx), which is what lands the TO on the
  // pairings they just imported.
  redirect(`/events/${encodeURIComponent(slug)}?tab=pairings`);
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
