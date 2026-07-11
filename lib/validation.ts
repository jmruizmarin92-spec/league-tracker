// Trim and cap free-text input server-side (client maxLength is UX only —
// a direct API call bypasses it, so every action re-caps on the server).
export function capText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

// Same as capText, but returns null for empty strings (for nullable columns).
export function capTextOrNull(value: string, maxLen: number): string | null {
  const capped = capText(value, maxLen);
  return capped === "" ? null : capped;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
