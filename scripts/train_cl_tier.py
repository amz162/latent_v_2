#!/usr/bin/env python3
"""Latent.pk — Train CL Tier (Classical/Linear) models

7 new models: ARIMA, Holt-Winters, GARCH, Ridge, Kalman, Prophet, GRU
4 copied: XGBoost, LightGBM, Random Forest, LSTM (from existing predictions)

Saves to data/ml_predictions_multi.json under models with tier="CL"
"""
import json, sys, warnings, numpy as np, pandas as pd
from pathlib import Path
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error
# ML-integrity helpers (leakage-free targets, chronological split, train-only
# scalers). See scripts/ml_integrity.py. Replaces the old .fillna(0) targets,
# global row split on concatenated df, full-history scaler fit, and row-index
# sequence split (Phase A1 + A2 + A3c).
from ml_integrity import (
    add_forward_returns, drop_immature_targets, chronological_split,
    fit_scaler_on_train, per_stock_train_idx, split_sequences_by_date,
    HORIZONS, MAX_HORIZON,
)
warnings.filterwarnings("ignore")

OHLCV = Path("data/ohlcv")
PRED_FILE = Path("data/ml_predictions_multi.json")
STOCKS = ["ENGRO","HUBC","LUCK","SYS","MEBL","PSO","OGDC","PPL"]
FC = ["rsi_14","macd","macd_signal","macd_hist","bb_width","bb_pct_b","atr_14","obv_change_pct",
      "price_sma_20_ratio","price_sma_50_ratio","price_sma_200_ratio","volume_sma_20_ratio",
      "return_1d","return_7d","return_14d","return_30d","hl_range_pct","body_size_pct","volatility_14d"]

def compute_rsi(p,n=14):
    d=p.diff();g=d.where(d>0,0);l=-d.where(d<0,0)
    ag=g.ewm(alpha=1/n,min_periods=n).mean();al=l.ewm(alpha=1/n,min_periods=n).mean()
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
    # ML integrity (Task 1): per-stock shift(-h) inside the per-stock load()
    # loop (sdf is one stock, so shift does NOT cross stock boundaries). No
    # .fillna(0) — immature rows are left NaN; callers drop per-horizon.
    for hz in[5,10,21]:df[f"target_{hz}d"]=((df["close"].shift(-hz)-df["close"])/df["close"])
    return df

def load():
    frames=[]
    for s in STOCKS:
        p=OHLCV/f"{s}.csv"
        if not p.exists():continue
        df=pd.read_csv(p,usecols=range(6));df=df[df["volume"]>0].reset_index(drop=True)
        if len(df)<50:continue
        df=add_features(df);df["symbol"]=s;frames.append(df)
    return pd.concat(frames,ignore_index=True) if frames else pd.DataFrame()

def make_pred(cp, r5, r10, r21, sl):
    """Helper to create prediction dict."""
    tp1=round(cp*(1+r5),2);tp2=round(cp*(1+r10),2);tp3=round(cp*(1+r21),2)
    avg=(r5+r10+r21)/3
    sig="BUY" if avg>0.01 else "SELL" if avg<-0.01 else "HOLD"
    d="LONG" if sig!="SELL" else "SHORT"
    return {"signal":sig,"direction":d,"confidence":min(100,int(abs(avg)*1000)),
        "currentPrice":round(cp,2),"entry":round(cp,2),
        "tp1":tp1,"tp2":tp2,"tp3":tp3,"sl":sl,"avgReturn":round(avg,4)}

def get_sl(df, s):
    sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
    return round(float(np.min(sdf["low"].tail(14).values)),2), float(sdf.iloc[-1]["close"])

