"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getRounds,
  getSessionMatches,
  getActiveParticipantIds,
  type DbMatch,
} from "@/lib/rounds";
import { computeStandings, type MatchInput } from "@/lib/scoring";
import {
  generateSwissPairings,
  repairSwissPairings,
  pairKey,
  type SeatedPairing,
} from "@/lib/pairing";

export type RoundActionState = { error?: string };

function revalidateSessionViews() {
  revalidatePath("/leagues/[slug]/sessions/[sessionSlug]", "page");
  revalidatePath("/leagues/[slug]/sessions/[sessionSlug]/display", "page");
}

// What the pairing generator needs, derived from a set of matches: the active
// roster ordered by standings, the matchups already played and who had a bye.
function pairingContext(matches: DbMatch[], activeIds: string[]) {
  // Standings over everyone who has played or is on the active roster.
  const allIds = [
    ...new Set([
      ...activeIds,
      ...matches.flatMap((m) =>
        [m.player1_id, m.player2_id].filter(Boolean) as string[],
      ),
    ]),
  ];
  const inputs: MatchInput[] = matches.map((m) => ({
    player1: m.player1_id,
    player2: m.player2_id,
    result: m.result,
  }));
  const standings = computeStandings(allIds, inputs);

  const activeSet = new Set(activeIds);
  const ordered = standings
    .map((s) => s.playerId)
    .filter((id) => activeSet.has(id));

  const played = new Set(
    matches
      .filter((m) => m.player2_id)
      .map((m) => pairKey(m.player1_id, m.player2_id as string)),
  );
  const hadBye = new Set(
    matches.filter((m) => m.result === "bye").map((m) => m.player1_id),
  );
  return { ordered, played, hadBye };
}

export async function generateRoundAction(
  _prev: RoundActionState,
  formData: FormData,
): Promise<RoundActionState> {
  const sessionId = String(formData.get("session_id") ?? "");
  if (!sessionId) return {};

  const [matches, activeIds] = await Promise.all([
    getSessionMatches(sessionId),
    getActiveParticipantIds(sessionId),
  ]);
  const { ordered, played, hadBye } = pairingContext(matches, activeIds);

  // A matchup never repeats within a session. If every remaining option is a
  // rematch the field is exhausted and the round is refused rather than paired.
  const pairings = generateSwissPairings(ordered, played, hadBye);
  if (!pairings) {
    return {
      error:
        "No se puede generar la ronda: todos los emparejamientos posibles ya se han jugado en esta sesión.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_round", {
    p_session: sessionId,
    p_pairings: pairings,
  });
  if (error) return { error: error.message };
  revalidateSessionViews();
  return {};
}

/**
 * Re-pair the latest round while its pairings are published but not started
 * (round status `pairing`), after drops or late additions. Keeps every table
 * whose players are both still active; see `repairSwissPairings`.
 */
export async function repairRoundAction(
  _prev: RoundActionState,
  formData: FormData,
): Promise<RoundActionState> {
  const sessionId = String(formData.get("session_id") ?? "");
  const roundId = String(formData.get("round_id") ?? "");
  if (!sessionId || !roundId) return {};

  const [rounds, matches, activeIds] = await Promise.all([
    getRounds(sessionId),
    getSessionMatches(sessionId),
    getActiveParticipantIds(sessionId),
  ]);
  const round = rounds.find((r) => r.id === roundId);
  if (!round || round.id !== rounds.at(-1)?.id) {
    return { error: "Solo se puede reemparejar la última ronda." };
  }
  if (round.status !== "pairing") {
    return { error: "La ronda ya ha empezado; no se puede reemparejar." };
  }

  // Standings, played matchups and byes come from the PREVIOUS rounds only:
  // this round's byes would otherwise count as wins and its pairings as
  // "already played".
  const previous = matches.filter((m) => m.round_id !== roundId);
  const { ordered, played, hadBye } = pairingContext(previous, activeIds);
  const existing: SeatedPairing[] = matches
    .filter((m) => m.round_id === roundId && m.result !== "loss")
    .map((m) => ({
      player1: m.player1_id,
      player2: m.player2_id,
      table: m.table_number,
    }));

  const pairings = repairSwissPairings(ordered, existing, played, hadBye);
  if (!pairings) {
    return {
      error:
        "No se puede reemparejar: no queda ninguna combinación sin repetir enfrentamientos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("repair_round", {
    p_round: roundId,
    p_pairings: pairings,
  });
  if (error) return { error: error.message };
  revalidateSessionViews();
  return {};
}

// Pairings posted -> playing. Starts the timer too when minutes were given.
export async function startRoundAction(formData: FormData) {
  const roundId = String(formData.get("round_id") ?? "");
  const durationSeconds = Number(formData.get("duration_seconds") ?? 0);
  if (!roundId) return;
  const supabase = await createClient();
  await supabase.rpc("start_round", {
    p_round: roundId,
    p_duration_seconds: durationSeconds > 0 ? durationSeconds : null,
  });
  revalidateSessionViews();
}

export async function reportMatchAction(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "");
  const result = String(formData.get("result") ?? "");
  const supabase = await createClient();
  await supabase.rpc("report_match", { p_match: matchId, p_result: result });
  revalidatePath("/leagues/[slug]/sessions/[sessionSlug]", "page");
}

export async function deleteRoundAction(formData: FormData) {
  const roundId = String(formData.get("round_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("delete_round", { p_round: roundId });
  revalidatePath("/leagues/[slug]/sessions/[sessionSlug]", "page");
}

export async function startRoundTimerAction(formData: FormData) {
  const roundId = String(formData.get("round_id") ?? "");
  const durationSeconds = Number(formData.get("duration_seconds") ?? 0);
  if (!roundId || !durationSeconds || durationSeconds <= 0) return;
  const supabase = await createClient();
  await supabase.rpc("start_round_timer", {
    p_round: roundId,
    p_duration_seconds: durationSeconds,
  });
  revalidateSessionViews();
}

export async function pauseRoundTimerAction(formData: FormData) {
  const roundId = String(formData.get("round_id") ?? "");
  if (!roundId) return;
  const supabase = await createClient();
  await supabase.rpc("pause_round_timer", { p_round: roundId });
  revalidateSessionViews();
}

export async function resumeRoundTimerAction(formData: FormData) {
  const roundId = String(formData.get("round_id") ?? "");
  if (!roundId) return;
  const supabase = await createClient();
  await supabase.rpc("resume_round_timer", { p_round: roundId });
  revalidateSessionViews();
}

export async function clearRoundTimerAction(formData: FormData) {
  const roundId = String(formData.get("round_id") ?? "");
  if (!roundId) return;
  const supabase = await createClient();
  await supabase.rpc("clear_round_timer", { p_round: roundId });
  revalidateSessionViews();
}
