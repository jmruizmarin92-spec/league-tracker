// How a player is rendered in pairings, standings, etc.:
//   Alias · FirstName L.
// Falls back gracefully when the optional name fields are empty.
export function pairingName(p: {
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const alias = p.display_name?.trim() || "—";
  const first = p.first_name?.trim();
  const last = p.last_name?.trim();

  const parts: string[] = [];
  if (first) parts.push(first);
  if (last) parts.push(`${last[0].toUpperCase()}.`);
  const real = parts.join(" ");

  return real ? `${alias} · ${real}` : alias;
}