# ─── ARIMA ───
def train_arima(df):
    from statsmodels.tsa.arima.model import ARIMA
    print("  Training ARIMA...")
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<30:continue
        cp=float(sdf.iloc[-1]["close"]);sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        try:
            prices=sdf["close"].tail(60).values
            model=ARIMA(prices,order=(2,1,0))
            fitted=model.fit()
            fc=fitted.forecast(steps=21)
            r5=(float(fc[4])-cp)/cp;r10=(float(fc[9])-cp)/cp;r21=(float(fc[20])-cp)/cp
            preds[s]=make_pred(cp,r5,r10,r21,sl)
        except Exception as e:
            preds[s]=make_pred(cp,0,0,0,sl)
    print(f"    Done — {len(preds)} stocks")
    return {"trained":True,"version":"2.0.0","predictions":preds}

# ─── Holt-Winters (Exponential Smoothing) ───
def train_holt_winters(df):
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    print("  Training Holt-Winters...")
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<30:continue
        cp=float(sdf.iloc[-1]["close"]);sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        try:
            prices=sdf["close"].tail(60).values
            model=ExponentialSmoothing(prices,trend="add",seasonal=None)
            fitted=model.fit()
            fc=fitted.forecast(21)
            r5=(float(fc[4])-cp)/cp;r10=(float(fc[9])-cp)/cp;r21=(float(fc[20])-cp)/cp
            preds[s]=make_pred(cp,r5,r10,r21,sl)
        except Exception as e:
            preds[s]=make_pred(cp,0,0,0,sl)
    print(f"    Done — {len(preds)} stocks")
    return {"trained":True,"version":"2.0.0","predictions":preds}

# ─── GARCH (volatility forecast → directional signal) ───
def train_garch(df):
    from arch import arch_model
    print("  Training GARCH...")
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<30:continue
        cp=float(sdf.iloc[-1]["close"]);sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        try:
            returns=sdf["close"].pct_change().tail(60).dropna().values*100
            model=arch_model(returns,mean="Zero",vol="GARCH",p=1,q=1)
            fitted=model.fit(disp="off")
            fc=fitted.forecast(horizon=21,reindex=False)
            # GARCH forecasts variance — increasing variance = bearish (uncertainty)
            # decreasing variance = bullish (stability)
            var_forecast=fc.variance.values[-1]
            current_var=np.var(returns[-14:])
            # If forecasted variance > current → bearish, else bullish
            var_ratio=np.mean(var_forecast)/current_var if current_var>0 else 1
            r5=-0.02 if var_ratio>1.1 else 0.02
            r10=-0.03 if var_ratio>1.1 else 0.03
            r21=-0.04 if var_ratio>1.1 else 0.04
            preds[s]=make_pred(cp,r5,r10,r21,sl)
        except Exception as e:
            preds[s]=make_pred(cp,0,0,0,sl)
    print(f"    Done — {len(preds)} stocks")
    return {"trained":True,"version":"2.0.0","predictions":preds}

