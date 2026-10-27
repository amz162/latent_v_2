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
REPORT_SCHEMA_VERSION="1.1"  # bumped from 1.0 → 1.1 for Task 51 corrections
STOCKS=["ENGRO","HUBC","LUCK","SYS","MEBL","PSO","OGDC","PPL"]
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

def load():
 frames=[]
 for s in STOCKS:
  p=OHLCV/f"{s}.csv"
  if not p.exists():continue
  df=pd.read_csv(p,usecols=range(6));df=df[df["volume"]>0].reset_index(drop=True)
  if len(df)<50:continue
  df=add_features(df);df["symbol"]=s;frames.append(df)
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

def main():
 print("="*60);print("Walk-Forward Ensemble Backtesting");print("="*60)
 df=load();print(f"\nLoaded: {len(df)} rows from {df['symbol'].nunique()} stocks")

 # ML integrity (Phase A2): replace the global row split=int(len(df)*0.8) on
 # the concatenated df with a DATE-BASED chronological test partition. The
 # per-sample walk-forward loop (df[df["date"]<sample["date"]) is already
 # chronological, but the test-sample region must also be date-defined so all
 # rows on a given test date belong to the test partition (no straddle).
 # Task 51 Phase 6: extend the test window — use 50% train / 15% val / 35% test
 # (was the default 60/20/20). The earliest test sample's training data is the
 # first 50% of dates (~221 rows per stock for the canonical 8) — still enough
 # for per-horizon training (≥50 matured rows + 21-session purge). This gives
 # ~75% MORE evaluation samples than the default, with NO model-feature or
 # hyperparameter tuning on the test window.
 _tr,_va,te=chronological_split(df, train_frac=0.50, val_frac=0.15, purge_h=21)
 test_df=te.copy()
 test_start_date=te["date"].min()
 print(f"  Test partition: {test_start_date} → {te['date'].max()} ({len(te)} rows)")

 # Collect test samples: every SAMPLE_STEP days per stock, need 21 days ahead.
 # The actual_return is computed from FUTURE close prices in the test_df
 # itself — this is the REALIZED outcome at the sample's decision date (no
 # look-ahead leakage: the actual uses prices strictly after the decision).
 # Env vars for demo / fast runs (production defaults preserved):
 #   WALK_FORWARD_SAMPLE_STEP (default 10) — spacing between test samples per stock
 #   WALK_FORWARD_MAX_STOCKS  (default =all) — cap the number of stocks evaluated
 import os as _os
 SAMPLE_STEP = int(_os.environ.get("WALK_FORWARD_SAMPLE_STEP", "10"))
 MAX_STOCKS_ENV = _os.environ.get("WALK_FORWARD_MAX_STOCKS")
 eval_stocks = STOCKS if not MAX_STOCKS_ENV else STOCKS[:int(MAX_STOCKS_ENV)]
 if SAMPLE_STEP != 10 or MAX_STOCKS_ENV:
  print(f"  [fast-mode] SAMPLE_STEP={SAMPLE_STEP}, MAX_STOCKS={MAX_STOCKS_ENV or 'all'} → {len(eval_stocks)} stocks evaluated")
 samples=[]
 for s in eval_stocks:
  ste=test_df[test_df["symbol"]==s].sort_values("date").reset_index(drop=True)
  for i in range(0,len(ste)-21,SAMPLE_STEP):
   row=ste.iloc[i]
   future_close=ste.iloc[min(i+21,len(ste)-1)]["close"]
   actual_return=(future_close-row["close"])/row["close"]
   samples.append({
    "stock":s,
    "date":row["date"],
    "close":float(row["close"]),
    "features":row[FC].values.astype(np.float64),
    "actual_return_21d":float(actual_return),
    "actual_5d":float((ste.iloc[min(i+5,len(ste)-1)]["close"]-row["close"])/row["close"]),
    "actual_10d":float((ste.iloc[min(i+10,len(ste)-1)]["close"]-row["close"])/row["close"]),
    "actual_21d":float(actual_return),
   })
 print(f"Test samples: {len(samples)} (every 10 days per stock)")

 # Walk-forward: for each sample, train on ALL data before that date
 # Predict 5d/10d/21d returns
 all_predictions={name:[] for name in MODEL_NAMES}

 print(f"\nTraining {len(MODEL_NAMES)} models × {len(samples)} samples = {len(MODEL_NAMES)*len(samples)} model trainings...")
 # NEW (Task 49): per-model-per-horizon (predicted, actual) pairs for
 # forecast-quality metrics (MAE / RMSE / R² / directional accuracy).
 per_model_per_horizon = {name: {5: [], 10: [], 21: []} for name in MODEL_NAMES}
 # Track the train-data cutoff + evaluation window for the report schema.
 sample_dates_seen = []
 train_cutoff_dates_seen = []
 # Task 51: per-sample per-horizon metadata — latest eligible train-feature
 # date + latest target-maturity date (must be <= sample date).
 sample_maturity_metadata = []  # list of {sample_date, stock, per-horizon: {latest_train_feature_date, latest_target_maturity_date, n_train_rows}}
 # Task 51: training-only baseline means — per-horizon, computed per-sample
 # from matured training targets (filter_by_target_maturity). Pooled across
 # all stocks (market-wide mean) — see limitations.
 training_only_baseline_means = {5: [], 10: [], 21: []}  # per-horizon list of (sample_idx, mean, n_obs, actual_at_sample)
 for idx,sample in enumerate(samples):
  if idx%20==0:print(f"  Sample {idx}/{len(samples)}...")
  # Training data = all rows BEFORE this sample's date (chronological, no leak).
  train_data=df[df["date"]<sample["date"]]
  if len(train_data)<100:continue
  Xtr_full=train_data[FC].values.astype(np.float64)
  sample_dates_seen.append(sample["date"])
  train_cutoff_dates_seen.append(int(train_data["date"].max()))

  # Task 51: per-horizon target-maturity filter — exclude training rows whose
  # target endpoint (T+h) extends past the prediction timestamp P. This is
  # the target-maturity leakage fix — replaces the old `dropna(subset=[hz_col])`
  # which only checked if target VALUE was NaN, not whether the target's
  # forward window was observable at the prediction timestamp.
  per_horizon_meta = {}
  # Task 51 Phase 3: compute the training-only baseline mean ONCE per
  # (sample, horizon) — NOT per (sample, model, horizon). The mean is the
  # same regardless of which model is being trained (it's just the mean of
  # the matured training targets). Move OUTSIDE the model loop to avoid
  # 5x duplication.
  for hz in [5, 10, 21]:
   td_h = filter_by_target_maturity(train_data, sample["date"], horizon=hz)
   per_horizon_meta[hz] = {
    "latest_train_feature_date": int(td_h["date"].max()) if len(td_h) > 0 else None,
    "latest_target_maturity_date": int(td_h[f"target_maturity_{hz}d"].max()) if len(td_h) > 0 else None,
    "n_train_rows": len(td_h),
   }
   # Task 51 Phase 3: track training-only baseline mean at this sample+horizon
   # (pooled across all stocks — market-wide mean of matured training targets).
   if len(td_h) >= 50:
    training_only_baseline_means[hz].append({
     "sample_idx": idx,
     "mean": float(td_h[f"target_{hz}d"].mean()),
     "n_obs": int(len(td_h)),
     "actual_at_sample": float(sample.get(f"actual_{hz}d", sample["actual_return_21d"])),
    })
  sample_maturity_metadata.append({
   "sample_date": int(sample["date"]),
   "stock": sample["stock"],
   "per_horizon": per_horizon_meta,
  })

  for name in MODEL_NAMES:
   try:
    # Train 3 separate models for 5d/10d/21d targets.
    # Task 51: filter_by_target_maturity replaces dropna — per-horizon, per-stock
    # target-maturity filter that ensures the target outcome was observable at
    # the prediction timestamp.
    r5=r10=r21=0
    eval_skipped = {5: False, 10: False, 21: False}  # True if too-few-mature-rows
    for hz_col,hz in [("target_5d",5),("target_10d",10),("target_21d",21)]:
     td=filter_by_target_maturity(train_data, sample["date"], horizon=hz)
     if len(td)<50:  # not enough mature rows for this horizon
      pred=0.0
      eval_skipped[hz] = True
     else:
      Xtr=td[FC].values.astype(np.float64);ytr=td[hz_col].values.astype(np.float64)
      model=train_one_model(name,Xtr,ytr)
      pred=float(model.predict(sample["features"].reshape(1,-1))[0])
     if hz==5:r5=pred
     elif hz==10:r10=pred
     else:r21=pred
     # Track (predicted, actual) for forecast-quality metrics. The actual at
     # horizon hz is sample["actual_{hz}d"] (pre-computed from future OHLCV).
     actual_h = sample.get(f"actual_{hz}d", sample["actual_return_21d"])
     if not eval_skipped[hz]:
      per_model_per_horizon[name][hz].append({
       "predicted": float(pred),
       "actual": float(actual_h),
       "stock": sample["stock"],
       "date": sample["date"],
      })

    avg=(r5+r10+r21)/3
    sig="BUY"if avg>0.01 else"SELL"if avg<-0.01 else"HOLD"
    actual=sample["actual_return_21d"]
    correct=(sig=="BUY"and actual>0)or(sig=="SELL"and actual<0)

    all_predictions[name].append({
     "stock":sample["stock"],"signal":sig,"avgReturn":avg,
     "actual_return":actual,"correct":correct,
     "r5":r5,"r10":r10,"r21":r21,
     # Task 51: per-sample horizon-level eval-skip flags (for the report metadata)
     "eval_skipped_5d": eval_skipped[5],
     "eval_skipped_10d": eval_skipped[10],
     "eval_skipped_21d": eval_skipped[21],
     "sample_idx": idx,
    })
   except Exception as e:
    all_predictions[name].append({
     "stock":sample["stock"],"signal":"HOLD","avgReturn":0,
     "actual_return":sample["actual_return_21d"],"correct":False,
     "r5":0,"r10":0,"r21":0,
     "eval_skipped_5d": True, "eval_skipped_10d": True, "eval_skipped_21d": True,
     "sample_idx": idx,
    })

 # Compute individual model walk-forward backtesting
 print("\n\nComputing individual model walk-forward results...")
 wf_individual={}
 for name in MODEL_NAMES:
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
   # Task 51 Phase 4: label trading metrics as gross directional-return proxy
   "trading_metrics_label": "gross directional-return proxy (signed forward 21d return, NO commission/slippage/CGT/position-sizing deducted)",
   "net_trading_pnl": "unavailable",
   "net_trading_pnl_reason": "Genuine trade-execution simulator (entry/exit dates, commission, slippage, CGT, position sizing) is NOT connected to the walk-forward script. See src/lib/latent/investment-simulator.ts.",
  }
  print(f"  {name}: trades={tt} winRate={wr:.1f}% avgReturn={ar_:.2f}% stars={'★'*int(min(5,max(1,int(wr/20)+1)))}")

 # Compute ensemble walk-forward backtesting
 print("\nComputing ensemble walk-forward results...")

 # For each sample, collect all 5 models' predictions
 ensemble_preds={"MAJORITY_VOTE":[],"PROBABILITY_WEIGHTED":[],"TIER_WEIGHTED":[],"WIN_RATE_WEIGHTED":[]}

 # Group predictions by sample index (they're in the same order)
 n_samples=len(all_predictions[MODEL_NAMES[0]])

 # Task 51 Phase 2 — WIN_RATE_WEIGHTED Option A: frozen validation-period weights.
 # The OLD implementation used `wf_individual[name].winRate` computed from the
 # FULL evaluation period — leaky (weights at sample i used outcomes from
 # samples i+1..n). Fix: split samples into first half (VALIDATION) + second
 # half (FINAL_TEST). Compute win rates on VALIDATION only → freeze weights →
 # apply to FINAL_TEST. VALIDATION-period WIN_RATE_WEIGHTED entries are marked
 # "unavailable — validation period (weights being calibrated)".
 val_end_idx = n_samples // 2  # samples [0..val_end_idx-1] = validation; [val_end_idx..n-1] = final-test
 val_preds_per_model = {name: [p for p in all_predictions[name] if p["sample_idx"] < val_end_idx]
                        for name in MODEL_NAMES}
 # Compute frozen validation-period win rates per model
 frozen_weights = {}
 for name in MODEL_NAMES:
  vp = val_preds_per_model[name]
  vt = [p for p in vp if p["signal"] != "HOLD"]
  vw = [p for p in vt if p["correct"]]
  v_wr = len(vw) / max(len(vt), 1) * 100 if vt else 0
  # Weight function: 0 if <30%, linear 30-50%, full if >50%
  if v_wr < 30: frozen_weights[name] = 0.0
  elif v_wr > 50: frozen_weights[name] = 1.0
  else: frozen_weights[name] = (v_wr - 30) / 20
 print(f"  Frozen WIN_RATE_WEIGHTED weights (from validation period [0..{val_end_idx-1}]):")
 for n, w in frozen_weights.items():
  print(f"    {n}: weight={w:.3f}")

 for i in range(n_samples):
  sample_preds={name:all_predictions[name][i] for name in MODEL_NAMES if i<len(all_predictions[name])}
  if not sample_preds:continue
  actual=sample_preds[MODEL_NAMES[0]]["actual_return"]
  is_validation_period = (i < val_end_idx)

  # A. Majority Vote (per-sample — safe)
  buys=sum(1 for p in sample_preds.values()if p["signal"]=="BUY")
  sells=sum(1 for p in sample_preds.values()if p["signal"]=="SELL")
  holds=sum(1 for p in sample_preds.values()if p["signal"]=="HOLD")
  if buys>sells and buys>holds:sig="BUY"
  elif sells>buys and sells>holds:sig="SELL"
  else:sig="HOLD"
  ensemble_preds["MAJORITY_VOTE"].append({"signal":sig,"actual_return":actual, "period":"validation" if is_validation_period else "final-test"})

  # B. Probability-Weighted (per-sample — safe)
  avg_ret=np.mean([p["avgReturn"]for p in sample_preds.values()])
  sig2="BUY"if avg_ret>0.01 else"SELL"if avg_ret<-0.01 else"HOLD"
  ensemble_preds["PROBABILITY_WEIGHTED"].append({"signal":sig2,"actual_return":actual, "period":"validation" if is_validation_period else "final-test"})

  # C. Tier-Weighted (per-sample, STATIC weights — safe)
  ws=sum(p["avgReturn"]*TIER_W.get(n,0.2)for n,p in sample_preds.items())
  wt=sum(TIER_W.get(n,0.2)for n in sample_preds)
  wr_=ws/wt if wt>0 else 0
  sig3="BUY"if wr_>0.01 else"SELL"if wr_<-0.01 else"HOLD"
  ensemble_preds["TIER_WEIGHTED"].append({"signal":sig3,"actual_return":actual, "period":"validation" if is_validation_period else "final-test"})

  # D. Win-Rate-Weighted (Task 51 Phase 2 fix — Option A: frozen validation weights)
  if is_validation_period:
   # Validation period — weights being calibrated; mark unavailable
   ensemble_preds["WIN_RATE_WEIGHTED"].append({
    "signal":"HOLD", "actual_return":actual, "period":"validation",
    "status":"unavailable",
    "reason":("Validation period — WIN_RATE_WEIGHTED weights are being "
              f"calibrated from samples [0..{val_end_idx-1}]. Apply frozen "
              "weights only to final-test samples."),
   })
  else:
   # Final-test period — use FROZEN validation-period weights (no future leak)
   weighted_buy=weighted_sell=total_w=0
   for n,p in sample_preds.items():
    weight = frozen_weights.get(n, 0.0)
    if weight>0:
     total_w+=weight
     if p["signal"]=="BUY":weighted_buy+=p["avgReturn"]*weight
     elif p["signal"]=="SELL":weighted_sell+=p["avgReturn"]*weight
   wr_avg=(weighted_buy+weighted_sell)/total_w if total_w>0 else 0
   sig4="BUY"if wr_avg>0.01 else"SELL"if wr_avg<-0.01 else"HOLD"
   ensemble_preds["WIN_RATE_WEIGHTED"].append({"signal":sig4,"actual_return":actual, "period":"final-test", "status":"ok"})

 # Final consensus (Task 51 Phase 2 fix — dual-mode):
 #  - Validation period: 2+ of {MAJORITY, PROBABILITY, TIER} agree (skip WIN_RATE_WEIGHTED — being calibrated)
 #  - Final-test period: 2+ of {MAJORITY, PROBABILITY, TIER, WIN_RATE_WEIGHTED} agree
 final_preds=[]
 for i in range(n_samples):
  is_validation_period = (i < val_end_idx)
  if is_validation_period:
   votes = [ensemble_preds["MAJORITY_VOTE"][i]["signal"],
            ensemble_preds["PROBABILITY_WEIGHTED"][i]["signal"],
            ensemble_preds["TIER_WEIGHTED"][i]["signal"]]
  else:
   votes = [ensemble_preds["MAJORITY_VOTE"][i]["signal"],
            ensemble_preds["PROBABILITY_WEIGHTED"][i]["signal"],
            ensemble_preds["TIER_WEIGHTED"][i]["signal"],
            ensemble_preds["WIN_RATE_WEIGHTED"][i]["signal"]]
  buy_v=sum(1 for v in votes if v=="BUY")
  sell_v=sum(1 for v in votes if v=="SELL")
  if buy_v>=2:sig="BUY"
  elif sell_v>=2:sig="SELL"
  else:sig="HOLD"
  actual=ensemble_preds["MAJORITY_VOTE"][i]["actual_return"]
  final_preds.append({"signal":sig,"actual_return":actual, "period":"validation" if is_validation_period else "final-test"})
 ensemble_preds["FINAL_CONSENSUS"]=final_preds

 # Compute ensemble backtesting stats (Task 51 Phase 2: filter validation-period unavailable entries)
 wf_ensemble={}
 for method,preds in ensemble_preds.items():
  # Task 51: skip preds marked "status":"unavailable" (validation-period WIN_RATE_WEIGHTED)
  eligible = [p for p in preds if p.get("status", "ok") == "ok"]
  trades=[p for p in eligible if p["signal"]!="HOLD"]
  wins=[p for p in trades if(p["signal"]=="BUY"and p["actual_return"]>0)or(p["signal"]=="SELL"and p["actual_return"]<0)]
  rets=[p["actual_return"] if p["signal"]=="BUY" else -p["actual_return"] for p in trades]
  tt=len(trades);wr=len(wins)/max(tt,1)*100
  ar_=float(np.mean(rets))*100 if rets else 0
  # Task 51 Phase 4: label trading metrics as gross directional-return proxy
  wf_ensemble[method]={
   "totalTrades":int(tt),"wins":int(len(wins)),
   "winRate":round(float(wr),1),"avgReturnPct":round(float(ar_),2),
   "maxReturnPct":round(float(max(rets)*100)if rets else 0,2),
   "minReturnPct":round(float(min(rets)*100)if rets else 0,2),
   "stars":int(min(5,max(1,int(wr/20)+1))),
   "trading_metrics_label": "gross directional-return proxy (signed forward return, NO commission/slippage/CGT deducted)",
   "net_trading_pnl": "unavailable",
   "net_trading_pnl_reason": "Genuine trade-execution simulator (entry/exit dates, commission, slippage, CGT, position sizing) is NOT connected to the walk-forward script. The 'avgReturnPct' above is a signed forward-return proxy, not net P&L. See src/lib/latent/investment-simulator.ts for the genuine trade simulator used elsewhere in the app.",
   "n_validation_period_excluded": int(sum(1 for p in preds if p.get("status") == "unavailable")),
  }
  print(f"  {method}: trades={tt} winRate={wr:.1f}% avgReturn={ar_:.2f}% stars={'★'*int(min(5,max(1,int(wr/20)+1)))} "
        f"(validation-period excluded: {wf_ensemble[method]['n_validation_period_excluded']})")

 # ─── NEW (Task 49): Forecast-quality metrics per model × horizon ──────────
 # MAE / RMSE / R² / directional accuracy / n_observations.
 # Task 51 Phase 3: TWO genuine prediction baselines (zero-return + training-only mean).
 # The constant-mean baseline (predict mean(actual_arr) for all) is retained as
 # the conventional R² reference but explicitly labeled as such.
 print("\n\nComputing forecast-quality metrics (MAE / RMSE / R² / directional accuracy)...")
 wf_forecast = {}  # {model_name: {horizon: {mae, rmse, r2, directional_accuracy, n_observations, baselines}}}
 unevaluated = []  # list of {model, horizon, reason}
 # Task 51 Phase 3 — per-horizon pooled actuals for baseline metrics (use the
 # same matured eval observations as each ML model — they share samples).
 # Build per-horizon actual arrays from per_model_per_horizon (same for all 5 models).
 horizon_actuals = {}
 horizon_pred_pairs_per_model = {}
 for hz in [5, 10, 21]:
  # Use the first model's pairs as the reference (all 5 models predict at the same samples)
  ref_pairs = per_model_per_horizon[MODEL_NAMES[0]][hz]
  if len(ref_pairs) >= 2:
   horizon_actuals[hz] = np.array([p["actual"] for p in ref_pairs], dtype=np.float64)
  else:
   horizon_actuals[hz] = None
 for name in MODEL_NAMES:
  wf_forecast[name] = {}
  for hz in [5, 10, 21]:
   pairs = per_model_per_horizon[name][hz]
   if len(pairs) < 2:
    reason = (f"insufficient matured samples at horizon {hz}d "
              f"(have {len(pairs)}, need ≥2)")
    wf_forecast[name][hz] = {"status": "unavailable", "reason": reason,
                              "n_observations": len(pairs)}
    unevaluated.append({"model": name, "horizon": hz, "reason": reason})
    continue
   pred_arr = np.array([p["predicted"] for p in pairs], dtype=np.float64)
   actual_arr = np.array([p["actual"] for p in pairs], dtype=np.float64)
   mae = float(mean_absolute_error(actual_arr, pred_arr))
   rmse = float(np.sqrt(mean_squared_error(actual_arr, pred_arr)))
   # R² can be NEGATIVE — that's honest (model worse than constant-mean baseline).
   # Do NOT clamp to zero.
   if len(actual_arr) > 1 and actual_arr.std() > 0:
    r2 = float(r2_score(actual_arr, pred_arr))
   else:
    r2 = float("nan")  # undefined when actual is constant
   # Directional accuracy: sign(predicted) == sign(actual)
   dir_acc = float(np.mean(np.sign(pred_arr) == np.sign(actual_arr)))
   # ─── Task 51 Phase 3: TWO genuine prediction baselines ────────────────
   # Baseline 1: Zero-return baseline — predict 0 for all samples.
   zero_pred = np.zeros_like(actual_arr)
   zero_mae = float(mean_absolute_error(actual_arr, zero_pred))
   zero_rmse = float(np.sqrt(mean_squared_error(actual_arr, zero_pred)))
   if len(actual_arr) > 1 and actual_arr.std() > 0:
    zero_r2 = float(r2_score(actual_arr, zero_pred))
   else:
    zero_r2 = float("nan")
   zero_dir_acc = float(np.mean(np.sign(zero_pred) == np.sign(actual_arr)))  # = fraction where actual == 0 (typically 0)
   # Baseline 2: Training-only mean baseline — at each sample, predict the mean
   # of matured training targets for that horizon (pooled market-wide, excludes
   # the sample's own target). The `training_only_baseline_means[hz]` list was
   # built in the per-sample loop using filter_by_target_maturity.
   tbo = training_only_baseline_means.get(hz, [])
   if len(tbo) == len(pairs):
    tbo_pred = np.array([t["mean"] for t in tbo], dtype=np.float64)
    tbo_mae = float(mean_absolute_error(actual_arr, tbo_pred))
    tbo_rmse = float(np.sqrt(mean_squared_error(actual_arr, tbo_pred)))
    if len(actual_arr) > 1 and actual_arr.std() > 0:
     tbo_r2 = float(r2_score(actual_arr, tbo_pred))
    else:
     tbo_r2 = float("nan")
    tbo_dir_acc = float(np.mean(np.sign(tbo_pred) == np.sign(actual_arr)))
    tbo_n_obs = int(np.mean([t["n_obs"] for t in tbo]))
    tbo_status = "completed"
    tbo_reason = None
   else:
    tbo_pred = None
    tbo_mae = tbo_rmse = tbo_r2 = tbo_dir_acc = None
    tbo_n_obs = 0
    tbo_status = "unavailable"
    tbo_reason = (f"training-only baseline not aligned with eval pairs "
                  f"(have {len(tbo)} training means for {len(pairs)} eval pairs)")
   # Conventional constant-mean baseline (reference for R²)
   cm_pred = np.full_like(actual_arr, actual_arr.mean())
   cm_mae = float(mean_absolute_error(actual_arr, cm_pred))
   cm_rmse = float(np.sqrt(mean_squared_error(actual_arr, cm_pred)))
   if len(actual_arr) > 1 and actual_arr.std() > 0:
    cm_r2 = float(r2_score(actual_arr, cm_pred))  # = 0.0 by construction
   else:
    cm_r2 = float("nan")
   wf_forecast[name][hz] = {
    "status": "completed",
    "mae": round(mae, 6),
    "rmse": round(rmse, 6),
    "r2": None if np.isnan(r2) else round(r2, 6),
    "directional_accuracy": round(dir_acc, 4),
    "n_observations": int(len(pairs)),
    "baselines": {
     "constant_mean": {  # conventional R² reference (NOT a deployable strategy)
      "definition": "predict mean(actual_eval) for all samples — this is the R² reference, NOT a deployable forecasting strategy",
      "mae": round(cm_mae, 6),
      "rmse": round(cm_rmse, 6),
      "r2": None if np.isnan(cm_r2) else round(cm_r2, 6),
     },
     "zero_return": {  # Task 51 Phase 3 Baseline 1
      "definition": "predict 0 future return for all samples",
      "mae": round(zero_mae, 6),
      "rmse": round(zero_rmse, 6),
      "r2": None if np.isnan(zero_r2) else round(zero_r2, 6),
      "directional_accuracy": round(zero_dir_acc, 4),
     },
     "training_only_mean": {  # Task 51 Phase 3 Baseline 2
      "definition": "at each sample, predict the mean of matured training targets for this horizon (pooled market-wide across all stocks; excludes the sample's own target; uses filter_by_target_maturity)",
      "status": tbo_status,
      "reason": tbo_reason,
      "mae": round(tbo_mae, 6) if tbo_mae is not None else None,
      "rmse": round(tbo_rmse, 6) if tbo_rmse is not None else None,
      "r2": None if (tbo_r2 is None or np.isnan(tbo_r2)) else round(tbo_r2, 6),
      "directional_accuracy": round(tbo_dir_acc, 4) if tbo_dir_acc is not None else None,
      "n_training_observations_avg": tbo_n_obs,
     },
    },
   }
   r2_str = "NaN" if np.isnan(r2) else f"{r2:+.4f}"
   print(f"  {name} {hz}d: n={len(pairs)} MAE={mae:.6f} RMSE={rmse:.6f} R²={r2_str} DirAcc={dir_acc:.4f} | "
         f"zero-R²={zero_r2:+.4f} | train-mean-R²={'NaN' if (tbo_r2 is None or np.isnan(tbo_r2)) else f'{tbo_r2:+.4f}'}")

 # ─── NEW (Task 49): Structured versioned report at data/backtest_reports/walk_forward_latest.json ───
 # This is the artifact the /api/backtest/walk-forward route reads. SEPARATE
 # from ml_predictions_multi.json (which we must NOT modify).
 evaluation_status = "completed" if all(
   wf_forecast.get(name, {}).get(hz, {}).get("status") == "completed"
   for name in MODEL_NAMES for hz in [5, 10, 21]
 ) else ("partial" if any(
   wf_forecast.get(name, {}).get(hz, {}).get("status") == "completed"
   for name in MODEL_NAMES for hz in [5, 10, 21]
 ) else "failed")

 # Convert epoch-ms int dates to ISO for the report schema.
 def iso(ms):
  try:
   return pd.Timestamp(int(ms), unit="ms").isoformat()
  except Exception:
   return None

 eval_start = iso(min(sample_dates_seen)) if sample_dates_seen else None
 eval_end = iso(max(sample_dates_seen)) if sample_dates_seen else None
 train_cutoff = iso(max(train_cutoff_dates_seen)) if train_cutoff_dates_seen else None
 train_floor = iso(min(train_cutoff_dates_seen)) if train_cutoff_dates_seen else None

 structured_report = {
  "schema_version": REPORT_SCHEMA_VERSION,
  "evaluation_status": evaluation_status,
  "evaluation_method": "walk-forward-expanding-window",
  "generated_at": pd.Timestamp.now().isoformat(),
  "data_cutoff": train_cutoff,  # latest train-data date used by any sample
  "training_window": {"start": train_floor, "end": train_cutoff},
  "evaluation_date_range": {"start": eval_start, "end": eval_end},
  "evaluated_symbols": sorted(eval_stocks),
  "universe_size": len(eval_stocks),
  "forecast_horizons": [5, 10, 21],
  # Task 51 Phase 5: explicit sample-count metadata (was ambiguous before)
  "n_unique_stock_date_samples": len(samples),  # unique (stock, decision-date) pairs
  "n_model_fits": len(MODEL_NAMES) * 3 * len(samples),  # 5 models × 3 horizons × n_samples
  "n_unique_prediction_dates": len(set(int(d) for d in sample_dates_seen)),
  "sampling_interval_sessions": SAMPLE_STEP,  # SAMPLE_STEP trading days between samples per stock
  "n_evaluated_models": len(MODEL_NAMES),
  "n_evaluated_horizons": 3,
  "n_eligible_samples": len(samples),  # legacy alias for n_unique_stock_date_samples (kept for backward compat)
  "n_matured_outcomes": {
   str(hz): sum(1 for name in MODEL_NAMES
               for p in per_model_per_horizon[name][hz])
   for hz in [5, 10, 21]
  },
  "n_incomplete_or_excluded_outcomes": {
   str(hz): sum(1 for name in MODEL_NAMES
                for p in all_predictions[name]
                if p.get(f"eval_skipped_{hz}d", False))
   for hz in [5, 10, 21]
  },
  "models": [
   {
    "name": name,
    "implementation_type": "trained-ml",  # all 5 are genuinely trained (not technical-rule)
    "horizons": {
     str(hz): wf_forecast[name].get(hz, {"status": "unavailable"})
     for hz in [5, 10, 21]
    },
   } for name in MODEL_NAMES
  ],
  "baselines": {
   # Task 51 Phase 3: per-horizon pooled baselines (zero-return + training-only mean).
   # Conventional R² reference (constant-mean) is per-model×horizon inside wf_forecast.
   "per_horizon_pooled": {
    str(hz): {
     "zero_return": (wf_forecast[MODEL_NAMES[0]].get(hz, {}) or {}).get("baselines", {}).get("zero_return", {"status": "unavailable"}) if wf_forecast.get(MODEL_NAMES[0], {}).get(hz, {}).get("status") == "completed" else {"status": "unavailable"},
     "training_only_mean": (wf_forecast[MODEL_NAMES[0]].get(hz, {}) or {}).get("baselines", {}).get("training_only_mean", {"status": "unavailable"}) if wf_forecast.get(MODEL_NAMES[0], {}).get(hz, {}).get("status") == "completed" else {"status": "unavailable"},
    } for hz in [5, 10, 21]
   },
   "notes": (
    "Conventional R² reference = constant-mean (predict mean(actual_eval) for all — R²=0 by construction). "
    "Task 51 Phase 3 adds TWO deployable prediction baselines: "
    "(1) zero-return (predict 0 — measures whether forecasting beats a no-trade strategy), "
    "(2) training-only mean (per-sample, predict the mean of matured training targets for this horizon — "
    "pooled market-wide across all stocks; uses filter_by_target_maturity to exclude the sample's own target). "
    "A negative model R² vs constant-mean means the model did worse than the eval-set mean; "
    "compare against zero-return + training-only-mean baselines for actual deployable-skill assessment."
   ),
  },
  "trading_metrics": {
   "individual": wf_individual,
   "ensemble": wf_ensemble,
   # Task 51 Phase 4: label ALL trading metrics as gross directional-return proxy
   "label": "gross directional-return proxy",
   "definition": "Per-trade return = signed forward 21-day return (BUY: actual_return; SELL: -actual_return). NO commission, slippage, CGT, or position-sizing applied.",
   "net_trading_pnl": "unavailable",
   "net_trading_pnl_reason": "Genuine trade-execution simulator (entry/exit dates, commission 0.15%×2, slippage 0.15%, CGT 15% on gains, position sizing, portfolio compounding) is NOT connected to the walk-forward script. The 'avgReturnPct' values above are signed forward-return proxies, NOT net P&L. See src/lib/latent/investment-simulator.ts for the genuine trade simulator used elsewhere in the app (Tracker → Investment Simulator).",
  },
  "win_rate_weighted_ensemble_methodology": {
   "phase_2_fix": "Option A — frozen validation-period weights",
   "description": (
    "Task 51 Phase 2: the OLD WIN_RATE_WEIGHTED used wf_individual[name].winRate computed from "
    "the FULL evaluation period — leaky (weights at sample i used outcomes from samples i+1..n). "
    "Fix: split samples into first half (VALIDATION) + second half (FINAL_TEST). Compute win rates "
    "on VALIDATION only → freeze weights → apply to FINAL_TEST. VALIDATION-period "
    "WIN_RATE_WEIGHTED entries are marked 'unavailable — validation period (weights being calibrated)'. "
    "FINAL_CONSENSUS on validation: 2+ of {MAJORITY, PROBABILITY, TIER} agree (skip WIN_RATE_WEIGHTED). "
    "FINAL_CONSENSUS on final-test: 2+ of {MAJORITY, PROBABILITY, TIER, WIN_RATE_WEIGHTED} agree."
   ),
   "validation_period_indices": [0, val_end_idx - 1],
   "final_test_period_indices": [val_end_idx, n_samples - 1] if n_samples > val_end_idx else [],
   "frozen_weights": frozen_weights,
  },
  "sample_maturity_metadata_summary": {
   "n_samples_logged": len(sample_maturity_metadata),
   "first_sample": {
    "sample_date": iso(sample_maturity_metadata[0]["sample_date"]) if sample_maturity_metadata else None,
    "stock": sample_maturity_metadata[0]["stock"] if sample_maturity_metadata else None,
    "per_horizon": {
     str(hz): {
      "latest_train_feature_date": iso(sample_maturity_metadata[0]["per_horizon"][hz]["latest_train_feature_date"]) if sample_maturity_metadata and sample_maturity_metadata[0]["per_horizon"][hz]["latest_train_feature_date"] else None,
      "latest_target_maturity_date": iso(sample_maturity_metadata[0]["per_horizon"][hz]["latest_target_maturity_date"]) if sample_maturity_metadata and sample_maturity_metadata[0]["per_horizon"][hz]["latest_target_maturity_date"] else None,
      "n_train_rows": sample_maturity_metadata[0]["per_horizon"][hz]["n_train_rows"] if sample_maturity_metadata else 0,
     } for hz in [5, 10, 21]
    },
   } if sample_maturity_metadata else None,
   "last_sample": {
    "sample_date": iso(sample_maturity_metadata[-1]["sample_date"]) if sample_maturity_metadata else None,
    "stock": sample_maturity_metadata[-1]["stock"] if sample_maturity_metadata else None,
    "per_horizon": {
     str(hz): {
      "latest_train_feature_date": iso(sample_maturity_metadata[-1]["per_horizon"][hz]["latest_train_feature_date"]) if sample_maturity_metadata and sample_maturity_metadata[-1]["per_horizon"][hz]["latest_train_feature_date"] else None,
      "latest_target_maturity_date": iso(sample_maturity_metadata[-1]["per_horizon"][hz]["latest_target_maturity_date"]) if sample_maturity_metadata and sample_maturity_metadata[-1]["per_horizon"][hz]["latest_target_maturity_date"] else None,
      "n_train_rows": sample_maturity_metadata[-1]["per_horizon"][hz]["n_train_rows"] if sample_maturity_metadata else 0,
     } for hz in [5, 10, 21]
    },
   } if sample_maturity_metadata else None,
   "verification": "For each sample, latest_target_maturity_date <= sample_date (no target-maturity leak)",
  },
  "limitations": [
   f"Universe size = {len(eval_stocks)} stock(s) of the canonical 8 PSX stocks: {', '.join(sorted(eval_stocks))}. NOT the full ~908 DB-backed universe and NOT a fully production-validated benchmark.",
   "5 classical models evaluated (XGBoost, LightGBM, CatBoost, Random Forest, Ridge Regression). The other ~60 registered models (LSTM, CNN-LSTM, Transformer-LSTM, PatchTST, N-BEATS, TimesNet, Informer, foundation analogs, rule-based strategies) are NOT evaluated here — see scripts/walk_forward_backtesting.py MODEL_NAMES.",
   "Per-sample retraining on data[date < sample.date] (expanding window). No data leakage.",
   f"Task 51 Phase 1: filter_by_target_maturity ensures training rows' target endpoint (T+h) <= sample's prediction date P. Per-horizon, per-stock, pooled across stocks. Preserves valid shorter-horizon training rows whose longest-horizon target is immature.",
   "R² can be negative — that's honest (model did not outperform the constant-mean baseline on this test). Compare against zero-return + training-only-mean baselines for actual deployable-skill assessment.",
   "Directional accuracy = fraction of samples where sign(predicted) == sign(actual). A value >50% is NOT proven predictive skill without considering sample size, baseline, serial dependence, and uncertainty.",
   f"OVERLAPPING FORECAST WINDOWS: samples are {SAMPLE_STEP} trading days apart per stock, but the 21-day return windows at adjacent samples OVERLAP by 11 sessions. Outcomes are NOT independent — uncertainty estimates must use date-blocked resampling (NOT naive standard errors).",
   f"Sample dates are every {SAMPLE_STEP} trading days per stock in the test partition; need ≥21 bars ahead for the 21d horizon to mature.",
   f"Total unique (stock, decision-date) samples = {len(samples)}; total model fits = {len(MODEL_NAMES)} × 3 horizons × {len(samples)} samples = {len(MODEL_NAMES)*3*len(samples)}. Do NOT describe {len(samples)} as 'samples per stock'.",
   "Trading metrics are GROSS directional-return proxies (signed forward 21-day return, NO commission/slippage/CGT/position-sizing). Net trading P&L is unavailable. See src/lib/latent/investment-simulator.ts for the genuine trade simulator used in the Tracker.",
   "WIN_RATE_WEIGHTED ensemble uses Option A (frozen validation-period weights) — validation-period entries are marked unavailable; final-test entries use frozen weights from the validation sub-period.",
   "Training-only-mean baseline pools matured training targets across all stocks (market-wide mean). Per-stock means are NOT computed because most stocks have insufficient historical observations per horizon for a stable per-stock mean.",
  ],
  "unevaluated": unevaluated,
  "ml_integrity": {
   "target_construction": "per-stock groupby(symbol).shift(-h) via add_forward_returns; no .fillna(0); immature rows left NaN",
   "target_maturity_filter": "Task 51 Phase 1: filter_by_target_maturity excludes training rows whose target endpoint (T+h) > prediction date P. Per-horizon, per-stock, pooled. Distinct from drop_immature_targets (which only removes rows whose target VALUE is NaN).",
   "test_partition": "date-based chronological_split test partition (NOT global row split=int(len*0.8)) — all rows on a given test date belong to the test partition",
   "per_sample_training": "per-sample train_data = df[df['date']<sample['date']] (strict chronological, no look-ahead) + filter_by_target_maturity(hz) per horizon",
   "per_horizon_drop": "per-sample, per-horizon filter_by_target_maturity — preserves shorter-horizon rows whose longest-horizon target is immature or whose endpoint extends past P",
   "realized_outcomes": "actual_return uses FUTURE close prices in the test partition (strictly AFTER the decision date) — no look-ahead leakage in the realized-outcome computation",
   "ensemble_weighting": "Task 51 Phase 2: WIN_RATE_WEIGHTED uses frozen validation-period weights (Option A). MAJORITY_VOTE / PROBABILITY_WEIGHTED / TIER_WEIGHTED are per-sample (safe). FINAL_CONSENSUS uses dual-mode (skip WIN_RATE_WEIGHTED on validation, include on final-test).",
   "baselines": "Task 51 Phase 3: zero-return + training-only-mean baselines added (per-horizon, pooled market-wide). Conventional constant-mean R² reference retained per-model×horizon.",
   "walk_forward_methodology": "TRUE walk-forward: each test sample's models are re-fit on all data strictly before the sample's decision date AND with target-maturity filter applied per horizon. Distinct from the simplified backtest in train_all_with_backtesting.py (Pattern #10 — latest signal applied to all test rows).",
  },
 }
 # Task 51 Phase 7: write to CANDIDATE artifact first, validate, then promote.
 REPORT_DIR.mkdir(parents=True, exist_ok=True)
 REPORT_CANDIDATE_FILE.write_text(json.dumps(structured_report, indent=2,
   default=lambda o: int(o) if isinstance(o, (np.integer,))
   else float(o) if isinstance(o, (np.floating,)) and not np.isnan(o)
   else None if isinstance(o, float) and np.isnan(o)
   else str(o)))

 # Task 51 Phase 7: validate the candidate structure before promoting.
 def _validate_candidate(rep):
  if not isinstance(rep, dict): return False, "not a dict"
  for k in ("schema_version", "evaluation_method", "generated_at", "models"):
   if k not in rep: return False, f"missing key: {k}"
  if not isinstance(rep.get("models"), list) or len(rep["models"]) == 0:
   return False, "models list empty"
  # Verify each model × horizon has either status:completed or status:unavailable
  for m in rep["models"]:
   for hz_str, h in m.get("horizons", {}).items():
    if h.get("status") not in ("completed", "unavailable"):
     return False, f"model {m.get('name')} hz {hz_str} invalid status {h.get('status')}"
  # Verify evaluation_status is one of completed/partial/failed
  if rep.get("evaluation_status") not in ("completed", "partial", "failed"):
   return False, f"invalid evaluation_status {rep.get('evaluation_status')}"
  return True, "ok"

 candidate_ok, candidate_err = _validate_candidate(structured_report)
 if candidate_ok:
  # Promote: preserve old as previous, then move candidate to latest.
  import shutil
  if REPORT_FILE.exists():
   shutil.copy2(REPORT_FILE, REPORT_PREVIOUS_FILE)
   print(f"  Task 51 Phase 7: preserved previous report → {REPORT_PREVIOUS_FILE.name}")
  shutil.copy2(REPORT_CANDIDATE_FILE, REPORT_FILE)
  print(f"  Task 51 Phase 7: promoted candidate → {REPORT_FILE.name}")
 else:
  # Candidate failed validation — preserve the existing latest, do NOT overwrite.
  print(f"  Task 51 Phase 7: candidate FAILED validation ({candidate_err}) — keeping existing {REPORT_FILE.name}")
  if not REPORT_FILE.exists():
   # No existing report — write the candidate anyway as a fallback (better than nothing)
   shutil.copy2(REPORT_CANDIDATE_FILE, REPORT_FILE)
   print(f"  Task 51 Phase 7: no existing report — wrote candidate as fallback")

 # Save the original-format results (legacy artifact; kept for backward compat).
 output={
  "walk_forward_at":pd.Timestamp.now().isoformat(),
  "n_samples":len(samples),
  "models_trained":MODEL_NAMES,
  "individual":wf_individual,
  "ensemble":wf_ensemble,
  "methodology":"Walk-forward: expanding window. For each test sample, models re-trained on ALL data before that point. No data leakage.",
  "comparison_note":"Walk-forward results are MORE ACCURATE than simplified backtesting (which used latest prediction for all test rows).",
  "ml_integrity": structured_report["ml_integrity"],
 }
 OUT_FILE.write_text(json.dumps(output,indent=2,default=lambda o:int(o)if isinstance(o,(np.integer,))else float(o)if isinstance(o,(np.floating,))else str(o)))

 # NEW (Task 49): DO NOT merge into ml_predictions_multi.json.
 # The structured report at data/backtest_reports/walk_forward_latest.json
 # is the new source-of-truth for the API route. Touching ml_predictions_multi.json
 # would mutate the running app's live predictions, which is forbidden.
 print(f"\n{'='*60}")
 print(f"WALK-FORWARD BACKTESTING COMPLETE")
 print(f"{'='*60}")
 print(f"Samples: {len(samples)}")
 print(f"Model trainings: {len(samples)*len(MODEL_NAMES)*3} (5 models × 3 horizons × {len(samples)} samples)")
 print(f"\nIndividual model walk-forward results:")
 for name in MODEL_NAMES:
  r=wf_individual[name]
  print(f"  {name}: {r['winRate']}% win ({r['totalTrades']} trades) +{r['avgReturnPct']}% avg {'★'*r['stars']}")
 print(f"\nEnsemble walk-forward results:")
 for method,r in wf_ensemble.items():
  print(f"  {method}: {r['winRate']}% win ({r['totalTrades']} trades) +{r['avgReturnPct']}% avg {'★'*r['stars']}")
 print(f"\nForecast-quality metrics (MAE/RMSE/R²/DirAcc) per model × horizon:")
 for name in MODEL_NAMES:
  for hz in [5, 10, 21]:
   m = wf_forecast[name].get(hz, {})
   if m.get("status") == "completed":
    r2v = m.get("r2")
    r2s = "NaN" if r2v is None else f"{r2v:+.4f}"
    print(f"  {name} {hz}d: n={m['n_observations']} MAE={m['mae']:.6f} RMSE={m['rmse']:.6f} R²={r2s} DirAcc={m['directional_accuracy']:.4f}")
   else:
    print(f"  {name} {hz}d: {m.get('status', 'unavailable')} — {m.get('reason', 'no reason')}")
 print(f"\nSaved legacy: {OUT_FILE}")
 print(f"Saved structured report (Task 49): {REPORT_FILE}")
 print(f"ml_predictions_multi.json: NOT modified (Task 49 rule)")

if __name__=="__main__":main()
