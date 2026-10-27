#!/usr/bin/env python3
"""Latent.pk — Walk-Forward Ensemble Backtesting

Gold standard validation: for each test sample, re-train models on ALL data before
that point (expanding window), then predict. No data leakage.

Trains 5 fast classical models per sample:
  XGBoost, LightGBM, CatBoost, Random Forest, Ridge Regression

Computes 4 ensemble methods on walk-forward predictions:
  A. Majority Vote
  B. Probability-Weighted (avgReturn)
  C. Tier-Weighted
  D. Win-Rate-Weighted (uses walk-forward win rates as weights)

Compares walk-forward ensemble vs individual models.
"""
import json,sys,warnings,numpy as np,pandas as pd
import hashlib,shutil
import os as _os
import sqlite3 as _sqlite3
# ML-integrity helpers (leakage-free targets, chronological split). See
# scripts/ml_integrity.py. Replaces the old .fillna(0) targets + global row
# split=int(len(df)*0.8) on the concatenated df.
from ml_integrity import (
    add_forward_returns, drop_immature_targets, chronological_split,
    add_target_maturity_dates, filter_by_target_maturity,
    HORIZONS, MAX_HORIZON,
)
import xgboost as xgb,lightgbm as lgb,catboost as cb
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from pathlib import Path
warnings.filterwarnings("ignore")

OHLCV=Path("data/ohlcv")
PRED_FILE=Path("data/ml_predictions_multi.json")
OUT_FILE=Path("data/walk_forward_backtesting.json")
# NEW (Task 49): structured walk-forward report artifact — separate from
# ml_predictions_multi.json (which we must NOT modify). The API route
# /api/backtest/walk-forward reads this file.
# Task 51: write to a CANDIDATE artifact first, validate, then promote to
# walk_forward_latest.json (preserving the old as walk_forward_previous.json).
REPORT_DIR=Path("data/backtest_reports")
REPORT_FILE=REPORT_DIR/"walk_forward_latest.json"
REPORT_CANDIDATE_FILE=REPORT_DIR/"walk_forward_candidate.json"
REPORT_PREVIOUS_FILE=REPORT_DIR/"walk_forward_previous.json"
# Task 54 — resumable chunked runs: one directory per run under runs/<run_id>/
# holding manifest.json (immutable config), samples/ (one atomic record per
# evaluation sample), checkpoint.json and progress.json. A partial run NEVER
# touches walk_forward_latest.json — only a fully-complete + validated
# finalization promotes.
RUNS_DIR=REPORT_DIR/"runs"
REPORT_SCHEMA_VERSION="1.3"  # 1.0→1.1 (Task 51), →1.2 (Task 52), →1.3 (Task 54: point-in-time selection + resumable chunks + purged frozen weights)
STOCKS=["ENGRO","HUBC","LUCK","SYS","MEBL","PSO","OGDC","PPL"]
# Task 52 — deterministic universe selector. The canonical8 are CSV-backed
# (data/ohlcv/*.csv). pilot25/pilot50/full_db modes read the OhlcvBar table
# in db/custom.db (908 stocks, 1M+ bars) — the CSV directory only has the 8.
# Task 54 (Phase 1) — POINT-IN-TIME selection: eligibility + the liquidity
# ranking use ONLY OhlcvBar records with date <= the selection cutoff. The
# cutoff is fixed strictly before the first evaluation decision date, so the
# evaluation-period volume/returns can never influence which stocks are tested.
DB_PATH=Path("db/custom.db")
MIN_BARS_FOR_UNIVERSE=250  # ~1 trading year — eligibility cutoff for DB-backed modes


def _query_global_dates(db_path=DB_PATH):
 """All distinct OhlcvBar dates (ISO strings, sorted). Used to fix the
 point-in-time selection cutoff BEFORE any universe is chosen."""
 if not db_path.exists():
  return []
 conn=_sqlite3.connect(str(db_path))
 try:
  rows=conn.execute("SELECT DISTINCT date FROM OhlcvBar ORDER BY date").fetchall()
 finally:
  conn.close()
 return [r[0] for r in rows]


def _universe_candidates_asof(db_path, cutoff_str):
 """Task 54 Phase 1 — point-in-time candidacy: per-symbol bar counts and total
 volume computed ONLY from OhlcvBar rows with date <= cutoff. Deterministic
 sort: pre-cutoff volume desc, then symbol asc as tiebreaker."""
 conn=_sqlite3.connect(str(db_path))
 try:
  rows=conn.execute(
   "SELECT symbol, COUNT(*) AS bars, MIN(date) AS first_date, MAX(date) AS last_date, "
   "SUM(volume) AS total_volume FROM OhlcvBar WHERE date <= ? GROUP BY symbol",
   (cutoff_str,),
  ).fetchall()
 finally:
  conn.close()
 out=[{"symbol":r[0],"bars":r[1],"first_date":r[2],"last_date":r[3],
       "total_volume":float(r[4] or 0)} for r in rows]
 out.sort(key=lambda s:(-s["total_volume"],s["symbol"]))
 return out


def _universe_fingerprint(mode,cutoff_str,symbols):
 """Stable fingerprint of the frozen universe (mode + cutoff + exact symbols)."""
 h=hashlib.sha256()
 h.update(f"{mode}|{cutoff_str}|".encode())
 h.update(",".join(symbols).encode())
 return h.hexdigest()


def select_universe_asof(mode,cutoff_str):
 """Task 54 Phase 1 — point-in-time selection. Eligibility (>= MIN_BARS bars)
 and the liquidity ranking use ONLY records available on or before the cutoff.
 Modes: pilot25 / pilot50 / full_db (canonical8 is a fixed list and never
 reaches this function). Returns (symbols, metadata)."""
 cands=_universe_candidates_asof(DB_PATH,cutoff_str)
 eligible=[c for c in cands if c["bars"]>=MIN_BARS_FOR_UNIVERSE]
 excluded=[
  {"symbol":c["symbol"],"reason":"insufficient_history_asof_cutoff",
   "bars_asof_cutoff":c["bars"],"min_required":MIN_BARS_FOR_UNIVERSE}
  for c in cands if c["bars"]<MIN_BARS_FOR_UNIVERSE
 ]
 target={"pilot25":25,"pilot50":50,"full_db":len(eligible)}[mode]
 eligible_syms={c["symbol"] for c in eligible}
 selected=[]
 # canonical8 first (if eligible as of the cutoff), then fill by pre-cutoff rank
 for s in STOCKS:
  if s in eligible_syms and s not in selected:
   selected.append(s)
 for c in eligible:
  if c["symbol"] not in selected and len(selected)<target:
   selected.append(c["symbol"])
 selected=selected[:target]
 meta={
  "mode":mode,
  "criteria":(f"canonical8 (if eligible as of cutoff) + top {max(0,target-8)} by "
              f"PRE-CUTOFF total volume (liquidity proxy), >= {MIN_BARS_FOR_UNIVERSE} bars "
              "as of the selection cutoff — evaluation-period volume excluded"),
  "selection_method":"point_in_time_volume_ranking",
  "selection_cutoff":cutoff_str,
  "candidate_count":len(cands),
  "eligible_count":len(eligible),
  "included_count":len(selected),
  "excluded_count":len(excluded),
  "exclusions":excluded,
  "target_count":target,
  "min_bars_required":MIN_BARS_FOR_UNIVERSE,
  "data_source":f"db/custom.db OhlcvBar table ({mode}); eligibility+ranking from records with date <= {cutoff_str} only",
  "selected_asof":{c["symbol"]:{"bars_asof_cutoff":c["bars"],"volume_asof_cutoff":c["total_volume"]}
                   for c in cands if c["symbol"] in selected},
  "fingerprint":_universe_fingerprint(mode,cutoff_str,selected),
 }
 return selected,meta


def resolve_universe(mode):
 """Task 54 — resolve the evaluation universe.

 canonical8: fixed symbol list (no ranking → no selection look-ahead is
 possible). The selection cutoff is recorded AFTER the split as a verification
 fact (evaluation decision dates are strictly after it by construction).

 DB-backed modes: point-in-time FIXPOINT —
   1. provisional cutoff = the global session immediately before the global
      65th-percentile session (mirrors chronological_split's 50/15/35 boundary),
   2. select the universe using ONLY pre-cutoff records,
   3. estimate the pooled test-window start for that universe,
   4. if the estimated test start is NOT strictly after the cutoff, move the
      cutoff to the session immediately before it and retry (max 5),
   5. main() then ASSERTS on the real loaded split that every evaluation
      decision date is strictly after the cutoff — a violation is a hard
      error, never a silent continue.
 """
 if mode=="canonical8":
  return list(STOCKS),{
   "mode":"canonical8",
   "criteria":"hardcoded canonical 8 PSX stocks (CSV-backed, most-liquid historically)",
   "selection_method":"fixed_symbol_list (no volume ranking — no selection look-ahead possible)",
   "selection_cutoff":None,
   "candidate_count":len(STOCKS),
   "eligible_count":len(STOCKS),
   "included_count":len(STOCKS),
   "excluded_count":0,
   "exclusions":[],
   "target_count":len(STOCKS),
   "min_bars_required":None,
   "data_source":"data/ohlcv/*.csv",
   "fingerprint":_universe_fingerprint("canonical8","fixed",list(STOCKS)),
  }
 if mode not in ("pilot25","pilot50","full_db"):
  raise ValueError(f"unknown WALK_FORWARD_UNIVERSE mode: {mode}")
 global_dates=_query_global_dates()
 if len(global_dates)<100:
  raise RuntimeError("DB has too few distinct dates for a point-in-time universe selection")
 idx=int(len(global_dates)*0.65)
 cutoff=global_dates[max(idx-1,0)]
 for iteration in range(1,6):
  symbols,meta=select_universe_asof(mode,cutoff)
  if not symbols:
   raise RuntimeError(f"point-in-time selection produced an empty universe at cutoff {cutoff}")
  # lightweight estimate of the pooled test-window start for THIS universe
  conn=_sqlite3.connect(str(DB_PATH))
  try:
   q=",".join("?"*len(symbols))
   rows=conn.execute(
    f"SELECT DISTINCT date FROM OhlcvBar WHERE symbol IN ({q}) ORDER BY date",
    symbols).fetchall()
  finally:
   conn.close()
  pooled=[r[0] for r in rows]
  est_idx=int(len(pooled)*0.65)
  if est_idx>=len(pooled):
   raise RuntimeError("pooled date set too small to estimate the test window")
  est_test_start=pooled[est_idx]
  if est_test_start>cutoff:
   meta["selection_iterations"]=iteration
   meta["estimated_test_start"]=est_test_start
   return symbols,meta
  # move the cutoff to the session immediately before the estimated test start
  prev_idx=est_idx-1
  if prev_idx<0:
   raise RuntimeError("cannot move the selection cutoff earlier — no session remains before the estimated test window")
  cutoff=pooled[prev_idx]
 raise RuntimeError(
  "point-in-time universe selection did not converge within 5 iterations — "
  "refusing to continue with a potentially look-ahead-biased selection")
