#!/usr/bin/env python3
"""Latent.pk — Train ALL classical models on ALL DB stocks + compute ensembles + backtest.
Processes in chunks of 50 stocks to avoid OOM. Saves intermediate after each chunk.
Checks server health after each chunk.
"""
import json, sqlite3, sys, os, warnings, subprocess, time
import numpy as np, pandas as pd
import xgboost as xgb, lightgbm as lgb, catboost as cb
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.preprocessing import StandardScaler
from pathlib import Path
# ML-integrity helpers (leakage-free targets). See scripts/ml_integrity.py.
# Replaces the old .fillna(0) on per-horizon targets (Phase A1).
from ml_integrity import drop_immature_targets, HORIZONS
warnings.filterwarnings("ignore")

DB = "db/custom.db"
OUT = Path("data/ml_predictions_multi.json")
CHUNK = 50
FC = ["rsi_14","macd","macd_signal","macd_hist","bb_width","bb_pct_b","atr_14","obv_change_pct",
      "price_sma_20_ratio","price_sma_50_ratio","price_sma_200_ratio","volume_sma_20_ratio",
      "return_1d","return_7d","return_14d","return_30d","hl_range_pct","body_size_pct","volatility_14d"]

# ─── Feature computation (from the existing script) ───
def compute_rsi(p,n=14):
 d=p.diff();g=d.where(d>0,0);l=-d.where(d<0,0)
 ag=g.ewm(alpha=1/n,min_periods=n).mean();al=l.ewm(alpha=1/n,min_periods=n).mean()
 return(100-100/(1+ag/al.replace(0,np.nan))).fillna(50)
def compute_macd(p):
 e12=p.ewm(span=12,adjust=False).mean();e26=p.ewm(span=26,adjust=False).mean()
 m=e12-e26;s=m.ewm(span=9,adjust=False).mean();return m,s,m-s
def compute_bb(p,w=20):
 sma=p.rolling(w).mean();sd=p.rolling(w).std()
 return((sma+2*sd-(sma-2*sd))/sma.replace(0,1)).fillna(0),((p-(sma-2*sd))/(4*sd).replace(0,np.nan)).fillna(0.5)
