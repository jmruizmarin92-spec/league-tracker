"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { capText } from "@/lib/validation";
import { getEventBySlug, isEventAdmin, listRegistrations } from "@/lib/events";
import { isStoreAdmin } from "@/lib/stores";
import { countTdfPlayers } from "@/lib/event-prize-budget";
import {
  computePrizeBudget,
  isPrizeKind,
  prizeSummaryText,
  MAX_TOP_CUT,
} from "@/lib/event-prizes";

export type ActionState = { error?: string; ok?: boolean; published?: boolean };

// Money fields come from number inputs but a pasted "2,50" must work too.
function parseMoney(raw: FormDataEntryValue | null): number | "invalid" {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (s === "") return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return Math.round(n * 100) / 100;
}

// "28,20,12,…" as posted by the form's hidden field: one whole number per
// placing, blanks read as 0.
function parseShares(raw: FormDataEntryValue | null, topCut: number): number[] | "invalid" {
  const parts = String(raw ?? "")
    .split(",")
    .map((p) => p.trim());
  const out: number[] = [];
  for (let i = 0; i < topCut; i++) {
    const s = parts[i] ?? "";
    const n = s === "" ? 0 : Number(s);
    if (!Number.isInteger(n) || n < 0 || n > 1000) return "invalid";
    out.push(n);
  }
  return out;
}

type MoneyFields = {
  venue_fee: number;
  judge_fee: number;
  entry_pack: boolean;
  pack_value: number;
};

function parseMoneyFields(formData: FormData): MoneyFields | string {
  const venue = parseMoney(formData.get("venue_fee"));
  const judge = parseMoney(formData.get("judge_fee"));
  const pack = parseMoney(formData.get("pack_value"));
  if (venue === "invalid") return "El pago al local no es válido.";
  if (judge === "invalid") return "El pago al juez no es válido.";
  if (pack === "invalid") return "El valor del sobre no es válido.";
  return {
    venue_fee: venue,
    judge_fee: judge,
    entry_pack: String(formData.get("entry_pack") ?? "") === "true",
    pack_value: pack,
  };
}

// Saves the event's budget; with intent=publish it also recomputes the
// split server-side (players imported from TOM, or the registered count
// while there is no import) and writes the player-facing summary into
// events.prizes — the public card — so what players read is always what the
// saved budget says, not whatever the browser had on screen.
export async function saveEventPrizeBudgetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  if (!eventId || !slug) return { error: "Evento no válido." };
  if (!(await isEventAdmin(eventId))) return { error: "No tienes permiso." };

  const money = parseMoneyFields(formData);
  if (typeof money === "string") return { error: money };
  const extraCosts = parseMoney(formData.get("extra_costs"));
  if (extraCosts === "invalid") return { error: "Los otros costes no son válidos." };
  const extraNote = capText(String(formData.get("extra_costs_note") ?? ""), 120);
  const prizeKind = String(formData.get("prize_kind") ?? "packs");
  if (!isPrizeKind(prizeKind)) return { error: "Tipo de premio no válido." };
  const topCut = Number(String(formData.get("top_cut") ?? ""));
  if (!Number.isInteger(topCut) || topCut < 1 || topCut > MAX_TOP_CUT) {
    return { error: `El top debe ser un entero entre 1 y ${MAX_TOP_CUT}.` };
  }
  const shares = parseShares(formData.get("shares"), topCut);
  if (shares === "invalid") return { error: "Los porcentajes deben ser números enteros." };

  const supabase = await createClient();
  const { error } = await supabase.from("event_prize_budgets").upsert(
    {
      event_id: eventId,
      ...money,
      extra_costs: extraCosts,
      extra_costs_note: extraNote || null,
      prize_kind: prizeKind,
      top_cut: topCut,
      shares,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  if (error) return { error: error.message };

  if (intent === "publish") {
    const event = await getEventBySlug(slug);
    if (!event || event.id !== eventId) return { error: "Evento no válido." };
    let players = await countTdfPlayers(eventId);
    if (players === 0) {
      const regs = await listRegistrations(eventId);
      players = regs.filter((r) => r.status === "registered").length;
    }
    const result = computePrizeBudget({
      players,
      entryFee: event.cost,
      venueFee: money.venue_fee,
      judgeFee: money.judge_fee,
      entryPack: money.entry_pack,
      packValue: money.pack_value,
      extraCosts,
      prizeKind,
      topCut,
      shares,
    });
    const text = prizeSummaryText(result, prizeKind, {
      packOne: "sobre",
      packMany: "sobres",
      cashUnit: "€ en tienda",
      entryPackLine: "Sobre de inscripción para todos los participantes",
    });
    if (!text) {
      return { error: "No hay nada que publicar: el bote es 0 con los datos actuales." };
    }
    const { error: pubError } = await supabase
      .from("events")
      .update({ prizes: text })
      .eq("id", eventId);
    if (pubError) return { error: pubError.message };
  }

  revalidatePath(`/events/${slug}`);
  return { ok: true, published: intent === "publish" };
}

// Store-level defaults a new cup starts from (store console).
export async function saveStorePrizeDefaultsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const storeId = String(formData.get("store_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!storeId) return { error: "Tienda no válida." };
  if (!(await isStoreAdmin(storeId))) return { error: "No tienes permiso." };
  const money = parseMoneyFields(formData);
  if (typeof money === "string") return { error: money };

  const supabase = await createClient();
  const { error } = await supabase.from("store_prize_defaults").upsert(
    { store_id: storeId, ...money, updated_at: new Date().toISOString() },
    { onConflict: "store_id" },
  );
  if (error) return { error: error.message };
  if (slug) revalidatePath(`/stores/${slug}/admin`);
  revalidatePath("/events", "layout");
  return { ok: true };
}
