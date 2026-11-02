/**
 * Task 102 — point-in-time fundamental record schema and as-of query.
 *
 * HONESTY CONTRACT (Task 102 spec, Phase 3):
 *  - A financial statement is NOT available on its accounting-period end date
 *    unless it was genuinely published then.
 *  - Availability uses the publication timestamp when known. When ONLY a
 *    publication DATE is known (PSX announcements carry day granularity), the
 *    record becomes available conservatively at 17:00 PKT that day — i.e. it
 *    may influence decisions from the NEXT trading session onward.
 *  - Amendments retain version history; as-of queries return the version in
 *    force at the requested cutoff, never a later filing.
 *  - Records without any publication information stay `unavailable`; they are
 *    never backfilled with period-end dates.
 */

export const PKT_TZ_OFFSET_MIN = 300; // UTC+5 (Pakistan Standard Time)
export const CONSERVATIVE_PUBLICATION_HOUR_PK = 17;

export type PitDataQuality =
  | "verified"
  | "partially_verified"
  | "unavailable"
  | "amended_superseded";

export interface PitFundamentalRecord {
  symbol: string;
  periodStart: string | null; // accounting period start (may be unknown)
  periodEnd: string | null; // accounting period end (NOT availability)
  publicationDatetime: string | null; // ISO instant, genuine publication
  publicationSource: string | null;
  sourceDocumentId: string | null;
  retrievalDatetime: string;
  filingType: string;
  isAmended: boolean;
  amendmentDatetime: string | null;
  currency: string;
  unit: string;
  dataQualityStatus: PitDataQuality;
  values: Record<string, number | null>; // statement values / ratios
}

/** Conservative availability instant for a known publication DATE (day
 *  granularity): 17:00 PKT on that date. */
export function conservativePublicationInstant(publicationDate: string): string {
  // Construct 17:00 PKT (= 12:00 UTC) on the given date.
  const d = publicationDate.slice(0, 10);
  return new Date(`${d}T12:00:00.000Z`).toISOString();
}

/** True when the record was genuinely available for a decision at `cutoff`. */
export function isAvailableAsOf(rec: PitFundamentalRecord, cutoff: Date): boolean {
  if (!rec.publicationDatetime) return false; // unknown -> never guessed
  const avail = new Date(rec.publicationDatetime);
  return avail.getTime() <= cutoff.getTime();
}

/**
 * getFundamentalsAsOf — returns the fundamental values genuinely available for
 * `symbol` at `decisionTimestamp`:
 *  - only records whose publication instant <= cutoff,
 *  - when several versions coexist, the LATEST available version wins,
 *  - amended records replace earlier versions ONLY after their amendment time,
 *  - returns `null` when nothing verifiable was available (callers must treat
 *    that as "feature unavailable", never as zero).
 */
export function getFundamentalsAsOf(
  symbol: string,
  decisionTimestamp: Date,
  records: PitFundamentalRecord[],
): PitFundamentalRecord | null {
  const candidates = records.filter(
    (r) => r.symbol === symbol && isAvailableAsOf(r, decisionTimestamp),
  );
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      new Date(a.publicationDatetime!).getTime() -
      new Date(b.publicationDatetime!).getTime(),
  );
  const latest = candidates[candidates.length - 1];
  // amended records must not leak before their amendmentDatetime
  if (latest.isAmended && latest.amendmentDatetime) {
    if (new Date(latest.amendmentDatetime).getTime() > decisionTimestamp.getTime()) {
      const prior = candidates.filter((r) => !r.isAmended);
      return prior.length ? prior[prior.length - 1] : null;
    }
  }
  return latest;
}

/** Normalizes a raw filing announcement (date-only) into a PIT record. */
export function filingToPitRecord(input: {
  symbol: string;
  filingDate: string; // genuine PSX announcement date (day granularity)
  sourceDocumentId?: string | null;
  filingType: string;
  isAmended?: boolean;
  amendmentDatetime?: string | null;
}): PitFundamentalRecord {
  return {
    symbol: input.symbol,
    periodStart: null,
    periodEnd: null,
    publicationDatetime: conservativePublicationInstant(input.filingDate),
    publicationSource: "PSX_DPS_announcement",
    sourceDocumentId: input.sourceDocumentId ?? null,
    retrievalDatetime: new Date().toISOString(),
    filingType: input.filingType,
    isAmended: input.isAmended ?? false,
    amendmentDatetime: input.amendmentDatetime ?? null,
    currency: "PKR",
    unit: "unknown",
    dataQualityStatus: "partially_verified",
    values: {},
  };
}
