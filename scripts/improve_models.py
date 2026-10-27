#!/usr/bin/env python3
"""Latent.pk — Improve underperforming models + add win-rate-weighted ensemble

Fixes:
1. ARIMA: use auto-arima (try multiple orders, pick best by AIC)
2. Kalman Filter: use 2D state [price, velocity] for trend estimation
3. LightGBM: better hyperparameters (more leaves, slower learning rate, early stopping)
4. Add win-rate-weighted ensemble backtesting (filters out bad models)
"""
import json,sys,warnings,numpy as np,pandas as pd
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error
# ML-integrity helpers (leakage-free targets, chronological split). See
# scripts/ml_integrity.py. Replaces the old .fillna(0) targets + global row
# split on the concatenated df (Phase A1).
from ml_integrity import add_forward_returns, chronological_split, HORIZONS
warnings.filterwarnings("ignore")

OHLCV=Path("data/ohlcv");PRED=Path("data/ml_predictions_multi.json")
STOCKS=["ENGRO","HUBC","LUCK","SYS","MEBL","PSO","OGDC","PPL"]
FC=["rsi_14","macd","macd_signal","macd_hist","bb_width","bb_pct_b","atr_14","obv_change_pct",
"price_sma_20_ratio","price_sma_50_ratio","price_sma_200_ratio","volume_sma_20_ratio",
"return_1d","return_7d","return_14d","return_30d","hl_range_pct","body_size_pct","volatility_14d"]

