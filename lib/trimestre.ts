import { TZ } from "@/lib/format";

// A league's year is split into 4 fixed 3-month quarters, numbered starting
// in July (matches how leagues here run their season): 1=jul-sep, 2=oct-dic,
// 3=ene-mar, 4=abr-jun.
export type Trimestre = 1 | 2 | 3 | 4;
export const ALL_TRIMESTRES: Trimestre[] = [1, 2, 3, 4];

export function trimestreOf(iso: string | null): Trimestre | null {
  if (!iso) return null;
  const month = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "numeric" }).format(
      new Date(iso),
    ),
  ); // 1-12
  if (month >= 7 && month <= 9) return 1;
  if (month >= 10 && month <= 12) return 2;
  if (month >= 1 && month <= 3) return 3;
  return 4; // 4, 5, 6
}

export function currentTrimestre(): Trimestre {
  return trimestreOf(new Date().toISOString())!;
}