def compute_atr(h,l,c,n=14):
 tr=pd.concat([(h-l),(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1)
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
 return df
def add_labels(df):
 df=df.copy()
 # ML integrity (Task 1): per-stock shift inside train_stock (sdf is one
 # stock, so df["close"].shift(-h) does NOT cross stock boundaries). No
 # .fillna(0) — immature rows are left NaN and dropped per-horizon inside
 # the train_stock per-horizon loop (Phase A1 fix to the old fillna(0) that
 # zeroed unmatured/suspended future returns).
 for hz in[5,10,21]:df[f"target_{hz}d"]=((df["close"].shift(-hz)-df["close"])/df["close"])
 return df

# ─── DB reader ───
def load_symbols():
 conn=sqlite3.connect(DB);syms=pd.read_sql("SELECT DISTINCT symbol FROM OhlcvBar ORDER BY symbol",conn)["symbol"].tolist();conn.close()
 return syms
def load_ohlcv(sym):
 conn=sqlite3.connect(DB)
 df=pd.read_sql(f"SELECT date,open,high,low,close,volume FROM OhlcvBar WHERE symbol='{sym}' ORDER BY date ASC",conn)
 conn.close()
 df=df[df["volume"]>0].reset_index(drop=True)
 return df

# ─── Training (4 classical models per stock) ───
def train_stock(df):
 if len(df)<60: return None
 sdf=add_features(df);sdf=add_labels(sdf)
 split=int(len(sdf)*0.8);tr=sdf.iloc[:split];te=sdf.iloc[split:]
 Xtr=tr[FC].values;Xte=te[FC].values
 cp=float(sdf.iloc[-1]["close"])
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 sl_low=float(sdf["low"].tail(14).min())
 cfg={
  "XGBoost":lambda:xgb.XGBRegressor(n_estimators=100,max_depth=3,learning_rate=0.05,subsample=0.7,colsample_bytree=0.7,random_state=42),
  "LightGBM":lambda:lgb.LGBMRegressor(n_estimators=100,num_leaves=15,learning_rate=0.05,subsample=0.7,random_state=42,verbose=-1),
  "CatBoost":lambda:cb.CatBoostRegressor(iterations=100,depth=3,learning_rate=0.05,random_state=42,verbose=0,allow_writing_files=False),
  "Random Forest":lambda:RandomForestRegressor(n_estimators=100,max_depth=5,min_samples_leaf=15,max_features=0.7,random_state=42,n_jobs=-1),
 }
 preds={}
 for name,factory in cfg.items():
  try:
   m=factory()
   r5,r10,r21=None,None,None
   for hz,col in[(5,"target_5d"),(10,"target_10d"),(21,"target_21d")]:
    # ML integrity (Phase A1): per-horizon drop — drop ONLY rows whose
    # THIS-horizon target is NaN (preserves shorter-horizon rows whose
    # longest-horizon target is immature). Re-pull Xtr per-horizon since row
    # counts may differ across horizons.
    tr_h=tr.dropna(subset=[col])
    Xtr=tr_h[FC].values
    y=tr_h[col].values
    m.fit(Xtr,y)
    p=m.predict(sdf[FC].values[-1:])[0]
    if hz==5:r5=p
    elif hz==10:r10=p
    else:r21=p
   avg=(r5+r10+r21)/3
   sig="BUY" if avg>0.01 else "SELL" if avg<-0.01 else "HOLD"
   d="LONG" if sig!="SELL" else "SHORT"
   preds[name]={
    "signal":sig,"direction":d,"confidence":min(100,int(abs(avg)*1000)),
    "currentPrice":round(cp,2),"entry":round(cp,2),
    "tp1":round(cp*(1+r5),2),"tp2":round(cp*(1+r10),2),"tp3":round(cp*(1+r21),2),
    "sl":round(sl_low,2),"avgReturn":round(float(avg),4)
   }
  except Exception as e:
   print(f"    {name} failed: {e}")
 return preds

# ─── Ensemble computation ───
def compute_ensembles(models_out):
 ensembles={}
 # Collect per-stock per-model predictions
 all_syms=set()
 for m in models_out.values():
  if "predictions" in m:
   all_syms.update(m["predictions"].keys())
 for sym in all_syms:
  model_preds=[]
  for mname, mdata in models_out.items():
   p=mdata.get("predictions",{}).get(sym)
   if p and p.get("signal") in("BUY","SELL"):
    model_preds.append({"name":mname,"signal":p["signal"],"direction":p.get("direction","LONG"),
     "confidence":p.get("confidence",0),"entry":p.get("entry",0),"sl":p.get("sl",0),
     "tp1":p.get("tp1",0),"tp2":p.get("tp2",0),"tp3":p.get("tp3",0),"avgReturn":p.get("avgReturn",0)})
  if not model_preds:continue
  cp=model_preds[0]["entry"]
  # Majority Vote
  bc=sum(1 for p in model_preds if p["signal"]=="BUY")
  sc=sum(1 for p in model_preds if p["signal"]=="SELL")
  hc=len(model_preds)-bc-sc
  sig="BUY" if bc>sc and bc>hc else "SELL" if sc>bc and sc>hc else "HOLD"
  # Probability-Weighted
  avg_ret=sum(p["avgReturn"] for p in model_preds)/len(model_preds)
  pw_sig="BUY" if avg_ret>0.01 else "SELL" if avg_ret<-0.01 else "HOLD"
  # CL-Ensemble (LGB70+Log30)
  lgb_preds=[p for p in model_preds if "LightGBM" in p["name"]]
  lgb_sig=lgb_preds[0]["signal"] if lgb_preds else "HOLD"
  # CL-Extender (all 4 models weighted)
  cl_sig="BUY" if bc>=2 else "SELL" if sc>=2 else "HOLD"
  d="LONG" if sig!="SELL" else "SHORT"
  # SL/TP averages
  sls=[p["sl"] for p in model_preds if p["sl"]>0]
  tp1s=[p["tp1"] for p in model_preds if p["tp1"]>0]
  tp2s=[p["tp2"] for p in model_preds if p["tp2"]>0]
  tp3s=[p["tp3"] for p in model_preds if p["tp3"]>0]
  sl=np.mean(sls) if sls else cp*0.97
  tp1=np.mean(tp1s) if tp1s else cp*1.03
  tp2=np.mean(tp2s) if tp2s else cp*1.06
  tp3=np.mean(tp3s) if tp3s else cp*1.09
  for ens_name,ens_sig in[("MAJORITY_VOTE",sig),("PROBABILITY_WEIGHTED",pw_sig),("CL_ENSEMBLE",lgb_sig),("CL_EXTENDER",cl_sig)]:
   if ens_sig not in("BUY","SELL"):continue
   ensembles.setdefault(ens_name,{})
   ensembles[ens_name][sym]={
    "signal":ens_sig,"direction":"LONG" if ens_sig!="SELL" else "SHORT",
    "confidence":min(100,int(abs(avg_ret)*1000)),
    "currentPrice":round(cp,2),"entry":round(cp,2),
    "tp1":round(float(tp1),2),"tp2":round(float(tp2),2),"tp3":round(float(tp3),2),
    "sl":round(float(sl),2),"avgReturn":round(float(avg_ret),4)
   }
 return ensembles

# ─── Backtesting ───
def backtest_predictions(preds_dict):
 """Compute predicted-positive-rate backtest metrics — RELABELED
 (Pattern #11 LEAKY_BACKTEST — predicted-as-realized).

 Each prediction = 1 trade; the `wins` field is computed from the model's
 PREDICTED avgReturn being positive (`p.get('avgReturn',0) > 0`), NOT from a
 realized-outcome simulation against future OHLCV. So:
   - `wins` is actually a PREDICTED-positive count (informational, NOT a
     realized win). Kept for backward compat with downstream readers.
   - `winRate` is the predicted-positive RATE (a meta-metric, NOT a true
     out-of-sample win rate).
   - new alias `predicted_positive_count` = `wins` (explicit informational
     name).
   - `realized_winRate: 'unavailable'` with reason (no realized-outcome
     simulation here).
   - `ml_historical_evaluation: 'unavailable'` (no chronological walk-forward
     evaluation done in this script).

 External interface preserved: existing keys (totalTrades / wins / winRate /
 avgReturnPct / maxReturnPct / minReturnPct) all retained with their original
 semantics, just accompanied by the new informational alias +
 realized_winRate='unavailable' + ml_historical_evaluation='unavailable'.

 For a leak-free realized-outcome backtest, see
 scripts/walk_forward_backtesting.py (per-sample re-training + per-bar
 re-inference + realized P&L against future OHLCV).
 """
 results={}
 for model_name, model_preds in preds_dict.items():
  total=len(model_preds)
  # Phase 2 Pattern #11: `wins` is the predicted-positive count (avgReturn>0),
  # NOT a realized-outcome win. Kept for backward compat with downstream
  # readers that already use this field. See predicted_positive_count alias
  # below for the explicit informational name.
  wins=0;returns=[]
  for sym,p in model_preds.items():
   ret=p.get("avgReturn",0)
   returns.append(ret)
   if ret>0:wins+=1
  wr=(wins/total*100) if total else 0
  avg_r=np.mean(returns) if returns else 0
  results[model_name]={
   "totalTrades":total,
   "wins":wins,  # Phase 2 Pattern #11: actually PREDICTED-positive count; see predicted_positive_count alias
   "predicted_positive_count":wins,  # informational, NOT a realized win
   "winRate":round(wr,1),  # Phase 2: predicted-positive rate, NOT a realized win rate
   "realized_winRate":"unavailable",
   "realized_winRate_reason":(
    "Pattern #11 LEAKY_BACKTEST: 'win' was computed from the model's "
    "PREDICTED avgReturn (p.get('avgReturn', 0) > 0), not from a realized-"
    "outcome simulation against future OHLCV. The 'winRate' above is the "
    "predicted-positive rate (a meta-metric). Use "
    "scripts/walk_forward_backtesting.py for a leak-free realized-outcome "
    "backtest (per-sample re-training + per-bar re-inference + realized P&L)."
   ),
   "ml_historical_evaluation":"unavailable",
   "avgReturnPct":round(avg_r*100,2),"maxReturnPct":round(max(returns)*100,2) if returns else 0,
   "minReturnPct":round(min(returns)*100,2) if returns else 0
  }
 return results

# ─── Main ───
def main():
 syms=load_symbols()
 print(f"Total stocks in DB: {len(syms)}")
 print(f"Chunk size: {CHUNK}")
 total_chunks=(len(syms)+CHUNK-1)//CHUNK
 # Load existing for intermediate saves
 out={}
 if OUT.exists():
  try:out=json.loads(OUT.read_text())
  except:pass
 out.setdefault("models",{})
 out["data_source"]="sqlite_db"
 out["stocks_count"]=len(syms)
 for ci in range(0,len(syms),CHUNK):
  chunk=syms[ci:ci+CHUNK]
  cn=ci//CHUNK+1
  print(f"\n{'='*60}")
  print(f"Chunk {cn}/{total_chunks}: {chunk[0]}..{chunk[-1]} ({len(chunk)} stocks)")
  print(f"{'='*60}")
  for sym in chunk:
   try:
    df=load_ohlcv(sym)
    if len(df)<60:print(f"  skip {sym} ({len(df)} bars)");continue
    preds=train_stock(df)
    if preds:
     for mn,mp in preds.items():
      out["models"].setdefault(mn,{"trained":True,"metrics":{},"predictions":{}})
      out["models"][mn]["predictions"][sym]=mp
     print(f"  ✓ {sym}: {len(preds)} models trained")
    else:
     print(f"  ✗ {sym}: no predictions")
   except Exception as e:
    print(f"  ✗ {sym}: {e}")
  # Save intermediate
  out["trained_at"]=pd.Timestamp.now().isoformat()
  OUT.parent.mkdir(parents=True,exist_ok=True)
  OUT.write_text(json.dumps(out,indent=2,default=lambda o:int(o) if isinstance(o,(np.integer,)) else float(o) if isinstance(o,(np.floating,)) else str(o)))
  print(f"\n  Saved intermediate ({sum(1 for m in out['models'].values() for _ in m.get('predictions',{}))} total predictions)")
  # Check server
  try:
   r=subprocess.run(["curl","-s","-o","/dev/null","-w","%{http_code}","http://127.0.0.1:3000/"],capture_output=True,text=True,timeout=10)
   print(f"  Server: HTTP {r.stdout}")
  except:
   print("  Server: check failed (training may be using resources)")
 # Compute ensembles
 print(f"\n{'='*60}\nComputing ensembles...\n{'='*60}")
 ens=compute_ensembles(out["models"])
 for ens_name,ens_preds in ens.items():
  out[f"{ens_name.lower()}_predictions"]=ens_preds
  print(f"  {ens_name}: {len(ens_preds)} stocks")
 # Backtest
 print(f"\nBacktesting...")
 bt_models=backtest_predictions({k:v["predictions"] for k,v in out["models"].items() if "predictions" in v})
 out["backtesting"]=bt_models
 bt_ens=backtest_predictions(ens)
 out["ensemble_backtesting"]=bt_ens
 for name,stats in{**bt_models,**bt_ens}.items():
  print(f"  {name}: {stats['winRate']}% win, {stats['totalTrades']} trades, avg {stats['avgReturnPct']}%")
 # Final save
 out["trained_at"]=pd.Timestamp.now().isoformat()
 out["ml_integrity"]={
  "target_construction":"per-stock shift(-h) inside add_labels (called per-stock in train_stock; sdf is one stock so shift does NOT cross stock boundaries); no .fillna(0); immature rows left NaN and dropped per-horizon inside the train_stock loop",
  "split":"per-stock chronological 80/20 inside train_stock (sdf is sorted by date in add_features so int(len(sdf)*0.8) IS chronological; per-stock-only training, no concatenated df)",
  "scaler_fitting":"no scalers in this script (regressors operate on raw FC features)",
  "backtest_methodology":"Pattern #11 LEAKY_BACKTEST disabled — wins/winRate relabeled as predicted_positive_count (informational only); realized_winRate marked unavailable with reason; pointer to scripts/walk_forward_backtesting.py. backtest_predictions() still computes the predicted-positive count from p.get('avgReturn',0)>0 but each entry now carries predicted_positive_count alias + realized_winRate='unavailable' + realized_winRate_reason + ml_historical_evaluation='unavailable'.",
  "ml_historical_evaluation":"unavailable",
 }
 OUT.write_text(json.dumps(out,indent=2,default=lambda o:int(o) if isinstance(o,(np.integer,)) else float(o) if isinstance(o,(np.floating,)) else str(o)))
 print(f"\n✅ Done! {OUT} updated. {len(syms)} stocks, 4 models, {len(ens)} ensembles.")

if __name__=="__main__":
 main()
