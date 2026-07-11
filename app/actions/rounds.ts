"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getSessionMatches,
  getActiveParticipantIds,
} from "@/lib/rounds";
import { computeStandings, type MatchInput } from "@/lib/scoring";
import { generateSwissPairings, pairKey } from "@/lib/pairing";

export async function generateRoundAction(formData: FormData) {
  const sessionId = String(formData.get("session_id") ?? "");
  if (!sessionId) return;

  const [matches, activeIds] = await Promise.all([
    getSessionMatches(sessionId),
    getActiveParticipantIds(sessionId),
  ]);

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

  // Order active players by standings.
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

  const pairings = generateSwissPairings(ordered, played, hadBye);

  const supabase = await createClient();
  await supabase.rpc("create_round", {
    p_session: sessionId,
    p_pairings: pairings,
  });
  revalidatePath(`/sessions/${sessionId}`);
}

export async function reportMatchAction(formData: FormData) {
  const sessionId = String(formData.get("session_id") ?? "");
  const matchId = String(formData.get("match_id") ?? "");
  const result = String(formData.get("result") ?? "");
  const supabase = await createClient();
  await supabase.rpc("report_match", { p_match: matchId, p_result: result });
  revalidatePath(`/sessions/${sessionId}`);
}

export async function deleteRoundAction(formData: FormData) {
  const sessionId = String(formData.get("session_id") ?? "");
  const roundId = String(formData.get("round_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("delete_round", { p_round: roundId });
  revalidatePath(`/sessions/${sessionId}`);
}
