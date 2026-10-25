// Sector normalization — single source of truth.
//
// Issue: "also don't use the Conglomerate beside this add that stock in other
// category". PSX's real sector taxonomy (from pypsx /Company.sector) includes
// "Conglomerate" / "Conglomerates" as a bucket. Per the user's instruction
// that bucket must NOT appear as its own category — any stock labelled
// "Conglomerate(s)" is folded into "Others" everywhere a sector is shown
// (Tracker donut + rows, Portfolio rows, etc.).
//
// Empty / missing sectors also collapse to "Others" so the UI never renders
// a blank or "Unknown" slice. The lookup is case-insensitive and trims
// whitespace; "Conglomerate", "Conglomerates", " conglomerate " all map to
// "Others". All other sector names pass through unchanged.

const CONGLOMERATE_RE = /^\s*conglomerates?\s*$/i;

export function normalizeSector(sector: string | null | undefined): string {
  const s = (sector ?? "").trim();
  if (!s) return "Others";
  if (CONGLOMERATE_RE.test(s)) return "Others";
  return s;
}