# ─── Ridge Regression on indicators ───
def train_ridge(df):
    from sklearn.linear_model import Ridge
    print("  Training Ridge Regression...")
    targets=["target_5d","target_10d","target_21d"]
    # ML integrity (Task 2): chronological_split replaces the leaky global row
    # split on the concatenated df (which mixed train/test across stocks in
    # stock-concat order, not date order). Per-horizon dropna inside the loop
    # (Phase A1) preserves shorter-horizon rows.
    tr,va,te=chronological_split(df)
    metrics={};preds={}
    for tc in targets:
        hz=int(tc.split("_")[1].replace("d",""))
        # ML integrity (Phase A1): per-horizon drop.
        tr_h=tr.dropna(subset=[tc]);te_h=te.dropna(subset=[tc])
        Xtr=tr_h[FC].values;Xte=te_h[FC].values
        ytr=tr_h[tc].values;yte=te_h[tc].values
        model=Ridge(alpha=1.0,random_state=42)
        model.fit(Xtr,ytr)
        yp=model.predict(Xte)
        metrics[f"{hz}d"]={"mse":float(mean_squared_error(yte,yp)),"r2":float(model.score(Xte,yte))}
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
    print(f"    Done — R²(5d)={metrics.get('5d',{}).get('r2',0):.3f}")
    return {"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}

# ─── Kalman Filter ───
def train_kalman(df):
    from pykalman import KalmanFilter
    print("  Training Kalman Filter...")
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<30:continue
        cp=float(sdf.iloc[-1]["close"]);sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        try:
            prices=sdf["close"].tail(60).values
            kf=KalmanFilter(initial_state_mean=prices[0],n_dim_obs=1)
            state_means,_=kf.filter(prices)
            # Use last filtered state + trend to forecast
            trend=state_means[-1]-state_means[-5] if len(state_means)>5 else 0
            r5=trend/cp*5;r10=trend/cp*10;r21=trend/cp*21
            preds[s]=make_pred(cp,r5,r10,r21,sl)
        except:
            preds[s]=make_pred(cp,0,0,0,sl)
    print(f"    Done — {len(preds)} stocks")
    return {"trained":True,"version":"2.0.0","predictions":preds}

# ─── Prophet ───
def train_prophet(df):
    from prophet import Prophet
    print("  Training Prophet...")
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<30:continue
        cp=float(sdf.iloc[-1]["close"]);sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        try:
            prophet_df=pd.DataFrame({"ds":pd.to_datetime(sdf["date"].tail(60),unit="ms"),"y":sdf["close"].tail(60).values})
            m=Prophet(daily_seasonality=False,weekly_seasonality=True,yearly_seasonality=False)
            m.fit(prophet_df)
            future=m.make_future_dataframe(periods=21,freq="D")
            fc=m.predict(future)
            yhat=fc["yhat"].tail(21).values
            r5=(float(yhat[4])-cp)/cp;r10=(float(yhat[9])-cp)/cp;r21=(float(yhat[20])-cp)/cp
            preds[s]=make_pred(cp,r5,r10,r21,sl)
        except Exception as e:
            preds[s]=make_pred(cp,0,0,0,sl)
    print(f"    Done — {len(preds)} stocks")
    return {"trained":True,"version":"2.0.0","predictions":preds}

# ─── GRU (PyTorch) ───
def train_gru(df):
    import torch,torch.nn as nn
    from torch.utils.data import DataLoader,TensorDataset
    print("  Training GRU...")
    # ML integrity (Task 2 + Task C): global chronological boundaries so every
    # per-stock scaler is fit on the SAME TRAIN partition (replaces the old
    # full-history fit_transform that leaked future distribution into train).
    _tr,_va,_te=chronological_split(df)
    train_end_date=_tr["date"].max();val_end_date=_va["date"].max()
    SEQ=30;seqs=[];targs=[];seq_dates=[]
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<SEQ+21:continue
        f=sdf[FC].values
        # ML integrity (Task 3): fit scaler on the per-stock TRAIN partition
        # only (rows with date <= train_end_date) — consistent with chronological_split.
        ti=per_stock_train_idx(sdf,train_end_date)
        if ti<SEQ+5:continue
        sc=fit_scaler_on_train(f[:ti]);fs=sc.transform(f)
        for i in range(len(sdf)-SEQ-21):
            di=i+SEQ  # decision bar (after the sequence window — no in-seq future)
            row=sdf.iloc[di]
            tgts=[row["target_5d"],row["target_10d"],row["target_21d"]]
            # ML integrity: skip immature-target rows (no fillna(0) poisoning).
            if any(pd.isna(t) or not np.isfinite(t) for t in tgts):continue
            seqs.append(fs[i:i+SEQ]);targs.append(tgts);seq_dates.append(row["date"])
    if len(seqs)<50:return{"trained":False,"error":"Not enough sequences"}
    X=np.array(seqs,dtype=np.float32);y=np.array(targs,dtype=np.float32)
    # ML integrity (Task 2): date-disjoint train/val/test split by DECISION
    # DATE (replaces the old sp=int(len(X)*0.8) row-index split on the
    # concatenated sequence array).
    Xtr,ytr,Xva,yva,Xte,yte=split_sequences_by_date(
        X,y,seq_dates,train_end_date,val_end_date
    )
    dl=DataLoader(TensorDataset(torch.from_numpy(Xtr),torch.from_numpy(ytr)),batch_size=32,shuffle=True)
    class GRUModel(nn.Module):
        def __init__(self):
            super().__init__()
            self.gru=nn.GRU(len(FC),64,2,batch_first=True,dropout=0.1)
            self.fc=nn.Linear(64,3)
        def forward(self,x):
            o,_=self.gru(x);return self.fc(o[:,-1,:])
    model=GRUModel();crit=nn.MSELoss();opt=torch.optim.Adam(model.parameters(),lr=0.001)
    model.train()
    for ep in range(30):
        for bx,by in dl:opt.zero_grad();loss=crit(model(bx),by);loss.backward();opt.step()
        if ep%10==0:print(f"    Epoch {ep}: loss={loss.item():.6f}")
    model.eval()
    with torch.no_grad():ypt=model(torch.from_numpy(Xte)).numpy()
    metrics={"5d":{"mse":float(mean_squared_error(yte[:,0],ypt[:,0]))}}
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<SEQ:continue
        f=sdf[FC].values;sc=StandardScaler();fs=sc.fit_transform(f)
        sq=fs[-SEQ:].reshape(1,SEQ,len(FC))
        cp=float(sdf.iloc[-1]["close"]);sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        with torch.no_grad():p=model(torch.from_numpy(sq.astype(np.float32)))[0].numpy()
        preds[s]=make_pred(cp,float(p[0]),float(p[1]),float(p[2]),sl)
    print(f"    Done.")
    return {"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}

# ─── Main ───
def main():
    print("="*60);print("Latent.pk — CL Tier Training");print("="*60)
    df=load();print(f"\nLoaded: {len(df)} rows from {df['symbol'].nunique()} stocks")

    # Load existing predictions
    existing=json.loads(PRED_FILE.read_text()) if PRED_FILE.exists() else {"models":{},"backtesting":{}}
    all_models=existing.get("models",{})

    # Train 7 new CL tier models
    print("\n[1/7] ARIMA..."); all_models["ARIMA"]=train_arima(df)
    print("\n[2/7] Holt-Winters..."); all_models["Holt-Winters"]=train_holt_winters(df)
    print("\n[3/7] GARCH..."); all_models["GARCH"]=train_garch(df)
    print("\n[4/7] Ridge Regression..."); all_models["Ridge Regression"]=train_ridge(df)
    print("\n[5/7] Kalman Filter..."); all_models["Kalman Filter"]=train_kalman(df)
    print("\n[6/7] Prophet..."); all_models["Prophet"]=train_prophet(df)
    print("\n[7/7] GRU..."); all_models["GRU"]=train_gru(df)

    # Copy 4 already-trained models to CL tier (just reference existing predictions)
    for model_name in ["XGBoost","LightGBM","Random Forest","LSTM"]:
        if model_name in all_models and all_models[model_name].get("trained"):
            # Already has predictions — just add CL tier metadata
            all_models[model_name].setdefault("also_in_tiers",[]).append("TIER_CL")
            print(f"  Copied {model_name} predictions to CL tier")

    # Recompute backtesting for all trained models — DISABLED
    # (Pattern #10 LEAKY_BACKTEST).
    #
    # Original implementation: per-stock chronological test partition (the slice
    # itself was leak-free thanks to chronological_split), but the SIGNAL applied
    # to every historical test row came from `md.get("predictions",{}).get(s,{})`
    # — the model's STORED LATEST per-stock signal, constant per stock across
    # all historical test rows. This is leakage Pattern #10 (latest-signal
    # replay): today's signal applied to historical test dates, which
    # misrepresents the historical out-of-sample performance.
    #
    # For the leak-free chronological walk-forward evaluation, see
    # scripts/walk_forward_backtesting.py (the genuine walk-forward engine that
    # Phase A fixed — per-sample re-training + per-bar re-inference + realized
    # P&L from future OHLCV). Do NOT duplicate a new walk-forward engine here.
    #
    # External interface preserved: same per-model top-level return keys
    # (totalTrades / buySignals / sellSignals / correctBuys / correctSells /
    # winRate / avgReturnPct / maxReturnPct / minReturnPct / stars), with
    # values signaling unavailability, PLUS the new status/reason/pointer/
    # ml_integrity_note fields.
    print("\nRecomputing backtesting — UNAVAILABLE (Pattern #10 leak).")
    print("Use scripts/walk_forward_backtesting.py for leak-free eval.")
    bt={}
    for name,md in all_models.items():
        if not md.get("trained"):continue
        preds = md.get("predictions", {})
        if not preds:continue
        bt[name]={
            "status":"unavailable",
            "reason":(
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
            "pointer":"scripts/walk_forward_backtesting.py",
            "ml_integrity_note":"Phase 1+2 fix: function disabled to prevent misleading metrics.",
            "totalTrades":0,
            "buySignals":0,
            "sellSignals":0,
            "correctBuys":0,
            "correctSells":0,
            "winRate":None,
            "avgReturnPct":None,
            "maxReturnPct":None,
            "minReturnPct":None,
            "stars":0,
        }
        print(f"  {name}: UNAVAILABLE — Pattern #10 leak (latest-signal replay).")

    existing["models"]=all_models
    existing["backtesting"]=bt
    existing["ml_integrity"]={
        "target_construction":"per-stock shift(-h) inside add_features (called per-stock in load's loop; sdf is one stock so shift does NOT cross stock boundaries); no .fillna(0); immature rows left NaN and dropped per-horizon inside train_ridge (dropna) + via in-loop skip in train_gru",
        "split":"date-based chronological_split (60/20/20) with per-stock purge of MAX_HORIZON=21 rows at each boundary; replaces the old global row split on the concatenated df (train_ridge + backtest); GRU sequences split by DECISION DATE via split_sequences_by_date",
        "scaler_fitting":"fit_scaler_on_train on per-stock TRAIN partition (date <= train_end_date) inside train_gru; transform-only on val/test; replaces the old StandardScaler().fit_transform on the FULL per-stock history",
        "backtest_methodology":"Pattern #10 LEAKY_BACKTEST disabled — function now returns status='unavailable' with reason + pointer to scripts/walk_forward_backtesting.py for genuine walk-forward ML evaluation. The inline backtest block in main() no longer applies the model's stored LATEST per-stock signal to every historical test row; per-model backtest entries now carry status='unavailable' + zeroed metrics.",
        "ml_historical_evaluation":"unavailable",
    }
    PRED_FILE.write_text(json.dumps(existing,indent=2,default=lambda o:int(o)if isinstance(o,(np.integer,))else float(o)if isinstance(o,(np.floating,))else str(o)))

    tc=sum(1 for m in all_models.values()if m.get("trained"))
    print(f"\n{'='*60}")
    print(f"CL TIER TRAINING COMPLETE")
    print(f"{'='*60}")
    print(f"Total trained models: {tc}")
    print(f"\nNew CL tier models:")
    for name in["ARIMA","Holt-Winters","GARCH","Ridge Regression","Kalman Filter","Prophet","GRU"]:
        md=all_models.get(name,{})
        if md.get("trained"):
            m=bt.get(name,{})
            print(f"  ✓ {name}: winRate={m.get('winRate','?')}% stars={'★'*m.get('stars',0)}")
        else:
            print(f"  ✗ {name}: {md.get('error','Failed')}")
    print(f"\nCopied to CL tier:")
    for name in["XGBoost","LightGBM","Random Forest","LSTM"]:
        md=all_models.get(name,{})
        if md.get("trained"):
            m=bt.get(name,{})
            print(f"  ✓ {name}: winRate={m.get('winRate','?')}% (copied)")
    print(f"\nSaved: {PRED_FILE}")

if __name__=="__main__":main()
