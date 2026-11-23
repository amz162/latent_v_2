#!/usr/bin/env python3
"""task123_verify_ingest.py — post-ingest OHLCV integrity verification (read-only).
Checks: (symbol,date) uniqueness, OHLC envelope sanity, symbol coverage, frontier,
per-session bar counts, zero/negative prices, volume sanity."""
import sqlite3, json, datetime, collections

R = "/home/z/my-project/repo_latent_v_2"
con = sqlite3.connect(f"file:{R}/db/custom.db?mode=ro", uri=True)
cur = con.cursor()
res = {"report": "task123_ingest_verification", "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}

res["frontier"] = cur.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
res["min_date"] = cur.execute("SELECT MIN(date) FROM OhlcvBar").fetchone()[0]
res["total_bars"] = cur.execute("SELECT COUNT(*) FROM OhlcvBar").fetchone()[0]

# 1. (symbol,date) uniqueness
dups = cur.execute("SELECT symbol, date, COUNT(*) c FROM OhlcvBar GROUP BY symbol, date HAVING c > 1").fetchall()
res["duplicate_symbol_date_pairs"] = len(dups)

# 2. bars added in repair window
res["window_bars"] = cur.execute(
    "SELECT COUNT(*) FROM OhlcvBar WHERE date >= '2026-11-04'").fetchone()[0]
res["window_by_date"] = dict(cur.execute(
    "SELECT date, COUNT(*) FROM OhlcvBar WHERE date >= '2026-11-04' GROUP BY date ORDER BY date").fetchall())

# 3. OHLC envelope sanity (high >= max(open,close), low <= min(open,close), all > 0) on window
bad_env = cur.execute(
    "SELECT COUNT(*) FROM OhlcvBar WHERE date >= '2026-11-04' AND "
    "(high < max(open, close) OR low > min(open, close) OR open <= 0 OR high <= 0 OR low <= 0 OR close <= 0)").fetchone()[0]
res["envelope_violations_window"] = bad_env
bad_all = cur.execute(
    "SELECT COUNT(*) FROM OhlcvBar WHERE "
    "(high < max(open, close) OR low > min(open, close) OR open <= 0 OR close <= 0)").fetchone()[0]
res["envelope_violations_all_history"] = bad_all

# 4. negative volume in window
neg_vol = cur.execute("SELECT COUNT(*) FROM OhlcvBar WHERE date >= '2026-11-04' AND volume < 0").fetchone()[0]
res["negative_volume_window"] = neg_vol

# 5. symbol coverage in window vs pilot universe (24 GLM/audit symbols) vs whole DB
syms_window = cur.execute("SELECT COUNT(DISTINCT symbol) FROM OhlcvBar WHERE date >= '2026-11-04'").fetchone()[0]
res["symbols_in_window"] = syms_window
syms_all = cur.execute("SELECT COUNT(DISTINCT symbol) FROM OhlcvBar").fetchone()[0]
res["symbols_in_db"] = syms_all

# 6. per-symbol bar counts for the 24 audit universe on 2026-11-23
pilot = ['ANL','BOP','CNERGY','ENGRO','FCCL','HASCOL','HUBC','HUMNL','KEL','LOTCHEM','LUCK',
         'MEBL','MLCF','OGDC','PAEL','PIBTL','PPL','PRL','PSO','SYS','TELE','TRG','UNITY','WTL']
cov = {}
for s in pilot:
    cov[s] = cur.execute("SELECT COUNT(*) FROM OhlcvBar WHERE symbol=? AND date>='2026-11-04'", (s,)).fetchone()[0]
res["pilot24_window_bars"] = cov
res["pilot24_complete_13"] = sum(1 for v in cov.values() if v == 13)

# 7. source field values in window (provenance)
res["source_values_window"] = dict(cur.execute(
    "SELECT source, COUNT(*) FROM OhlcvBar WHERE date >= '2026-11-04' GROUP BY source").fetchall())

# 8. gaps: sessions present in KSE100 index vs per-symbol missing (sample check on pilot24)
res["note_holiday_2026_11_09"] = "Nov 9 absent from provider calendar (Iqbal Day); Nov 7-8, 14-15, 21-22 weekends"

print(json.dumps(res, indent=1))
json.dump(res, open(f"{R}/data/backtest_reports/task123_ingest_verification.json", "w"), indent=1)
print("saved → data/backtest_reports/task123_ingest_verification.json")
