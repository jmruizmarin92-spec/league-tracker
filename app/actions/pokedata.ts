"use server";

import { requiresListByDefault } from "@/lib/event-category";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listStores } from "@/lib/stores";
import { listLeagues } from "@/lib/leagues";
import { matchSeasonLeague, type SeasonCandidate } from "@/lib/season-match";
import {
  fetchPokedataEvents,
  pokedataWindow,
  proposedEventName,
  seasonFormatFor,
  POKEDATA_ZONE,
} from "@/lib/pokedata";

export type ImportResult = {
  tournamentId: string;
  name: string;
  ok: boolean;
  slug?: string;
  error?: string;
};

export type ImportState = { results?: ImportResult[]; error?: string };

function friendlyImportError(message: string, tournamentId: string): string {
  if (/already exists/i.test(message) || /events_tournament_id_key/.test(message)) {
    return `Ya existe un evento con el Tournament ID ${tournamentId}.`;
  }
  return message;
}

// Creates the ticked events (PL-21). The form only sends tournament ids: the
// API is queried again here and the store / season resolved server-side, so
// nothing the browser says about a tournament is trusted. One create_event
// call per event; a failure on one does not stop the others.
export async function importPokedataEventsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();
  const wanted = new Set(
    formData
      .getAll("tournament_id")
      .map((v) => String(v).trim())
      .filter((v) => v !== ""),
  );
  if (wanted.size === 0) return { error: "Marca al menos un evento." };

  const [api, stores, leagueRows] = await Promise.all([
    fetchPokedataEvents({ ...POKEDATA_ZONE, ...pokedataWindow() }),
    listStores(),
    listLeagues(),
  ]);
  if (api.error) return { error: `No se ha podido consultar pokedata.ovh: ${api.error}` };

  const leagues: SeasonCandidate[] = leagueRows.map((l) => ({
    id: l.id,
    storeId: l.store_id,
    game: l.game,
    format: l.format,
    startsMonth: l.starts_month,
    endsMonth: l.ends_month,
    archived: l.archived_at !== null,
  }));

  const supabase = await createClient();
  const results: ImportResult[] = [];
  let anyLeague = false;

  for (const ev of api.events) {
    if (!ev.tournamentId || !wanted.has(ev.tournamentId)) continue;
    wanted.delete(ev.tournamentId);
    const tournamentId = ev.tournamentId;

    const store = ev.playLeagueId
      ? stores.find((s) => s.play_league_id === ev.playLeagueId)
      : undefined;
    const name = proposedEventName(ev, store?.name ?? ev.shop) ?? ev.title;

    if (!store) {
      results.push({
        tournamentId,
        name,
        ok: false,
        error: `Ninguna tienda tiene el League ID ${ev.playLeagueId ?? "?"}.`,
      });
      continue;
    }
    if (!ev.game) {
      results.push({ tournamentId, name, ok: false, error: `Producto no soportado (${ev.product}).` });
      continue;
    }
    if (!name) {
      results.push({ tournamentId, name: tournamentId, ok: false, error: "Sin nombre." });
      continue;
    }

    const season = matchSeasonLeague(leagues, {
      storeId: store.id,
      game: ev.game,
      format: seasonFormatFor(ev.game),
      startsAtLocal: ev.startsAtLocal,
    });
    const leagueId = season.kind === "one" ? season.id : null;
    const subtitle = ev.series && ev.series.toLowerCase() !== name.toLowerCase() ? ev.series : null;

    const { data: slug, error } = await supabase.rpc("create_event", {
      p_name: name.slice(0, 100),
      p_game: ev.game,
      p_starts_at: ev.startsAtIso,
      p_location: ev.location.slice(0, 120),
      p_cost: ev.cost,
      p_description: "",
      p_external_url: ev.url ?? "",
      p_prizes: "",
      p_list_required: requiresListByDefault(ev.category),
      p_capacity: null,
      p_category: ev.category,
      p_subtitle: subtitle ? subtitle.slice(0, 80) : null,
      p_list_lock_minutes: null,
      p_league_id: leagueId,
      p_tournament_id: tournamentId,
      p_status: "open",
      p_store_id: store.id,
      p_allow_guest_lists: requiresListByDefault(ev.category),
    });
    if (error) {
      results.push({
        tournamentId,
        name,
        ok: false,
        error: friendlyImportError(error.message, tournamentId),
      });
      continue;
    }
    if (leagueId) anyLeague = true;
    results.push({ tournamentId, name, ok: true, slug: String(slug) });
  }

  // Ticked in the browser but gone from the API by the time we asked again.
  for (const id of wanted) {
    results.push({ tournamentId: id, name: id, ok: false, error: "Ya no aparece en la API." });
  }

  if (results.some((r) => r.ok)) {
    revalidatePath("/");
    revalidatePath("/admin/events/import");
    revalidatePath("/admin/stores");
    if (anyLeague) revalidatePath("/leagues", "layout");
  }
  return { results };
}