FC=["rsi_14","macd","macd_signal","macd_hist","bb_width","bb_pct_b","atr_14","obv_change_pct",
"price_sma_20_ratio","price_sma_50_ratio","price_sma_200_ratio","volume_sma_20_ratio",
"return_1d","return_7d","return_14d","return_30d","hl_range_pct","body_size_pct","volatility_14d"]
MODEL_NAMES=["XGBoost","LightGBM","CatBoost","Random Forest","Ridge Regression"]
TIER_W={"XGBoost":0.25,"LightGBM":0.25,"CatBoost":0.25,"Random Forest":0.25,"Ridge Regression":0.15}

def compute_rsi(p,n=14):
 d=p.diff();g=d.where(d>0,0);ll=-d.where(d<0,0)
 ag=g.ewm(alpha=1/n,min_periods=n).mean();al=ll.ewm(alpha=1/n,min_periods=n).mean()
 return(100-100/(1+ag/al.replace(0,np.nan))).fillna(50)
def compute_macd(p):
 e12=p.ewm(span=12,adjust=False).mean();e26=p.ewm(span=26,adjust=False).mean()
 m=e12-e26;s=m.ewm(span=9,adjust=False).mean();return m,s,m-s
def compute_bb(p,w=20):
 sma=p.rolling(w).mean();sd=p.rolling(w).std()
 return((sma+2*sd-(sma-2*sd))/sma).fillna(0),((p-(sma-2*sd))/(4*sd).replace(0,np.nan)).fillna(0.5)