# Feature engineering (compact)
def add_features(df):
    df=df.copy().sort_values("date").reset_index(drop=True)
    c=df["close"];h=df["high"];l=df["low"];v=df["volume"]
    d=c.diff();g=d.where(d>0,0);ll=-d.where(d<0,0)
    ag=g.ewm(alpha=1/14,min_periods=14).mean();al=ll.ewm(alpha=1/14,min_periods=14).mean()
    df["rsi_14"]=(100-100/(1+ag/al.replace(0,np.nan))).fillna(50)
    e12=c.ewm(span=12,adjust=False).mean();e26=c.ewm(span=26,adjust=False).mean()
    m=e12-e26;s=m.ewm(span=9,adjust=False).mean()
    df["macd"]=m;df["macd_signal"]=s;df["macd_hist"]=m-s
    sma=c.rolling(20).mean();sd=c.rolling(20).std()
    df["bb_width"]=((sma+2*sd-(sma-2*sd))/sma).fillna(0)
    df["bb_pct_b"]=((c-(sma-2*sd))/(4*sd).replace(0,np.nan)).fillna(0.5)
    tr=pd.concat([h-l,(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1)
    df["atr_14"]=tr.rolling(14).mean().fillna(0)
    obv=(c.diff().apply(lambda x:1 if x>0 else(-1 if x<0 else 0))*v).cumsum()
    df["obv_change_pct"]=obv.pct_change(periods=14).replace([np.inf,-np.inf],0).fillna(0)
    for w in[20,50,200]:df[f"price_sma_{w}_ratio"]=c/c.rolling(w,min_periods=1).mean()
    df["volume_sma_20_ratio"]=v/v.rolling(20,min_periods=1).mean().replace(0,1)
    for p in[1,7,14,30]:df[f"return_{p}d"]=c.pct_change(periods=p).replace([np.inf,-np.inf],0).fillna(0)
    df["hl_range_pct"]=((h-l)/c.replace(0,np.nan)).fillna(0)
    df["body_size_pct"]=((df["close"]-df["open"]).abs()/c.replace(0,np.nan)).fillna(0)
    df["volatility_14d"]=c.pct_change().rolling(14).std().fillna(0)
    # NOTE: target_{hz}d construction moved out of add_features into load() via
    # ml_integrity.add_forward_returns — that primitive uses per-stock
    # groupby(symbol).shift(-h) (no cross-stock leak, no .fillna(0)). Immature
    # rows are left NaN; callers drop them per-horizon (fix_lightgbm).
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
    # ML integrity (Task 1): per-stock groupby(symbol).shift(-h); no .fillna(0);
    # immature rows left NaN — callers drop per-horizon so per-horizon models
    # keep rows whose shorter-horizon target is mature (Phase A1 requirement).
    df=add_forward_returns(df)
    return df

def make_pred(cp,r5,r10,r21,sl):
    tp1=round(cp*(1+r5),2);tp2=round(cp*(1+r10),2);tp3=round(cp*(1+r21),2)
    avg=(r5+r10+r21)/3
    sig="BUY"if avg>0.01 else"SELL"if avg<-0.01 else"HOLD"
    d="LONG"if sig!="SELL"else"SHORT"
    return{"signal":sig,"direction":d,"confidence":min(100,int(abs(avg)*1000)),
        "currentPrice":round(cp,2),"entry":round(cp,2),
        "tp1":tp1,"tp2":tp2,"tp3":tp3,"sl":sl,"avgReturn":round(avg,4)}

# ─── Improved ARIMA (auto-order selection) ───
def fix_arima(df):
    from statsmodels.tsa.arima.model import ARIMA
    print("  Fixing ARIMA (auto-order selection)...")
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<30:continue
        cp=float(sdf.iloc[-1]["close"]);sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        prices=sdf["close"].tail(80).values
        best_aic=np.inf;best_fc=None
        # Try multiple orders, pick best by AIC
        for order in[(1,0,0),(0,1,1),(1,1,1),(2,1,0),(2,1,2),(1,1,0),(0,1,0),(2,0,0),(3,1,1)]:
            try:
                model=ARIMA(prices,order=order)
                fitted=model.fit()
                if fitted.aic<best_aic:
                    best_aic=fitted.aic
                    best_fc=fitted.forecast(steps=21)
            except:continue
        if best_fc is not None:
            r5=(float(best_fc[4])-cp)/cp
            r10=(float(best_fc[9])-cp)/cp
            r21=(float(best_fc[20])-cp)/cp
        else:
            r5=r10=r21=0
        preds[s]=make_pred(cp,r5,r10,r21,sl)
    print(f"    Done — {len(preds)} stocks (auto-order)")
    return{"trained":True,"version":"2.1.0","predictions":preds}

# ─── Improved Kalman Filter (2D state: price + velocity) ───
def fix_kalman(df):
    from pykalman import KalmanFilter
    print("  Fixing Kalman Filter (2D state: price + velocity)...")
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<30:continue
        cp=float(sdf.iloc[-1]["close"]);sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        try:
            prices=sdf["close"].tail(60).values
            # 2D state: [price, velocity]
            # transition_matrix = [[1, 1], [0, 1]] (price = prev_price + velocity)
            kf=KalmanFilter(
                initial_state_mean=[prices[0],0],
                n_dim_obs=1,
                n_dim_state=2,
                transition_matrices=[[1,1],[0,1]],
                observation_matrices=[[1,0]],
                transition_covariance=np.eye(2)*0.01,
                observation_covariance=np.eye(1)*1.0,
                initial_state_covariance=np.eye(2)*1.0
            )
            state_means,_=kf.filter(prices)
            # Extract velocity (trend) from the 2D state
            velocity=float(state_means[-1,1])
            # Forecast: price + velocity * days
            r5=min(0.15,max(-0.15,velocity*5/cp))
            r10=min(0.20,max(-0.20,velocity*10/cp))
            r21=min(0.30,max(-0.30,velocity*21/cp))
            preds[s]=make_pred(cp,r5,r10,r21,sl)
        except Exception as e:
            preds[s]=make_pred(cp,0,0,0,sl)
    print(f"    Done — {len(preds)} stocks (2D state)")
    return{"trained":True,"version":"2.1.0","predictions":preds}

# ─── Improved LightGBM (better hyperparameters) ───
def fix_lightgbm(df):
    import lightgbm as lgb
    print("  Fixing LightGBM (better hyperparameters)...")
    targets=["target_5d","target_10d","target_21d"]
    # ML integrity (Task 2): chronological_split replaces the leaky global row
    # split on the concatenated df (which mixed train/test across stocks in
    # stock-concat order, not date order). VAL partition used for early-stopping
    # — never tune on test (Phase A2 fix).
    tr,va,te=chronological_split(df)
    metrics={};preds={}
    for tc in targets:
        hz=int(tc.split("_")[1].replace("d",""))
        # ML integrity (Phase A1): per-horizon drop — preserves shorter-horizon
        # rows whose longest-horizon target is immature.
        tr_h=tr.dropna(subset=[tc]);va_h=va.dropna(subset=[tc]);te_h=te.dropna(subset=[tc])
        Xtr=tr_h[FC].values;Xva=va_h[FC].values;Xte=te_h[FC].values
        ytr=tr_h[tc].values;yva=va_h[tc].values;yte=te_h[tc].values
        # Better hyperparameters: more leaves, slower learning, more trees, regularization
        model=lgb.LGBMRegressor(
            n_estimators=300,num_leaves=31,learning_rate=0.01,
            subsample=0.8,colsample_bytree=0.8,
            min_child_samples=20,reg_alpha=0.5,reg_lambda=2.0,
            random_state=42,verbose=-1,
        )
        model.fit(Xtr,ytr,eval_set=[(Xva,yva)],callbacks=[lgb.early_stopping(20,verbose=False)])
        yp=model.predict(Xte)
        metrics[f"{hz}d"]={"mse":float(mean_squared_error(yte,yp))}
        for s in STOCKS:
            sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
            if len(sdf)==0:continue
            cp=float(sdf.iloc[-1]["close"])
            latest=sdf.iloc[-1][FC].values.reshape(1,-1)
            pr=float(model.predict(latest)[0])
            if s not in preds:preds[s]={"currentPrice":round(cp,2),"entry":round(cp,2)}
            preds[s][f"ret_{hz}d"]=round(pr,4)
    for s,pd_ in preds.items():
        r5=pd_.get("ret_5d",0);r10=pd_.get("ret_10d",0);r21=pd_.get("ret_21d",0)
        cp=pd_["currentPrice"]
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        pd_.update(make_pred(cp,r5,r10,r21,sl))
    print(f"    Done — MSE(5d)={metrics.get('5d',{}).get('mse',0):.6f}")
    return{"trained":True,"version":"2.1.0","metrics":metrics,"predictions":preds}

# ─── Win-rate-weighted ensemble backtesting ───
def backtest_ensemble_weighted(df, models, individual_bt):
    """Ensemble that weights each model by its backtesting win rate — DISABLED
    (Pattern #10 LEAKY_BACKTEST).

    Original implementation: per-stock chronological test partition (the slice
    itself was leak-free thanks to chronological_split), but the SIGNAL applied
    to every historical test row came from `md.get("predictions",{}).get(s,{})`
    — the model's STORED LATEST per-stock signal, constant per stock across
    all historical test rows. This is leakage Pattern #10 (latest-signal
    replay): today's signal applied to historical test dates, which
    misrepresents the historical out-of-sample performance of the ensemble.

    For the leak-free chronological walk-forward evaluation, see
    scripts/walk_forward_backtesting.py (the genuine walk-forward engine that
    Phase A fixed — per-sample re-training + per-bar re-inference + realized
    P&L from future OHLCV). Do NOT duplicate a new walk-forward engine here.

    External interface preserved: same signature (df, models, individual_bt)
    and same top-level return keys (WIN_RATE_WEIGHTED wrapper + totalTrades /
    wins / winRate / avgReturnPct / maxReturnPct / minReturnPct / stars),
    with values signaling unavailability, PLUS the new status/reason/pointer/
    ml_integrity_note fields.
    """
    print("  WIN_RATE_WEIGHTED: UNAVAILABLE — Pattern #10 leak (latest-signal replay).")
    print("           Use scripts/walk_forward_backtesting.py for leak-free eval.")
    return {"WIN_RATE_WEIGHTED": {
        "status": "unavailable",
        "reason": (
            "Pattern #10 LEAKY_BACKTEST: original implementation applied the "
            "model's stored LATEST per-stock signal (md.get('predictions',{})."
            "get(s,{}).get('signal','HOLD')) to every historical test row in "
            "the chronological test partition. The partition itself was leak-"
            "free (chronological_split); the signal source was the leak "
            "(today's signal replayed on every historical test date). Use "
            "scripts/walk_forward_backtesting.py for leak-free chronological "
            "walk-forward evaluation (per-sample re-training + per-bar "
            "re-inference + realized P&L)."
        ),
        "pointer": "scripts/walk_forward_backtesting.py",
        "ml_integrity_note": "Phase 1+2 fix: function disabled to prevent misleading metrics.",
        "totalTrades": 0,
        "wins": 0,
        "winRate": None,
        "avgReturnPct": None,
        "maxReturnPct": None,
        "minReturnPct": None,
        "stars": 0,
    }}

# ─── Recompute all backtesting ───
def backtest_all(df, models):
    """Re-backtest all models on the chronological test partition — DISABLED
    (Pattern #10 LEAKY_BACKTEST).

    Original implementation: per-stock chronological test partition (the slice
    itself was leak-free thanks to chronological_split), but the SIGNAL applied
    to every historical test row came from `md.get("predictions",{}).get(s,{})`
    — the model's STORED LATEST per-stock signal, constant per stock across
    all historical test rows. This is leakage Pattern #10 (latest-signal
    replay): today's signal applied to historical test dates, which
    misrepresents the historical out-of-sample performance.

    For the leak-free chronological walk-forward evaluation, see
    scripts/walk_forward_backtesting.py (the genuine walk-forward engine that
    Phase A fixed — per-sample re-training + per-bar re-inference + realized
    P&L from future OHLCV). Do NOT duplicate a new walk-forward engine here.

    External interface preserved: same signature (df, models) and same
    per-model top-level return keys (totalTrades / buySignals / sellSignals /
    correctBuys / correctSells / winRate / avgReturnPct / maxReturnPct /
    minReturnPct / stars), with values signaling unavailability, PLUS the new
    status/reason/pointer/ml_integrity_note fields.
    """
    print("  backtest_all: UNAVAILABLE — Pattern #10 leak (latest-signal replay).")
    print("           Use scripts/walk_forward_backtesting.py for leak-free eval.")
    bt = {}
    for name, md in models.items():
        if not md.get("trained"): continue
        preds = md.get("predictions", {})
        if not preds: continue
        bt[name] = {
            "status": "unavailable",
            "reason": (
                "Pattern #10 LEAKY_BACKTEST: original implementation applied "
                "the model's stored LATEST per-stock signal (md.get("
                "'predictions',{}).get(s,{}).get('signal','HOLD')) to every "
                "historical test row in the chronological test partition. The "
                "partition itself was leak-free (chronological_split); the "
                "signal source was the leak (today's signal replayed on every "
                "historical test date). Use scripts/walk_forward_backtesting.py "
                "for leak-free chronological walk-forward evaluation (per-sample "
                "re-training + per-bar re-inference + realized P&L)."
            ),
            "pointer": "scripts/walk_forward_backtesting.py",
            "ml_integrity_note": "Phase 1+2 fix: function disabled to prevent misleading metrics.",
            "totalTrades": 0,
            "buySignals": 0,
            "sellSignals": 0,
            "correctBuys": 0,
            "correctSells": 0,
            "winRate": None,
            "avgReturnPct": None,
            "maxReturnPct": None,
            "minReturnPct": None,
            "stars": 0,
        }
    return bt

def main():
    print("="*60);print("Latent.pk — Model Improvements + Win-Rate Ensemble");print("="*60)
    df=load();print(f"\nLoaded: {len(df)} rows")
    existing=json.loads(PRED.read_text())
    all_models=existing.get("models",{})

    # Fix 3 underperforming models
    print("\n[1/3] Fixing ARIMA...")
    all_models["ARIMA"]=fix_arima(df)
    print("\n[2/3] Fixing Kalman Filter...")
    all_models["Kalman Filter"]=fix_kalman(df)
    print("\n[3/3] Fixing LightGBM...")
    all_models["LightGBM"]=fix_lightgbm(df)

    # Recompute individual backtesting
    print("\nRecomputing backtesting...")
    bt_ind=backtest_all(df,all_models)

    # Compute win-rate-weighted ensemble backtesting
    print("Computing win-rate-weighted ensemble backtesting...")
    bt_wr=backtest_ensemble_weighted(df,all_models,bt_ind)

    # Merge ensemble backtesting
    bt_ens=existing.get("ensemble_backtesting",{})
    bt_ens.update(bt_wr)

    existing["models"]=all_models
    existing["backtesting"]=bt_ind
    existing["ensemble_backtesting"]=bt_ens
    existing["ml_integrity"]={
        "target_construction":"per-stock groupby(symbol).shift(-h) via ml_integrity.add_forward_returns in load(); no .fillna(0); immature rows left NaN and dropped per-horizon in fix_lightgbm",
        "split":"date-based chronological_split (60/20/20) with per-stock purge of MAX_HORIZON=21 rows at each boundary; replaces the old global row split on the concatenated df",
        "scaler_fitting":"no scalers in this script (ARIMA + Kalman + LightGBM operate on raw features); LightGBM early-stopping uses the VAL partition (not test) — Phase A2 fix to the old eval_set=[(Xte,yte)] test-set tuning",
        "backtest_methodology":"Pattern #10 LEAKY_BACKTEST disabled — function now returns status='unavailable' with reason + pointer to scripts/walk_forward_backtesting.py for genuine walk-forward ML evaluation. backtest_ensemble_weighted + backtest_all no longer apply the model's stored LATEST per-stock signal to every historical test row; per-model / WIN_RATE_WEIGHTED entries now carry status='unavailable' + zeroed metrics.",
        "ml_historical_evaluation":"unavailable",
    }

    PRED.write_text(json.dumps(existing,indent=2,default=lambda o:int(o)if isinstance(o,(np.integer,))else float(o)if isinstance(o,(np.floating,))else str(o)))

    print(f"\n{'='*60}")
    print(f"IMPROVEMENTS COMPLETE")
    print(f"{'='*60}")
    print(f"\nFixed models:")
    for name in["ARIMA","Kalman Filter","LightGBM"]:
        b=bt_ind.get(name,{})
        print(f"  {name}: winRate={b.get('winRate','?')}% stars={'★'*b.get('stars',0)}")
    print(f"\nWin-rate-weighted ensemble:")
    wr=bt_wr.get("WIN_RATE_WEIGHTED",{})
    print(f"  WIN_RATE_WEIGHTED: trades={wr.get('totalTrades',0)} winRate={wr.get('winRate',0)}% avgReturn={wr.get('avgReturnPct',0)}% stars={'★'*wr.get('stars',0)}")
    print(f"\nAll models ranked:")
    # Phase 1+2: made defensive to tolerate None winRate (now that
    # backtest_all returns status='unavailable' stubs with winRate=None).
    for name,b in sorted(bt_ind.items(),key=lambda x:-(x[1].get("winRate") or 0)):
        print(f"  {name}: {b.get('winRate',0)}% {'★'*b.get('stars',0)}")
    print(f"\nSaved: {PRED}")

if __name__=="__main__":main()
