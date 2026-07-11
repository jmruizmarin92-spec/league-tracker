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

// Accepts "" | "YYYY-MM" | "YYYY-MM-DD" (from an <input type="month"> or a
// pre-built ISO date) and returns a full date string or null.
export function toMonthDate(value: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