def compute_atr(h,l,c,n=14):
 tr=pd.concat([h-l,(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1)
 return tr.rolling(n).mean().fillna(0)
def compute_obv(c,v):
 s=c.diff().apply(lambda x:1 if x>0 else(-1 if x<0 else 0));return(s*v).cumsum()
def add_features(df):
 df=df.copy().sort_values("date").reset_index(drop=True)
 c=df["close"];h=df["high"];l=df["low"];v=df["volume"]
 df["rsi_14"]=compute_rsi(c);m,s,hh=compute_macd(c)
 df["macd"]=m;df["macd_signal"]=s;df["macd_hist"]=hh
 bw,pb=compute_bb(c);df["bb_width"]=bw;df["bb_pct_b"]=pb
 df["atr_14"]=compute_atr(h,l,c)
 obv=compute_obv(c,v);df["obv_change_pct"]=obv.pct_change(periods=14).replace([np.inf,-np.inf],0).fillna(0)
 for w in[20,50,200]:df[f"price_sma_{w}_ratio"]=c/c.rolling(w,min_periods=1).mean()
 df["volume_sma_20_ratio"]=v/v.rolling(20,min_periods=1).mean().replace(0,1)
 for p in[1,7,14,30]:df[f"return_{p}d"]=c.pct_change(periods=p).replace([np.inf,-np.inf],0).fillna(0)
 df["hl_range_pct"]=((h-l)/c.replace(0,np.nan)).fillna(0)
 df["body_size_pct"]=((df["close"]-df["open"]).abs()/c.replace(0,np.nan)).fillna(0)
 df["volatility_14d"]=c.pct_change().rolling(14).std().fillna(0)
 # ML integrity (Phase A1): target construction MOVED OUT of add_features —
 # done in load() via add_forward_returns (per-stock groupby shift, no .fillna(0)).
 return df

def load(stocks=None, source="csv"):
 """Load OHLCV data. CSV source reads data/ohlcv/{symbol}.csv (canonical8 only —
 the directory holds 8 files). DB source reads the OhlcvBar table in
 db/custom.db (pilot25/pilot50/full_db modes). Both produce the same DataFrame
 shape (date as epoch ms int, open/high/low/close/volume + features)."""
 if stocks is None:
  stocks=STOCKS
 frames=[]
 if source=="csv":
  for s in stocks:
   p=OHLCV/f"{s}.csv"
   if not p.exists():continue
   df=pd.read_csv(p,usecols=range(6));df=df[df["volume"]>0].reset_index(drop=True)
   if len(df)<50:continue
   df=add_features(df);df["symbol"]=s;frames.append(df)
 else:  # db
  conn=_sqlite3.connect(str(DB_PATH))
  try:
   for s in stocks:
    rows=conn.execute(
     "SELECT date, open, high, low, close, volume FROM OhlcvBar "
     "WHERE symbol=? ORDER BY date",(s,)
    ).fetchall()
    if len(rows)<50:continue
    df=pd.DataFrame(rows,columns=["date","open","high","low","close","volume"])
    df=df[df["volume"]>0].reset_index(drop=True)
    if len(df)<50:continue
    # YYYY-MM-DD -> epoch ms (matches CSV format; tz-stable, monotonic per stock)
    df["date"]=pd.to_datetime(df["date"],utc=True).astype("int64")//10**6
    df=add_features(df);df["symbol"]=s;frames.append(df)
  finally:
   conn.close()
 df=pd.concat(frames,ignore_index=True) if frames else pd.DataFrame()
 if df.empty:return df
 # ML integrity (Task 1): per-stock forward returns via groupby(symbol).shift
 # (no cross-stock shift, no .fillna(0)); immature rows are LEFT NaN. The
 # walk-forward loop (main()) drops immature per-sample via dropna on the
 # specific horizon target being trained.
 df=add_forward_returns(df)
 # Task 51: per-stock target-maturity timestamps — adds `target_maturity_{h}d`
 # columns (the date h sessions forward per stock). Used by
 # filter_by_target_maturity() in the walk-forward loop to exclude training
 # rows whose target endpoint extends past the prediction timestamp
 # (target-maturity leakage fix — see ml_integrity.filter_by_target_maturity).
 df=add_target_maturity_dates(df)
 return df

def train_one_model(name, Xtr, ytr):
 """Train a single model on the given training data."""
 if name=="XGBoost":
  m=xgb.XGBRegressor(n_estimators=100,max_depth=3,learning_rate=0.05,subsample=0.7,colsample_bytree=0.7,random_state=42)
 elif name=="LightGBM":
  m=lgb.LGBMRegressor(n_estimators=100,num_leaves=15,learning_rate=0.01,subsample=0.8,colsample_bytree=0.8,min_child_samples=20,reg_alpha=0.5,reg_lambda=2.0,random_state=42,verbose=-1)
 elif name=="CatBoost":
  m=cb.CatBoostRegressor(iterations=100,depth=3,learning_rate=0.05,random_state=42,verbose=0,allow_writing_files=False)
 elif name=="Random Forest":
  from sklearn.ensemble import RandomForestRegressor
  m=RandomForestRegressor(n_estimators=100,max_depth=5,min_samples_leaf=15,max_features=0.7,random_state=42,n_jobs=-1)
 elif name=="Ridge Regression":
  m=Ridge(alpha=1.0,random_state=42)
 m.fit(Xtr,ytr)
 return m

# ═════════════════════════════════════════════════════════════════════════════
# Task 54 — resumable, chunked, point-in-time walk-forward architecture
#
#   Phase 2: deterministic sample chunks (WALK_FORWARD_CHUNK_SIZE /
#            WALK_FORWARD_RUN_ID / WALK_FORWARD_RESUME). Chunks split the
#            evaluation SAMPLES only — every sample always trains on the FULL
#            frozen universe pooled by date + target-maturity filter.
#   Phase 3: durable checkpointing under data/backtest_reports/runs/<run_id>/
#            (manifest.json immutable, samples/ one atomic record per sample,
#            checkpoint.json + progress.json). Crash mid-sample → that sample
#            re-runs; completed samples are never duplicated.
#   Phase 4: ensemble predictions are computed ONLY at finalization with
#            frozen validation weights that PURGE validation outcomes whose
#            21d target matures after the earliest final-test decision date.
#   Phase 5: the final report is recomputed from the raw per-sample records
#            (never by averaging chunk-level aggregates) and promoted only
#            after the FULL run completes and passes validation. Partial runs
#            never touch walk_forward_latest.json.
# ═════════════════════════════════════════════════════════════════════════════

def iso(ms):
 """Convert epoch-ms int dates to ISO for the report schema."""
 try:
  return pd.Timestamp(int(ms), unit="ms").isoformat()
 except Exception:
  return None


def _json_default(o):
 if isinstance(o,(np.integer,)):return int(o)
 if isinstance(o,(np.floating,)):return None if np.isnan(o) else float(o)
 if isinstance(o,float) and np.isnan(o):return None
 if isinstance(o,np.ndarray):return o.tolist()
 return str(o)


def _atomic_write_json(path,obj):
 """Corruption-safe persistence: write to a tmp file in the same directory,
 then os.replace (atomic on POSIX). A crash mid-write never corrupts the
 previous file."""
 path.parent.mkdir(parents=True,exist_ok=True)
 tmp=path.with_name(path.name+".tmp")
 tmp.write_text(json.dumps(obj,indent=2,default=_json_default))
 _os.replace(tmp,path)


def compute_data_fingerprint(df):
 """Deterministic fingerprint of the loaded evaluation dataset: per symbol
 (sorted) the row count + first/last date + rounded open/close/volume bytes.
 Any change to the underlying data changes the fingerprint → a running
 chunked run's manifest no longer matches and resume is REFUSED."""
 h=hashlib.sha256()
 for sym in sorted(df["symbol"].unique().tolist()):
  sub=df[df["symbol"]==sym].sort_values("date")
  h.update(sym.encode())
  h.update(f"|{len(sub)}|{int(sub['date'].min())}|{int(sub['date'].max())}".encode())
  for col in ("open","close","volume"):
   h.update(np.round(sub[col].astype(float).values,6).tobytes())
 return h.hexdigest()


def build_sample_list(df,eval_stocks,sample_step):
 """Deterministic, globally ordered evaluation samples: one unique
 (symbol, decision_date) pair each, ordered by (universe order, date asc).
 Same construction as before (test-partition rows, every sample_step sessions,
 need >=21 forward sessions for the 21d horizon). Also records each sample's
 21d target-maturity date (used by the Phase 4 weight purge)."""
 samples=[]
 for s in eval_stocks:
  ste=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
  for i in range(0,len(ste)-21,sample_step):
   row=ste.iloc[i]
   future_close=ste.iloc[min(i+21,len(ste)-1)]["close"]
   actual_return=(future_close-row["close"])/row["close"]
   tm21=row.get("target_maturity_21d")
   samples.append({
    "stock":s,
    "date":row["date"],
    "close":float(row["close"]),
    "features":row[FC].values.astype(np.float64),
    "actual_return_21d":float(actual_return),
    "actual_5d":float((ste.iloc[min(i+5,len(ste)-1)]["close"]-row["close"])/row["close"]),
    "actual_10d":float((ste.iloc[min(i+10,len(ste)-1)]["close"]-row["close"])/row["close"]),
    "actual_21d":float(actual_return),
    "target_maturity_21d":(int(tm21) if tm21 is not None and pd.notna(tm21) else None),
   })
 for idx,smp in enumerate(samples):
  smp["sample_idx"]=idx
  smp["sample_id"]=f"{smp['stock']}@{int(smp['date'])}"
 # Task 54: GLOBAL DATE ORDERING — the sample list is sorted by decision date
 # (symbol asc as tiebreaker) so the VALIDATION half covers the EARLIER test
 # dates and the FINAL-TEST half covers the LATER ones. This makes the
 # validation→final-test boundary a genuine time boundary, which the Phase 4
 # maturity purge requires (validation outcomes maturing after the earliest
 # final-test decision date are purged). The sample SET is unchanged — only
 # the order — so all pooled per-model metrics are identical; the ensemble
 # val/final-test composition is now time-based.
 samples.sort(key=lambda s:(int(s["date"]),s["stock"]))
 for idx,smp in enumerate(samples):
  smp["sample_idx"]=idx
 return samples


def process_sample(idx,sample,df,fc=None,model_names=None):
 """Process ONE evaluation sample: train 5 models × 3 horizons on all data
 strictly before the sample's decision date (per-horizon target-maturity
 filter applied) and return a durable per-sample record. A pure function of
 (df, sample) — no run state — so a resumed sample reproduces exactly. The
 training-only baseline mean per horizon is computed here (it depends on the
 training data at this sample) and stored for finalization."""
 fc=fc or FC
 model_names=model_names or MODEL_NAMES
 rec={
  "sample_idx":idx,
  "sample_id":sample["sample_id"],
  "stock":sample["stock"],
  "date":int(sample["date"]),
  "close":float(sample["close"]),
  "actual_5d":float(sample["actual_5d"]),
  "actual_10d":float(sample["actual_10d"]),
  "actual_21d":float(sample["actual_return_21d"]),
  "target_maturity_21d":sample.get("target_maturity_21d"),
  "status":"evaluated",
  "per_horizon_meta":{},
  "training_only_baseline":{},
  "models":{},
 }
 train_data=df[df["date"]<sample["date"]]
 if len(train_data)<100:
  rec["status"]="skipped"
  rec["skip_reason"]=f"insufficient pooled training rows before decision date (have {len(train_data)}, need >=100)"
  rec["models"]={name:{"status":"skipped"} for name in model_names}
  rec["n_model_fits"]=0
  return rec
 rec["train_cutoff_date"]=int(train_data["date"].max())
 # Per-horizon target-maturity filter — computed ONCE per (sample, horizon)
 # and reused for both the metadata + the per-model training (identical call,
 # cached to avoid 15x duplication; results are bit-identical).
 td_cache={}
 per_horizon_meta={}
 tbo={}
 for hz in [5,10,21]:
  td_h=filter_by_target_maturity(train_data,sample["date"],horizon=hz)
  td_cache[hz]=td_h
  per_horizon_meta[hz]={
   "latest_train_feature_date":int(td_h["date"].max()) if len(td_h)>0 else None,
   "latest_target_maturity_date":int(td_h[f"target_maturity_{hz}d"].max()) if len(td_h)>0 else None,
   "n_train_rows":len(td_h),
  }
  # training-only baseline mean at this sample+horizon (pooled market-wide;
  # filter_by_target_maturity excludes the sample's own immature target)
  if len(td_h)>=50:
   tbo[hz]={"mean":float(td_h[f"target_{hz}d"].mean()),"n_obs":int(len(td_h))}
 rec["per_horizon_meta"]=per_horizon_meta
 rec["training_only_baseline"]=tbo
 for name in model_names:
  entry={"horizon_preds":{},"n_fits":0}
  try:
   r5=r10=r21=0.0
   eval_skipped={5:False,10:False,21:False}
   for hz_col,hz in [("target_5d",5),("target_10d",10),("target_21d",21)]:
    td=td_cache[hz]
    if len(td)<50:  # not enough mature rows for this horizon
     pred=0.0
     eval_skipped[hz]=True
    else:
     Xtr=td[fc].values.astype(np.float64);ytr=td[hz_col].values.astype(np.float64)
     model=train_one_model(name,Xtr,ytr)
     pred=float(model.predict(sample["features"].reshape(1,-1))[0])
     entry["n_fits"]+=1
    entry["horizon_preds"][str(hz)]={
     "predicted":float(pred),
     "actual":float(sample.get(f"actual_{hz}d",sample["actual_return_21d"])),
     "eval_skipped":bool(eval_skipped[hz]),
    }
    if hz==5:r5=pred
    elif hz==10:r10=pred
    else:r21=pred
   avg=(r5+r10+r21)/3
   sig="BUY"if avg>0.01 else"SELL"if avg<-0.01 else"HOLD"
   actual=sample["actual_return_21d"]
   correct=(sig=="BUY"and actual>0)or(sig=="SELL"and actual<0)
   entry.update({
    "signal":sig,"avgReturn":float(avg),"actual_return":float(actual),
    "correct":bool(correct),"r5":float(r5),"r10":float(r10),"r21":float(r21),
    "eval_skipped_5d":bool(eval_skipped[5]),
    "eval_skipped_10d":bool(eval_skipped[10]),
    "eval_skipped_21d":bool(eval_skipped[21]),
   })
  except Exception as e:
   entry.update({
    "signal":"HOLD","avgReturn":0.0,"actual_return":float(sample["actual_return_21d"]),
    "correct":False,"r5":0.0,"r10":0.0,"r21":0.0,
    "eval_skipped_5d":True,"eval_skipped_10d":True,"eval_skipped_21d":True,
    "error":str(e)[:200],
   })
  rec["models"][name]=entry
 rec["n_model_fits"]=sum(e.get("n_fits",0) for e in rec["models"].values())
 return rec


# ─── run-state helpers (Phase 3) ─────────────────────────────────────────────

def _sanitize_run_id(run_id):
 if not run_id or len(run_id)>80 or run_id.startswith("."):
  raise ValueError(f"invalid WALK_FORWARD_RUN_ID {run_id!r}")
 if not all(c.isalnum() or c in "-_." for c in run_id):
  raise ValueError(f"invalid WALK_FORWARD_RUN_ID {run_id!r}: use [A-Za-z0-9_.-] only")
 return run_id


def _run_dir(run_id):
 return RUNS_DIR/run_id


def write_manifest(run_dir,manifest):
 _atomic_write_json(run_dir/"manifest.json",manifest)


def load_manifest(run_dir):
 p=run_dir/"manifest.json"
 if not p.exists():return None
 try:
  return json.loads(p.read_text())
 except Exception:
  return None


def write_sample_record(run_dir,rec):
 _atomic_write_json(run_dir/"samples"/f"sample_{rec['sample_idx']:06d}.json",rec)


def scan_completed_samples(run_dir):
 """Source of truth for completion = the per-sample record files (each is
 written atomically AFTER the sample fully completes). A corrupt/truncated
 file (crash mid-write) is removed and treated as not-complete so that exact
 sample re-runs. Never duplicates: one file per sample index."""
 sdir=run_dir/"samples"
 completed={}
 if not sdir.exists():
  return completed
 for p in sorted(sdir.glob("sample_*.json")):
  try:
   idx=int(p.stem.split("_")[1])
   rec=json.loads(p.read_text())
   if rec.get("sample_idx")!=idx:
    raise ValueError("sample_idx mismatch")
   completed[idx]=rec
  except Exception:
   try:p.unlink()
   except Exception:pass
 return completed


def write_checkpoint(run_dir,completed_idxs):
 _atomic_write_json(run_dir/"checkpoint.json",{
  "completed_sample_idxs":sorted(completed_idxs),
  "n_completed":len(completed_idxs),
  "updated_at":pd.Timestamp.now("UTC").isoformat(),
 })


def write_progress(run_dir,manifest,records_by_idx,status):
 fits=sum(r.get("n_model_fits",0) for r in records_by_idx.values())
 _atomic_write_json(run_dir/"progress.json",{
  "run_id":manifest["run_id"],
  "universe_mode":manifest["universe_mode"],
  "universe_fingerprint":manifest["universe"]["fingerprint"],
  "data_fingerprint":manifest["data_fingerprint"],
  "total_samples":manifest["n_samples"],
  "completed_samples":len(records_by_idx),
  "remaining_samples":manifest["n_samples"]-len(records_by_idx),
  "model_fits_completed":fits,
  "status":status,
  "updated_at":pd.Timestamp.now("UTC").isoformat(),
  "honesty_note":("progress only — NO forecast metrics until status=complete; "
                  "the completed-evaluation report lives at "
                  "data/backtest_reports/walk_forward_latest.json"),
 })


def build_resume_command(manifest,chunk_size):
 parts=[f"WALK_FORWARD_UNIVERSE={manifest['universe_mode']}",
        f"WALK_FORWARD_RUN_ID={manifest['run_id']}",
        "WALK_FORWARD_RESUME=1"]
 if chunk_size>0:parts.append(f"WALK_FORWARD_CHUNK_SIZE={chunk_size}")
 return " ".join(parts)+" python3 scripts/walk_forward_backtesting.py"


# ─── finalization (Phases 4 + 5) ─────────────────────────────────────────────

def finalize_run(run_dir,manifest,records,no_promote=False,candidate_path=None):
 """Aggregate the completed per-sample records into the final structured
 report. EVERY metric is recomputed from the raw per-sample predictions and
 realized outcomes — never by averaging chunk-level aggregates. Ensemble
 predictions are computed ONLY here, with frozen validation weights that
 PURGE validation outcomes maturing after the final-test boundary (Phase 4).
 Promotion (candidate → validate → latest, preserving previous) happens only
 when the FULL run is complete and every check passes."""
 candidate_path=Path(candidate_path) if candidate_path else REPORT_CANDIDATE_FILE
 model_names=manifest["model_names"]
 n_samples=manifest["n_samples"]
 val_end_idx=manifest["val_end_idx"]
 sample_step=manifest["sample_step"]
 eval_stocks=manifest["universe"]["symbols"]
 universe_meta=manifest["universe"]

 # ── Phase 5 verification: every expected sample present exactly once ──
 missing=[i for i in range(n_samples) if i not in records]
 if missing:
  raise RuntimeError(f"finalization refused: {len(missing)} sample record(s) missing (first few: {missing[:5]})")
 ordered=[records[i] for i in range(n_samples)]
 for rec in ordered:
  if rec["status"]=="evaluated":
   for name,entry in rec["models"].items():
    for hzs,hp in entry["horizon_preds"].items():
     if not hp["eval_skipped"] and hp.get("actual") is None:
      raise RuntimeError(f"finalization refused: sample {rec['sample_idx']} {name} {hzs} has no realized outcome")

 # ── rebuild the pre-Task-54 in-memory structures from the raw records ──
 per_model_per_horizon={name:{5:[],10:[],21:[]} for name in model_names}
 training_only_baseline_means={5:[],10:[],21:[]}
 all_predictions={name:[] for name in model_names}
 sample_dates_seen=[]
 train_cutoff_dates_seen=[]
 sample_maturity_metadata=[]
 n_skipped_samples=0
 for rec in ordered:
  if rec["status"]!="evaluated":
   n_skipped_samples+=1
   continue
  idx=rec["sample_idx"]
  sample_dates_seen.append(rec["date"])
  if rec.get("train_cutoff_date") is not None:
   train_cutoff_dates_seen.append(rec["train_cutoff_date"])
  sample_maturity_metadata.append({
   "sample_date":rec["date"],"stock":rec["stock"],
   "per_horizon":{int(k):v for k,v in rec["per_horizon_meta"].items()},
  })
  for hz in [5,10,21]:
   # tolerant key lookup: on-disk records have string keys (JSON round-trip),
   # in-memory single-invocation records have int keys
   tbo=rec["training_only_baseline"].get(str(hz)) or rec["training_only_baseline"].get(hz)
   if tbo:
    training_only_baseline_means[hz].append({
     "sample_idx":idx,"mean":tbo["mean"],"n_obs":tbo["n_obs"],
     "actual_at_sample":rec[f"actual_{hz}d"],
    })
  for name in model_names:
   entry=rec["models"][name]
   for hz in [5,10,21]:
    hp=entry["horizon_preds"][str(hz)]
    if not hp["eval_skipped"]:
     per_model_per_horizon[name][hz].append({
      "predicted":hp["predicted"],"actual":hp["actual"],
      "stock":rec["stock"],"date":rec["date"],"sample_idx":idx,
     })
   all_predictions[name].append({
    "stock":rec["stock"],"signal":entry["signal"],"avgReturn":entry["avgReturn"],
    "actual_return":entry["actual_return"],"correct":entry["correct"],
    "r5":entry["r5"],"r10":entry["r10"],"r21":entry["r21"],
    "eval_skipped_5d":entry["eval_skipped_5d"],
    "eval_skipped_10d":entry["eval_skipped_10d"],
    "eval_skipped_21d":entry["eval_skipped_21d"],
    "sample_idx":idx,
   })

 # ── individual model walk-forward (trading proxy) — same formulas as before ──
 print("\n\nComputing individual model walk-forward results...")
 wf_individual={}
 for name in model_names:
  preds=all_predictions[name]
  trades=[p for p in preds if p["signal"]!="HOLD"]
  wins=[p for p in trades if p["correct"]]
  rets=[p["actual_return"] if p["signal"]=="BUY" else -p["actual_return"] for p in trades]
  tt=len(trades);wr=len(wins)/max(tt,1)*100
  ar_=float(np.mean(rets))*100 if rets else 0
  wf_individual[name]={
   "totalTrades":int(tt),"wins":int(len(wins)),
   "winRate":round(float(wr),1),"avgReturnPct":round(float(ar_),2),
   "maxReturnPct":round(float(max(rets)*100)if rets else 0,2),
   "minReturnPct":round(float(min(rets)*100)if rets else 0,2),
   "stars":int(min(5,max(1,int(wr/20)+1))),
   "trading_metrics_label":"gross directional-return proxy (signed forward 21d return, NO commission/slippage/CGT/position-sizing deducted)",
   "net_trading_pnl":"unavailable",
   "net_trading_pnl_reason":"Genuine trade-execution simulator (entry/exit dates, commission, slippage, CGT, position sizing) is NOT connected to the walk-forward script. See src/lib/latent/investment-simulator.ts.",
  }
  print(f"  {name}: trades={tt} winRate={wr:.1f}% avgReturn={ar_:.2f}% stars={'★'*int(min(5,max(1,int(wr/20)+1)))}")

 # ── ensembles — computed ONLY at finalization (Phase 4) ──
 print("\nComputing ensemble walk-forward results...")
 pred_by_idx={name:{p["sample_idx"]:p for p in all_predictions[name]} for name in model_names}
 ensemble_by_idx={m:{} for m in ("MAJORITY_VOTE","PROBABILITY_WEIGHTED","TIER_WEIGHTED","WIN_RATE_WEIGHTED")}

 # Phase 4: frozen validation weights WITH maturity purge.
 # Boundary = the earliest final-test DECISION date. A validation outcome whose
 # 21d target matures AFTER that boundary was not yet knowable in real time at
 # the moment final-test decisions begin → purged from the weight calibration.
 final_test_dates=[s["date"] for s in manifest["sample_meta"][val_end_idx:]]
 earliest_final_test_date=min(final_test_dates) if final_test_dates else None
 purge_stats={
  "boundary_rule":"validation outcomes whose 21d target maturity > earliest final-test decision date are purged",
  "earliest_final_test_decision_date":iso(earliest_final_test_date) if earliest_final_test_date else None,
  "earliest_final_test_decision_date_epoch":int(earliest_final_test_date) if earliest_final_test_date else None,
  "per_model":{},
 }
 frozen_weights={}
 for name in model_names:
  val_entries=[(idx,p) for idx,p in pred_by_idx[name].items() if idx<val_end_idx]
  vt_total=[p for _,p in val_entries if p["signal"]!="HOLD"]
  eligible=[]
  purged=0
  purged_unknown=0
  for idx,p in val_entries:
   if p["signal"]=="HOLD":continue
   tm=records[idx].get("target_maturity_21d")
   if tm is None:
    purged_unknown+=1  # unknown maturity → conservatively excluded
    continue
   if earliest_final_test_date is not None and tm>earliest_final_test_date:
    purged+=1
    continue
   eligible.append(p)
  vw=[p for p in eligible if p["correct"]]
  v_wr=len(vw)/max(len(eligible),1)*100 if eligible else 0
  if v_wr<30:frozen_weights[name]=0.0
  elif v_wr>50:frozen_weights[name]=1.0
  else:frozen_weights[name]=(v_wr-30)/20
  purge_stats["per_model"][name]={
   "validation_non_hold_outcomes":len(vt_total),
   "eligible_after_purge":len(eligible),
   "purged_maturity_after_boundary":purged,
   "purged_unknown_maturity":purged_unknown,
   "validation_win_rate_pct":round(v_wr,2),
   "frozen_weight":round(float(frozen_weights[name]),4),
  }
 print(f"  Frozen WIN_RATE_WEIGHTED weights (validation [0..{val_end_idx-1}] AFTER maturity purge vs boundary {purge_stats['earliest_final_test_decision_date']}):")
 for n,w in frozen_weights.items():
  print(f"    {n}: weight={w:.3f} (eligible {purge_stats['per_model'][n]['eligible_after_purge']}/{purge_stats['per_model'][n]['validation_non_hold_outcomes']} outcomes)")

 for i in range(n_samples):
  sample_preds={name:pred_by_idx[name][i] for name in model_names if i in pred_by_idx[name]}
  if not sample_preds:continue
  actual=sample_preds[model_names[0]]["actual_return"]
  is_validation_period=(i<val_end_idx)

  # A. Majority Vote (per-sample — safe)
  buys=sum(1 for p in sample_preds.values()if p["signal"]=="BUY")
  sells=sum(1 for p in sample_preds.values()if p["signal"]=="SELL")
  holds=sum(1 for p in sample_preds.values()if p["signal"]=="HOLD")
  if buys>sells and buys>holds:sig="BUY"
  elif sells>buys and sells>holds:sig="SELL"
  else:sig="HOLD"
  ensemble_by_idx["MAJORITY_VOTE"][i]={"signal":sig,"actual_return":actual,"period":"validation" if is_validation_period else "final-test"}

  # B. Probability-Weighted (per-sample — safe)
  avg_ret=np.mean([p["avgReturn"]for p in sample_preds.values()])
  sig2="BUY"if avg_ret>0.01 else"SELL"if avg_ret<-0.01 else"HOLD"
  ensemble_by_idx["PROBABILITY_WEIGHTED"][i]={"signal":sig2,"actual_return":actual,"period":"validation" if is_validation_period else "final-test"}

  # C. Tier-Weighted (per-sample, STATIC weights — safe)
  ws=sum(p["avgReturn"]*TIER_W.get(n,0.2)for n,p in sample_preds.items())
  wt=sum(TIER_W.get(n,0.2)for n in sample_preds)
  wr_=ws/wt if wt>0 else 0
  sig3="BUY"if wr_>0.01 else"SELL"if wr_<-0.01 else"HOLD"
  ensemble_by_idx["TIER_WEIGHTED"][i]={"signal":sig3,"actual_return":actual,"period":"validation" if is_validation_period else "final-test"}

  # D. Win-Rate-Weighted (Task 51 Option A + Task 54 maturity purge)
  if is_validation_period:
   ensemble_by_idx["WIN_RATE_WEIGHTED"][i]={
    "signal":"HOLD","actual_return":actual,"period":"validation",
    "status":"unavailable",
    "reason":("Validation period — WIN_RATE_WEIGHTED weights are being "
              f"calibrated from samples [0..{val_end_idx-1}]. Apply frozen "
              "weights only to final-test samples."),
   }
  else:
   weighted_buy=weighted_sell=total_w=0
   for n,p in sample_preds.items():
    weight=frozen_weights.get(n,0.0)
    if weight>0:
     total_w+=weight
     if p["signal"]=="BUY":weighted_buy+=p["avgReturn"]*weight
     elif p["signal"]=="SELL":weighted_sell+=p["avgReturn"]*weight
   wr_avg=(weighted_buy+weighted_sell)/total_w if total_w>0 else 0
   sig4="BUY"if wr_avg>0.01 else"SELL"if wr_avg<-0.01 else"HOLD"
   ensemble_by_idx["WIN_RATE_WEIGHTED"][i]={"signal":sig4,"actual_return":actual,"period":"final-test","status":"ok"}

 # Final consensus (dual-mode; index-correct via ensemble_by_idx)
 for i in sorted(ensemble_by_idx["MAJORITY_VOTE"].keys()):
  is_validation_period=(i<val_end_idx)
  if is_validation_period:
   votes=[ensemble_by_idx["MAJORITY_VOTE"][i]["signal"],
          ensemble_by_idx["PROBABILITY_WEIGHTED"][i]["signal"],
          ensemble_by_idx["TIER_WEIGHTED"][i]["signal"]]
  else:
   votes=[ensemble_by_idx["MAJORITY_VOTE"][i]["signal"],
          ensemble_by_idx["PROBABILITY_WEIGHTED"][i]["signal"],
          ensemble_by_idx["TIER_WEIGHTED"][i]["signal"],
          ensemble_by_idx["WIN_RATE_WEIGHTED"][i]["signal"]]
  buy_v=sum(1 for v in votes if v=="BUY")
  sell_v=sum(1 for v in votes if v=="SELL")
  if buy_v>=2:sig="BUY"
  elif sell_v>=2:sig="SELL"
  else:sig="HOLD"
  actual=ensemble_by_idx["MAJORITY_VOTE"][i]["actual_return"]
  ensemble_by_idx.setdefault("FINAL_CONSENSUS",{})[i]={"signal":sig,"actual_return":actual,"period":"validation" if is_validation_period else "final-test"}

 # ensemble trading stats (same formulas; unavailable entries excluded)
 wf_ensemble={}
 for method in ("MAJORITY_VOTE","PROBABILITY_WEIGHTED","TIER_WEIGHTED","WIN_RATE_WEIGHTED","FINAL_CONSENSUS"):
  preds=list(ensemble_by_idx[method].values())
  eligible=[p for p in preds if p.get("status","ok")=="ok"]
  trades=[p for p in eligible if p["signal"]!="HOLD"]
  wins=[p for p in trades if(p["signal"]=="BUY"and p["actual_return"]>0)or(p["signal"]=="SELL"and p["actual_return"]<0)]
  rets=[p["actual_return"] if p["signal"]=="BUY" else -p["actual_return"] for p in trades]
  tt=len(trades);wr=len(wins)/max(tt,1)*100
  ar_=float(np.mean(rets))*100 if rets else 0
  wf_ensemble[method]={
   "totalTrades":int(tt),"wins":int(len(wins)),
   "winRate":round(float(wr),1),"avgReturnPct":round(float(ar_),2),
   "maxReturnPct":round(float(max(rets)*100)if rets else 0,2),
   "minReturnPct":round(float(min(rets)*100)if rets else 0,2),
   "stars":int(min(5,max(1,int(wr/20)+1))),
   "trading_metrics_label":"gross directional-return proxy (signed forward return, NO commission/slippage/CGT deducted)",
   "net_trading_pnl":"unavailable",
   "net_trading_pnl_reason":"Genuine trade-execution simulator (entry/exit dates, commission, slippage, CGT, position sizing) is NOT connected to the walk-forward script. The 'avgReturnPct' above is a signed forward-return proxy, not net P&L. See src/lib/latent/investment-simulator.ts for the genuine trade simulator used elsewhere in the app.",
   "n_validation_period_excluded":int(sum(1 for p in preds if p.get("status")=="unavailable")),
  }
  print(f"  {method}: trades={tt} winRate={wr:.1f}% avgReturn={ar_:.2f}% stars={'★'*int(min(5,max(1,int(wr/20)+1)))} "
        f"(validation-period excluded: {wf_ensemble[method]['n_validation_period_excluded']})")

 # ── forecast-quality metrics per model × horizon (same formulas) ──
 print("\n\nComputing forecast-quality metrics (MAE / RMSE / R² / directional accuracy)...")
 per_stock_results={}
 wf_forecast={}
 unevaluated=[]
 for hz in [5,10,21]:
  pass  # horizon_actuals no longer needed (baselines are built per model below)
 for name in model_names:
  wf_forecast[name]={}
  for hz in [5,10,21]:
   pairs=per_model_per_horizon[name][hz]
   if len(pairs)<2:
    reason=(f"insufficient matured samples at horizon {hz}d "
            f"(have {len(pairs)}, need ≥2)")
    wf_forecast[name][hz]={"status":"unavailable","reason":reason,
                           "n_observations":len(pairs)}
    unevaluated.append({"model":name,"horizon":hz,"reason":reason})
    continue
   pred_arr=np.array([p["predicted"] for p in pairs],dtype=np.float64)
   actual_arr=np.array([p["actual"] for p in pairs],dtype=np.float64)
   mae=float(mean_absolute_error(actual_arr,pred_arr))
   rmse=float(np.sqrt(mean_squared_error(actual_arr,pred_arr)))
   if len(actual_arr)>1 and actual_arr.std()>0:
    r2=float(r2_score(actual_arr,pred_arr))
   else:
    r2=float("nan")
   dir_acc=float(np.mean(np.sign(pred_arr)==np.sign(actual_arr)))
   # Baseline 1: zero-return
   zero_pred=np.zeros_like(actual_arr)
   zero_mae=float(mean_absolute_error(actual_arr,zero_pred))
   zero_rmse=float(np.sqrt(mean_squared_error(actual_arr,zero_pred)))
   if len(actual_arr)>1 and actual_arr.std()>0:
    zero_r2=float(r2_score(actual_arr,zero_pred))
   else:
    zero_r2=float("nan")
   zero_dir_acc=float(np.mean(np.sign(zero_pred)==np.sign(actual_arr)))
   # Baseline 2: training-only mean (positional alignment — both lists are
   # built in ascending sample-idx order over the same maturity condition)
   tbo=training_only_baseline_means.get(hz,[])
   if len(tbo)==len(pairs):
    tbo_pred=np.array([t["mean"] for t in tbo],dtype=np.float64)
    tbo_mae=float(mean_absolute_error(actual_arr,tbo_pred))
    tbo_rmse=float(np.sqrt(mean_squared_error(actual_arr,tbo_pred)))
    if len(actual_arr)>1 and actual_arr.std()>0:
     tbo_r2=float(r2_score(actual_arr,tbo_pred))
    else:
     tbo_r2=float("nan")
    tbo_dir_acc=float(np.mean(np.sign(tbo_pred)==np.sign(actual_arr)))
    tbo_n_obs=int(np.mean([t["n_obs"] for t in tbo]))
    tbo_status="completed"
    tbo_reason=None
   else:
    tbo_pred=None
    tbo_mae=tbo_rmse=tbo_r2=tbo_dir_acc=None
    tbo_n_obs=0
    tbo_status="unavailable"
    tbo_reason=(f"training-only baseline not aligned with eval pairs "
                f"(have {len(tbo)} training means for {len(pairs)} eval pairs)")
   # Conventional constant-mean baseline (R² reference)
   cm_pred=np.full_like(actual_arr,actual_arr.mean())
   cm_mae=float(mean_absolute_error(actual_arr,cm_pred))
   cm_rmse=float(np.sqrt(mean_squared_error(actual_arr,cm_pred)))
   if len(actual_arr)>1 and actual_arr.std()>0:
    cm_r2=float(r2_score(actual_arr,cm_pred))
   else:
    cm_r2=float("nan")
   wf_forecast[name][hz]={
    "status":"completed",
    "mae":round(mae,6),
    "rmse":round(rmse,6),
    "r2":None if np.isnan(r2) else round(r2,6),
    "directional_accuracy":round(dir_acc,4),
    "n_observations":len(pairs),
    "baselines":{
     "constant_mean":{"definition":"predict mean(actual_eval) for all samples — this is the R² reference, NOT a deployable forecasting strategy",
                      "mae":round(cm_mae,6),"rmse":round(cm_rmse,6),
                      "r2":None if np.isnan(cm_r2) else round(cm_r2,6)},
     "zero_return":{"definition":"predict 0.0 for all samples — no-trade baseline",
                    "mae":round(zero_mae,6),"rmse":round(zero_rmse,6),
                    "r2":None if np.isnan(zero_r2) else round(zero_r2,6),
                    "directional_accuracy":round(zero_dir_acc,4)},
     "training_only_mean":{"definition":"per-sample predict the mean of matured training targets (pooled market-wide, excludes the sample's own target)",
                           "status":tbo_status,"reason":tbo_reason,
                           "mae":round(tbo_mae,6) if tbo_mae is not None else None,
                           "rmse":round(tbo_rmse,6) if tbo_rmse is not None else None,
                           "r2":None if (tbo_r2 is None or np.isnan(tbo_r2)) else round(tbo_r2,6),
                           "directional_accuracy":round(tbo_dir_acc,4) if tbo_dir_acc is not None else None,
                           "avg_n_training_observations":tbo_n_obs},
    },
   }
   r2_str="NaN" if np.isnan(r2) else f"{r2:+.4f}"
   print(f"  {name} {hz}d: n={len(pairs)} MAE={mae:.6f} RMSE={rmse:.6f} R²={r2_str} DirAcc={dir_acc:.4f} | "
         f"zero-R²={zero_r2:+.4f} | train-mean-R²={'NaN' if (tbo_r2 is None or np.isnan(tbo_r2)) else f'{tbo_r2:+.4f}'}")

 # ── per-stock forecast metrics (Task 52; recomputed from raw records) ──
 print("\nComputing per-stock forecast metrics...")
 stocks_with_preds=set(
  p["stock"] for name in model_names for hz in [5,10,21]
  for p in per_model_per_horizon[name][hz]
 )
 for sym in sorted(eval_stocks):
  per_stock_results[sym]={"samples_count":0,"models":{}}
  sym_dates_seen=set()
  if sym not in stocks_with_preds:
   for name in model_names:
    per_stock_results[sym]["models"][name]={}
    for hz in [5,10,21]:
     per_stock_results[sym]["models"][name][hz]={
      "status":"unavailable",
      "reason":"no test samples in the evaluation window for this stock (CSV ends before the pooled test partition, or < 21 sessions after the last sample)",
      "n_observations":0,
     }
   continue
  for name in model_names:
   per_stock_results[sym]["models"][name]={}
   for hz in [5,10,21]:
    pairs=[p for p in per_model_per_horizon[name][hz] if p["stock"]==sym]
    for p in pairs:
     sym_dates_seen.add(p["date"])
    if len(pairs)<2:
     per_stock_results[sym]["models"][name][hz]={
      "status":"unavailable",
      "reason":f"insufficient matured samples (have {len(pairs)}, need >=2)",
      "n_observations":len(pairs),
     }
     continue
    pa=np.array([p["predicted"] for p in pairs],dtype=np.float64)
    aa=np.array([p["actual"] for p in pairs],dtype=np.float64)
    ps_mae=float(mean_absolute_error(aa,pa))
    ps_rmse=float(np.sqrt(mean_squared_error(aa,pa)))
    ps_r2=float(r2_score(aa,pa)) if len(aa)>1 and aa.std()>0 else float("nan")
    ps_dir=float(np.mean(np.sign(pa)==np.sign(aa)))
    per_stock_results[sym]["models"][name][hz]={
     "status":"completed",
     "mae":round(ps_mae,6),
     "rmse":round(ps_rmse,6),
     "r2":None if np.isnan(ps_r2) else round(ps_r2,6),
     "directional_accuracy":round(ps_dir,4),
     "n_observations":len(pairs),
    }
  per_stock_results[sym]["samples_count"]=len(sym_dates_seen)
 print(f"  per-stock metrics computed for {len(per_stock_results)} stocks")

 # ── report assembly (schema 1.3) ──
 evaluation_status="completed" if all(
  wf_forecast.get(name,{}).get(hz,{}).get("status")=="completed"
  for name in model_names for hz in [5,10,21]
 ) else ("partial" if any(
  wf_forecast.get(name,{}).get(hz,{}).get("status")=="completed"
  for name in model_names for hz in [5,10,21]
 ) else "failed")

 eval_start=iso(min(sample_dates_seen)) if sample_dates_seen else None
 eval_end=iso(max(sample_dates_seen)) if sample_dates_seen else None
 train_cutoff=iso(max(train_cutoff_dates_seen)) if train_cutoff_dates_seen else None
 train_floor=iso(min(train_cutoff_dates_seen)) if train_cutoff_dates_seen else None

 structured_report={
  "schema_version":REPORT_SCHEMA_VERSION,
  "evaluation_status":evaluation_status,
  "evaluation_method":"walk-forward-expanding-window",
  "generated_at":pd.Timestamp.now().isoformat(),
  "data_cutoff":train_cutoff,
  "training_window":{"start":train_floor,"end":train_cutoff},
  "evaluation_date_range":{"start":eval_start,"end":eval_end},
  "evaluated_symbols":sorted(eval_stocks),
  "universe_size":len(eval_stocks),
  "universe":universe_meta,
  "per_stock_results":per_stock_results,
  "forecast_horizons":[5,10,21],
  "n_unique_stock_date_samples":n_samples,
  "n_model_fits":sum(r.get("n_model_fits",0) for r in ordered),
  "n_unique_prediction_dates":len(set(int(d) for d in sample_dates_seen)),
  "sampling_interval_sessions":sample_step,
  "n_evaluated_models":len(model_names),
  "n_evaluated_horizons":3,
  "n_eligible_samples":n_samples,
  "n_skipped_samples":n_skipped_samples,
  "n_matured_outcomes":{
   str(hz):sum(1 for name in model_names for p in per_model_per_horizon[name][hz])
   for hz in [5,10,21]
  },
  "n_incomplete_or_excluded_outcomes":{
   str(hz):sum(1 for name in model_names for p in all_predictions[name]
               if p.get(f"eval_skipped_{hz}d",False))
   for hz in [5,10,21]
  },
  "models":[
   {
    "name":name,
    "implementation_type":"trained-ml",
    "horizons":{
     str(hz):wf_forecast[name].get(hz,{"status":"unavailable"})
     for hz in [5,10,21]
    },
   } for name in model_names
  ],
  "baselines":{
   "per_horizon_pooled":{
    str(hz):{
     "zero_return":(wf_forecast[model_names[0]].get(hz,{}) or {}).get("baselines",{}).get("zero_return",{"status":"unavailable"}) if wf_forecast.get(model_names[0],{}).get(hz,{}).get("status")=="completed" else {"status":"unavailable"},
     "training_only_mean":(wf_forecast[model_names[0]].get(hz,{}) or {}).get("baselines",{}).get("training_only_mean",{"status":"unavailable"}) if wf_forecast.get(model_names[0],{}).get(hz,{}).get("status")=="completed" else {"status":"unavailable"},
    } for hz in [5,10,21]
   },
   "notes":(
    "Conventional R² reference = constant-mean (predict mean(actual_eval) for all — R²=0 by construction). "
    "Task 51 Phase 3 adds TWO deployable prediction baselines: "
    "(1) zero-return (predict 0 — measures whether forecasting beats a no-trade strategy), "
    "(2) training-only mean (per-sample, predict the mean of matured training targets for this horizon — "
    "pooled market-wide across all stocks; uses filter_by_target_maturity to exclude the sample's own target). "
    "A negative model R² vs constant-mean means the model did worse than the eval-set mean; "
    "compare against zero-return + training-only-mean baselines for actual deployable-skill assessment."
   ),
  },
  "trading_metrics":{
   "individual":wf_individual,
   "ensemble":wf_ensemble,
   "label":"gross directional-return proxy",
   "definition":"Per-trade return = signed forward 21-day return (BUY: actual_return; SELL: -actual_return). NO commission, slippage, CGT, or position-sizing applied.",
   "net_trading_pnl":"unavailable",
   "net_trading_pnl_reason":"Genuine trade-execution simulator (entry/exit dates, commission 0.15%×2, slippage 0.15%, CGT 15% on gains, position sizing, portfolio compounding) is NOT connected to the walk-forward script. The 'avgReturnPct' values above are signed forward-return proxies, NOT net P&L. See src/lib/latent/investment-simulator.ts for the genuine trade simulator used elsewhere in the app (Tracker → Investment Simulator).",
  },
  "win_rate_weighted_ensemble_methodology":{
   "phase_2_fix":"Option A — frozen validation-period weights",
   "task54_maturity_purge":purge_stats,
   "description":(
    "Task 51 Phase 2: split samples into first half (VALIDATION) + second half (FINAL_TEST). "
    "Compute win rates on VALIDATION only → freeze weights → apply to FINAL_TEST. VALIDATION-period "
    "WIN_RATE_WEIGHTED entries are marked 'unavailable — validation period (weights being calibrated)'. "
    "FINAL_CONSENSUS on validation: 2+ of {MAJORITY, PROBABILITY, TIER} agree (skip WIN_RATE_WEIGHTED). "
    "FINAL_CONSENSUS on final-test: 2+ of {MAJORITY, PROBABILITY, TIER, WIN_RATE_WEIGHTED} agree. "
    "Task 54 Phase 4: validation outcomes whose 21d target matures AFTER the earliest final-test "
    "decision date are PURGED from the weight calibration (their outcomes were not knowable in real "
    "time at the final-test boundary). Weights are computed at finalization only — never from "
    "partial or complete final-test results, and never inside a chunk."
   ),
   "validation_period_indices":[0,val_end_idx-1],
   "final_test_period_indices":[val_end_idx,n_samples-1] if n_samples>val_end_idx else [],
   "frozen_weights":frozen_weights,
  },
  "sample_maturity_metadata_summary":{
   "n_samples_logged":len(sample_maturity_metadata),
   "first_sample":{
    "sample_date":iso(sample_maturity_metadata[0]["sample_date"]) if sample_maturity_metadata else None,
    "stock":sample_maturity_metadata[0]["stock"] if sample_maturity_metadata else None,
    "per_horizon":{
     str(hz):{
      "latest_train_feature_date":iso(sample_maturity_metadata[0]["per_horizon"][hz]["latest_train_feature_date"]) if sample_maturity_metadata and sample_maturity_metadata[0]["per_horizon"][hz]["latest_train_feature_date"] else None,
      "latest_target_maturity_date":iso(sample_maturity_metadata[0]["per_horizon"][hz]["latest_target_maturity_date"]) if sample_maturity_metadata and sample_maturity_metadata[0]["per_horizon"][hz]["latest_target_maturity_date"] else None,
      "n_train_rows":sample_maturity_metadata[0]["per_horizon"][hz]["n_train_rows"] if sample_maturity_metadata else 0,
     } for hz in [5,10,21]
    },
   } if sample_maturity_metadata else None,
   "last_sample":{
    "sample_date":iso(sample_maturity_metadata[-1]["sample_date"]) if sample_maturity_metadata else None,
    "stock":sample_maturity_metadata[-1]["stock"] if sample_maturity_metadata else None,
    "per_horizon":{
     str(hz):{
      "latest_train_feature_date":iso(sample_maturity_metadata[-1]["per_horizon"][hz]["latest_train_feature_date"]) if sample_maturity_metadata and sample_maturity_metadata[-1]["per_horizon"][hz]["latest_train_feature_date"] else None,
      "latest_target_maturity_date":iso(sample_maturity_metadata[-1]["per_horizon"][hz]["latest_target_maturity_date"]) if sample_maturity_metadata and sample_maturity_metadata[-1]["per_horizon"][hz]["latest_target_maturity_date"] else None,
      "n_train_rows":sample_maturity_metadata[-1]["per_horizon"][hz]["n_train_rows"] if sample_maturity_metadata else 0,
     } for hz in [5,10,21]
    },
   } if sample_maturity_metadata else None,
   "verification":"For each sample, latest_target_maturity_date <= sample_date (no target-maturity leak)",
  },
  "run":{
   "architecture":"task54-resumable-chunked",
   "run_id":manifest["run_id"],
   "manifest_path":str(run_dir/"manifest.json"),
   "created_at":manifest["created_at"],
   "chunk_size_requested":manifest["chunk_size_requested"],
   "resumable":True,
   "point_in_time_selection":universe_meta.get("selection_method"),
   "universe_selection_cutoff":universe_meta.get("selection_cutoff"),
   "universe_fingerprint":manifest["universe"]["fingerprint"],
   "data_fingerprint":manifest["data_fingerprint"],
   "sample_records_dir":str(run_dir/"samples"),
   "promotion_rule":"only a FULLY-complete run whose candidate passes validation replaces walk_forward_latest.json; partial runs never touch it",
  },
  "limitations":[
   f"Universe mode = {universe_meta.get('mode')}: {universe_meta.get('included_count', len(eval_stocks))} stock(s) evaluated ({', '.join(sorted(eval_stocks))}). {universe_meta.get('criteria','')}. Candidate universe = {universe_meta.get('candidate_count', len(eval_stocks))} stocks; excluded {universe_meta.get('excluded_count', 0)} for insufficient history. NOT a fully production-validated benchmark.",
   ("Task 54 Phase 1: the universe was selected POINT-IN-TIME — eligibility + liquidity ranking use only records on or before the selection cutoff "
    f"({universe_meta.get('selection_cutoff') or 'n/a for fixed-list canonical8'}), which is strictly before every evaluation decision date. "
    "Evaluation-period volume/returns did NOT influence the selection."),
   "5 classical models evaluated (XGBoost, LightGBM, CatBoost, Random Forest, Ridge Regression). The other ~60 registered models are NOT evaluated here — see scripts/walk_forward_backtesting.py MODEL_NAMES.",
   "Per-sample retraining on data[date < sample.date] (expanding window). No data leakage.",
   "Task 51 Phase 1: filter_by_target_maturity ensures training rows' target endpoint (T+h) <= sample's prediction date P. Per-horizon, per-stock, pooled across stocks.",
   "R² can be negative — that's honest (model did not outperform the constant-mean baseline on this test). Compare against zero-return + training-only-mean baselines for actual deployable-skill assessment.",
   "Directional accuracy = fraction of samples where sign(predicted) == sign(actual). A value >50% is NOT proven predictive skill without considering sample size, baseline, serial dependence, and uncertainty.",
   f"OVERLAPPING FORECAST WINDOWS: samples are {sample_step} trading days apart per stock, but the 21-day return windows at adjacent samples OVERLAP by 11 sessions. Outcomes are NOT independent — uncertainty estimates must use date-blocked resampling (NOT naive standard errors).",
   f"Total unique (stock, decision-date) samples = {n_samples}; total model fits = {sum(r.get('n_model_fits',0) for r in ordered)} (up to {len(model_names)} models × 3 horizons per sample). Do NOT describe {n_samples} as 'samples per stock'.",
   "Trading metrics are GROSS directional-return proxies (signed forward 21-day return, NO commission/slippage/CGT/position-sizing). Net trading P&L is unavailable. See src/lib/latent/investment-simulator.ts for the genuine trade simulator used in the Tracker.",
   "Task 54 Phase 4: WIN_RATE_WEIGHTED uses frozen validation-period weights with a MATURITY PURGE (validation outcomes maturing after the earliest final-test decision date are excluded). Weights are computed only at finalization — never inside a chunk, never from final-test results.",
   "Task 54 Phase 5: this report was recomputed from the raw per-sample records in the run directory — never by averaging chunk-level metrics. A partial run never publishes a report.",
   "Training-only-mean baseline pools matured training targets across all stocks (market-wide mean). Per-stock means are NOT computed because most stocks have insufficient historical observations per horizon for a stable per-stock mean.",
  ],
  "unevaluated":unevaluated,
  "ml_integrity":{
   "target_construction":"per-stock groupby(symbol).shift(-h) via add_forward_returns; no .fillna(0); immature rows left NaN",
   "target_maturity_filter":"Task 51 Phase 1: filter_by_target_maturity excludes training rows whose target endpoint (T+h) > prediction date P. Per-horizon, per-stock, pooled. Distinct from drop_immature_targets (which only removes rows whose target VALUE is NaN).",
   "test_partition":"date-based chronological_split test partition (NOT global row split=int(len*0.8)) — all rows on a given test date belong to the test partition",
   "per_sample_training":"per-sample train_data = df[df['date']<sample['date']] (strict chronological, no look-ahead) + filter_by_target_maturity(hz) per horizon",
   "per_horizon_drop":"per-sample, per-horizon filter_by_target_maturity — preserves shorter-horizon rows whose longest-horizon target is immature or whose endpoint extends past P",
   "realized_outcomes":"actual_return uses FUTURE close prices in the test partition (strictly AFTER the decision date) — no look-ahead leakage in the realized-outcome computation",
   "ensemble_weighting":"Task 51 Phase 2 + Task 54 Phase 4: WIN_RATE_WEIGHTED uses frozen validation-period weights with a maturity purge vs the final-test boundary. MAJORITY_VOTE / PROBABILITY_WEIGHTED / TIER_WEIGHTED are per-sample (safe). FINAL_CONSENSUS uses dual-mode. Ensembles computed ONLY at finalization.",
   "point_in_time_universe":"Task 54 Phase 1: universe eligibility + liquidity ranking use ONLY pre-cutoff records; the cutoff precedes every evaluation decision date.",
   "chunking":"Task 54: chunks split evaluation SAMPLES only — every sample trains on the FULL frozen universe pooled by date + target-maturity filter. Final metrics recomputed from raw per-sample records.",
   "baselines":"Task 51 Phase 3: zero-return + training-only-mean baselines added (per-horizon, pooled market-wide). Conventional constant-mean R² reference retained per-model×horizon.",
   "walk_forward_methodology":"TRUE walk-forward: each test sample's models are re-fit on all data strictly before the sample's decision date AND with target-maturity filter applied per horizon. Distinct from the simplified backtest in train_all_with_backtesting.py (Pattern #10 — latest signal applied to all test rows).",
  },
 }

 # ── Phase 5: candidate → validate → promote ──
 def _validate_candidate(rep,expected):
  if not isinstance(rep,dict):return False,"not a dict"
  for k in ("schema_version","evaluation_method","generated_at","models"):
   if k not in rep:return False,f"missing key: {k}"
  if not isinstance(rep.get("models"),list) or len(rep["models"])==0:
   return False,"models list empty"
  for m in rep["models"]:
   for hz_str,h in m.get("horizons",{}).items():
    if h.get("status") not in ("completed","unavailable"):
     return False,f"model {m.get('name')} hz {hz_str} invalid status {h.get('status')}"
  if rep.get("evaluation_status") not in ("completed","partial","failed"):
   return False,f"invalid evaluation_status {rep.get('evaluation_status')}"
  # Task 54 additions — verify against the run manifest
  if rep.get("n_unique_stock_date_samples")!=expected["n_samples"]:
   return False,f"sample count mismatch: report={rep.get('n_unique_stock_date_samples')} manifest={expected['n_samples']}"
  if (rep.get("universe") or {}).get("fingerprint")!=expected["universe_fingerprint"]:
   return False,"universe fingerprint mismatch"
  if (rep.get("run") or {}).get("data_fingerprint")!=expected["data_fingerprint"]:
   return False,"data fingerprint mismatch"
  if sorted((rep.get("per_stock_results") or {}).keys())!=sorted(expected["eval_stocks"]):
   return False,"per_stock_results does not cover exactly the evaluated universe"
  return True,"ok"

 expected_checks={
  "n_samples":n_samples,
  "universe_fingerprint":manifest["universe"]["fingerprint"],
  "data_fingerprint":manifest["data_fingerprint"],
  "eval_stocks":list(eval_stocks),
 }
 candidate_ok,candidate_err=_validate_candidate(structured_report,expected_checks)
 _atomic_write_json(candidate_path,structured_report)
 print(f"\nCandidate written: {candidate_path}")
 if candidate_ok:
  if no_promote:
   print("  WALK_FORWARD_NO_PROMOTE=1 — candidate validated but NOT promoted (latest/previous untouched).")
  else:
   if REPORT_FILE.exists():
    shutil.copy2(REPORT_FILE,REPORT_PREVIOUS_FILE)
    print(f"  preserved previous report → {REPORT_PREVIOUS_FILE.name}")
   shutil.copy2(candidate_path,REPORT_FILE)
   print(f"  promoted candidate → {REPORT_FILE.name}")
 else:
  print(f"  candidate FAILED validation ({candidate_err}) — keeping existing {REPORT_FILE.name}")
  if not REPORT_FILE.exists() and not no_promote:
   shutil.copy2(candidate_path,REPORT_FILE)
   print("  no existing report — wrote candidate as fallback")

 # legacy artifact (kept for backward compat)
 output={
  "walk_forward_at":pd.Timestamp.now().isoformat(),
  "n_samples":n_samples,
  "models_trained":model_names,
  "individual":wf_individual,
  "ensemble":wf_ensemble,
  "methodology":"Walk-forward: expanding window. For each test sample, models re-trained on ALL data before that point. No data leakage.",
  "comparison_note":"Walk-forward results are MORE ACCURATE than simplified backtesting (which used latest prediction for all test rows).",
  "ml_integrity":structured_report["ml_integrity"],
 }
 OUT_FILE.write_text(json.dumps(output,indent=2,default=_json_default))

 write_progress(run_dir,manifest,records,"complete")
 print(f"\n{'='*60}")
 print("WALK-FORWARD BACKTESTING COMPLETE (run finalized)")
 print(f"{'='*60}")
 print(f"Run: {manifest['run_id']} | samples: {n_samples} | model fits: {sum(r.get('n_model_fits',0) for r in ordered)}")
 print(f"Universe: {universe_meta['mode']} ({len(eval_stocks)} stocks) | cutoff: {universe_meta.get('selection_cutoff') or 'n/a (fixed list)'}")
 print(f"Saved legacy: {OUT_FILE}")
 print(f"Saved structured report: {REPORT_FILE if (candidate_ok and not no_promote) else candidate_path}")
 print("ml_predictions_multi.json: NOT modified (Task 49 rule)")


# ─── main orchestration (Phases 2 + 3) ───────────────────────────────────────

def main():
 print("="*60);print("Walk-Forward Ensemble Backtesting (Task 54 — resumable/chunked)");print("="*60)
 universe_mode=_os.environ.get("WALK_FORWARD_UNIVERSE","canonical8")
 sample_step=int(_os.environ.get("WALK_FORWARD_SAMPLE_STEP","10"))
 chunk_size=int(_os.environ.get("WALK_FORWARD_CHUNK_SIZE","0") or 0)  # 0 = all samples this invocation
 run_id_env=_os.environ.get("WALK_FORWARD_RUN_ID") or None
 resume=_os.environ.get("WALK_FORWARD_RESUME","")=="1"
 finalize_only=_os.environ.get("WALK_FORWARD_FINALIZE_ONLY","")=="1"
 no_promote=_os.environ.get("WALK_FORWARD_NO_PROMOTE","")=="1"
 candidate_path=_os.environ["WALK_FORWARD_CANDIDATE_PATH"] if _os.environ.get("WALK_FORWARD_CANDIDATE_PATH") else None
 _legacy_max=_os.environ.get("WALK_FORWARD_MAX_STOCKS")
 if _legacy_max:
  print(f"  [deprecated] WALK_FORWARD_MAX_STOCKS={_legacy_max} is ignored — use WALK_FORWARD_UNIVERSE instead")

 if resume or finalize_only:
  # ── resume / finalize an existing run (Phase 3) ──
  if not run_id_env:
   print("ERROR: WALK_FORWARD_RESUME=1 / WALK_FORWARD_FINALIZE_ONLY=1 requires WALK_FORWARD_RUN_ID.");sys.exit(2)
  _sanitize_run_id(run_id_env)
  rdir=_run_dir(run_id_env)
  manifest=load_manifest(rdir)
  if manifest is None:
   print(f"ERROR: no manifest at {rdir/'manifest.json'} — cannot resume. Start a NEW run (a new WALK_FORWARD_RUN_ID will be assigned automatically).");sys.exit(2)
  # frozen universe from the manifest — NEVER re-derived on resume
  eval_stocks=manifest["universe"]["symbols"]
  universe_meta=manifest["universe"]
  df=load(stocks=eval_stocks,source=manifest["data_source_kind"])
  if df.empty:
   print("ERROR: dataset empty on resume.");sys.exit(2)
  fp=compute_data_fingerprint(df)
  if fp!=manifest["data_fingerprint"]:
   print("ERROR: dataset fingerprint mismatch — the underlying data changed since this run started.")
   print(f"  manifest: {manifest['data_fingerprint']}")
   print(f"  current : {fp}")
   print("  Refusing to resume. Start a NEW run (a new WALK_FORWARD_RUN_ID is required).");sys.exit(2)
  for key,now_val in (("sample_step",sample_step),("universe_mode",universe_mode)):
   if manifest.get(key)!=now_val:
    print(f"ERROR: config mismatch on {key}: manifest={manifest.get(key)!r} current={now_val!r} — refusing to resume; start a NEW run.");sys.exit(2)
  if manifest.get("model_names")!=list(MODEL_NAMES) or manifest.get("feature_schema")!=list(FC) or manifest.get("horizons")!=[5,10,21]:
   print("ERROR: model/horizon/feature-schema mismatch vs manifest — refusing to resume; start a NEW run.");sys.exit(2)
  _tr,_va,te=chronological_split(df,train_frac=0.50,val_frac=0.15,purge_h=21)
  test_window={"start_epoch":int(te["date"].min()),"end_epoch":int(te["date"].max())}
  if test_window!=manifest["test_window"]:
   print("ERROR: evaluation boundaries mismatch vs manifest — refusing to resume; start a NEW run.");sys.exit(2)
  samples=build_sample_list(te,eval_stocks,sample_step)
  if [s["sample_id"] for s in samples]!=manifest["sample_ids"]:
   print("ERROR: rebuilt sample list differs from the manifest — refusing to resume; start a NEW run.");sys.exit(2)
  completed=scan_completed_samples(rdir)
  # reconcile checkpoint.json with the on-disk record files (records win)
  write_checkpoint(rdir,list(completed.keys()))
  if finalize_only:
   if len(completed)<manifest["n_samples"]:
    print(f"ERROR: finalize-only requested but {manifest['n_samples']-len(completed)} sample record(s) are still missing — finish the chunks first.");sys.exit(2)
   finalize_run(rdir,manifest,completed,no_promote=no_promote,candidate_path=candidate_path)
   return
  todo=[i for i in range(manifest["n_samples"]) if i not in completed]
  print(f"\nResume run {manifest['run_id']}: {len(completed)}/{manifest['n_samples']} samples complete, {len(todo)} remaining")
 else:
  # ── fresh run ──
  eval_stocks,universe_meta=resolve_universe(universe_mode)
  source="csv" if universe_mode=="canonical8" else "db"
  print(f"\nUniverse mode: {universe_mode} -> {len(eval_stocks)} stocks ({source} source)")
  print(f"  criteria: {universe_meta['criteria']}")
  if universe_meta.get("selection_cutoff"):
   print(f"  point-in-time selection cutoff: {universe_meta['selection_cutoff']} (iterations: {universe_meta.get('selection_iterations')})")
  df=load(stocks=eval_stocks,source=source)
  if df.empty:
   print("ERROR: dataset empty.");sys.exit(2)
  print(f"Loaded: {len(df)} rows from {df['symbol'].nunique()} stocks")
  _tr,_va,te=chronological_split(df,train_frac=0.50,val_frac=0.15,purge_h=21)
  test_start_date=te["date"].min()
  print(f"  Test partition: {test_start_date} → {te['date'].max()} ({len(te)} rows)")
  # Phase 1 verification: evaluation decision dates strictly after the cutoff
  if universe_meta.get("selection_cutoff"):
   cutoff_epoch=int(pd.Timestamp(universe_meta["selection_cutoff"],tz="UTC").value//10**6)
   universe_meta["selection_cutoff_epoch"]=cutoff_epoch
   universe_meta["first_evaluation_decision_date"]=int(test_start_date)
   if not (test_start_date>cutoff_epoch):
    raise RuntimeError(
     f"LOOK-AHEAD GUARD: pooled test window starts at {test_start_date} which is NOT strictly after "
     f"the universe-selection cutoff {cutoff_epoch} — refusing to run a potentially look-ahead-biased selection.")
  else:
   # canonical8: record the cutoff post-split as a verification fact (the
   # selection is a FIXED list — no ranking, so no selection look-ahead)
   prior=df[df["date"]<test_start_date]["date"]
   cutoff_epoch=int(prior.max()) if len(prior) else None
   universe_meta["selection_cutoff_epoch"]=cutoff_epoch
   universe_meta["selection_cutoff"]=iso(cutoff_epoch) if cutoff_epoch else None
   universe_meta["first_evaluation_decision_date"]=int(test_start_date)
  samples=build_sample_list(te,eval_stocks,sample_step)
  print(f"Test samples: {len(samples)} (every {sample_step} sessions per stock)")
  if not samples:
   print("ERROR: no evaluable samples.");sys.exit(2)
  # hard assertion: every evaluation decision date strictly after the cutoff
  if universe_meta.get("selection_cutoff_epoch") is not None:
   min_dec=min(int(s["date"]) for s in samples)
   if min_dec<=universe_meta["selection_cutoff_epoch"]:
    raise RuntimeError("LOOK-AHEAD GUARD: an evaluation decision date is not strictly after the selection cutoff")
  fp=compute_data_fingerprint(df)
  if run_id_env:
   run_id=_sanitize_run_id(run_id_env)
  else:
   run_id=f"{universe_mode}_{pd.Timestamp.now('UTC').strftime('%Y%m%dT%H%M%SZ')}_{universe_meta['fingerprint'][:8]}"
  rdir=_run_dir(run_id)
  if load_manifest(rdir) is not None:
   print(f"ERROR: run id {run_id} already has a manifest — choose a new WALK_FORWARD_RUN_ID or resume it (WALK_FORWARD_RESUME=1).");sys.exit(2)
  n=len(samples)
  manifest={
   "run_id":run_id,
   "created_at":pd.Timestamp.now("UTC").isoformat(),
   "script_task":"task54",
   "universe_mode":universe_mode,
   "sample_step":sample_step,
   "chunk_size_requested":chunk_size,
   "data_source_kind":source,
   "data_fingerprint":fp,
   "universe":{**universe_meta,"symbols":list(eval_stocks)},
   "model_names":list(MODEL_NAMES),
   "feature_schema":list(FC),
   "horizons":[5,10,21],
   "split":{"train_frac":0.50,"val_frac":0.15,"purge_h":21},
   "test_window":{"start_epoch":int(te["date"].min()),"end_epoch":int(te["date"].max())},
   "sample_ids":[s["sample_id"] for s in samples],
   "sample_meta":[{"idx":s["sample_idx"],"stock":s["stock"],"date":int(s["date"]),
                   "target_maturity_21d":s.get("target_maturity_21d")} for s in samples],
   "n_samples":n,
   "val_end_idx":n//2,
   "methodology_notes":[
    "chunks split the evaluation SAMPLES only — every sample trains on the FULL frozen universe pooled by date + target-maturity filter",
    "universe selected point-in-time (pre-cutoff eligibility + volume ranking only); evaluation decision dates strictly after the cutoff",
    "ensemble predictions are computed ONLY at finalization with purged frozen validation weights",
   ],
  }
  write_manifest(rdir,manifest)
  print(f"Run manifest written: {rdir/'manifest.json'} (run_id={run_id})")
  completed=scan_completed_samples(rdir)
  todo=[i for i in range(n) if i not in completed]

 # ── process this invocation's chunk (Phase 2) ──
 chunk=todo[:chunk_size] if chunk_size>0 else todo
 print(f"\nProcessing {len(chunk)} sample(s) this invocation "
       f"(chunk_size={'all' if chunk_size==0 else chunk_size}, completed={len(completed)}, total={manifest['n_samples']})...")
 write_progress(rdir,manifest,completed,"running")
 for k,idx in enumerate(chunk):
  smp=samples[idx]
  print(f"  [{len(completed)+1}/{manifest['n_samples']}] sample {idx}: {smp['sample_id']} ...",flush=True)
  rec=process_sample(idx,smp,df)
  write_sample_record(rdir,rec)                    # durable AFTER each sample
  completed[idx]=rec
  write_checkpoint(rdir,list(completed.keys()))    # atomic checkpoint
  write_progress(rdir,manifest,completed,"running")
 print(f"Chunk complete: {len(completed)}/{manifest['n_samples']} samples done")

 if len(completed)<manifest["n_samples"]:
  cmd=build_resume_command(manifest,chunk_size)
  print("\n"+"─"*60)
  print("PARTIAL RUN — the production report (walk_forward_latest.json) is NOT touched.")
  print(f"Progress: {rdir/'progress.json'}")
  print("Resume with:")
  print(f"  {cmd}")
  sys.exit(0)

 # all samples complete → finalization
 write_progress(rdir,manifest,completed,"finalizing")
 finalize_run(rdir,manifest,completed,no_promote=no_promote,candidate_path=candidate_path)


if __name__=="__main__":main()
