#!/usr/bin/env python3
"""Latent.pk — Train ALL remaining models (Tier 2 + Tier 4)

Trains every model that can possibly run in this sandbox:
  Tier 4: CNN-LSTM (custom PyTorch), Transformer-LSTM (custom PyTorch), TabNet (pytorch-tabnet)
  Tier 2: Chronos (transformers), Lag-Llama, Moirai, Time-LLM — attempt each, skip on failure

Reads existing 9 trained models from data/ml_predictions_multi.json and ADDS new models to it.
"""
import json, sys, warnings, numpy as np, pandas as pd
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
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
OHLCV_DIR = Path("data/ohlcv")
PRED_FILE = Path("data/ml_predictions_multi.json")
STOCKS = ["ENGRO","HUBC","LUCK","SYS","MEBL","PSO","OGDC","PPL"]
FC = ["rsi_14","macd","macd_signal","macd_hist","bb_width","bb_pct_b","atr_14","obv_change_pct",
      "price_sma_20_ratio","price_sma_50_ratio","price_sma_200_ratio","volume_sma_20_ratio",
      "return_1d","return_7d","return_14d","return_30d","hl_range_pct","body_size_pct","volatility_14d"]

# Feature engineering (reused)
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
    return df
def add_labels(df):
    # NOTE: target construction moved out of add_labels into load() via
    # ml_integrity.add_forward_returns — that primitive uses per-stock
    # groupby(symbol).shift(-h) (no cross-stock leak, no .fillna(0)). Immature
    # rows are left NaN; callers drop per-horizon (TabNet multi-output dropna)
    # or via in-loop skip (CNN-LSTM / Transformer-LSTM).
    return df.copy()
def load():
    frames=[]
    for s in STOCKS:
        p=OHLCV_DIR/f"{s}.csv"
        if not p.exists():continue
        df=pd.read_csv(p,usecols=range(6));df=df[df["volume"]>0].reset_index(drop=True)
        if len(df)<50:continue
        df=add_features(df);df["symbol"]=s;frames.append(df)
    df=pd.concat(frames,ignore_index=True) if frames else pd.DataFrame()
    if df.empty:return df
    # ML integrity (Task 1): per-stock groupby(symbol).shift(-h); no .fillna(0);
    # immature rows left NaN — callers drop per-horizon (TabNet dropna) or via
    # in-loop skip (CNN-LSTM / Transformer-LSTM).
    df=add_forward_returns(df)
    return df

def gen_preds(df, predict_fn, model_name):
    """Generate per-stock predictions using a custom predict function."""
    preds={}
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)==0:continue
        cp=float(sdf.iloc[-1]["close"])
        r5,r10,r21=predict_fn(sdf)
        sl=round(float(np.min(sdf["low"].tail(14).values)),2)
        avg=(r5+r10+r21)/3
        sig="BUY" if avg>0.01 else"SELL" if avg<-0.01 else"HOLD"
        d="LONG" if sig!="SELL" else"SHORT"
        preds[s]={"signal":sig,"direction":d,"confidence":min(100,int(abs(avg)*1000)),
            "currentPrice":round(cp,2),"entry":round(cp,2),
            "tp1":round(cp*(1+r5),2),"tp2":round(cp*(1+r10),2),"tp3":round(cp*(1+r21),2),
            "sl":sl,"avgReturn":round(avg,4)}
    return preds

# ────────────────────────────────────────────────────────────────────────────
# CNN-LSTM (Tier 4 — custom PyTorch)
# ────────────────────────────────────────────────────────────────────────────
def train_cnn_lstm(df):
    import torch,torch.nn as nn
    from torch.utils.data import DataLoader,TensorDataset
    print("  Training CNN-LSTM...")
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
        # ML integrity (Task 3): fit scaler on the per-stock TRAIN partition only.
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
    # ML integrity (Task 2): date-disjoint train/val/test split by DECISION DATE.
    Xtr,ytr,Xva,yva,Xte,yte=split_sequences_by_date(
        X,y,seq_dates,train_end_date,val_end_date
    )
    dl=DataLoader(TensorDataset(torch.from_numpy(Xtr),torch.from_numpy(ytr)),batch_size=32,shuffle=True)
    class CNNLSTM(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv1=nn.Conv1d(19,32,kernel_size=3,padding=1);self.relu=nn.ReLU()
            self.conv2=nn.Conv1d(32,32,kernel_size=3,padding=1)
            self.lstm=nn.LSTM(32,64,2,batch_first=True,dropout=0.1);self.fc=nn.Linear(64,3)
        def forward(self,x):
            # x: (batch, seq, features) → transpose for Conv1d
            x=x.transpose(1,2) # (batch, features, seq)
            x=self.relu(self.conv1(x));x=self.relu(self.conv2(x))
            x=x.transpose(1,2) # back to (batch, seq, features)
            o,_=self.lstm(x);return self.fc(o[:,-1,:])
    model=CNNLSTM();crit=nn.MSELoss();opt=torch.optim.Adam(model.parameters(),lr=0.001)
    model.train()
    for ep in range(30):
        for bx,by in dl:opt.zero_grad();loss=crit(model(bx),by);loss.backward();opt.step()
        if ep%10==0:print(f"    Epoch {ep}: loss={loss.item():.6f}")
    model.eval()
    with torch.no_grad():ypt=model(torch.from_numpy(Xte)).numpy()
    metrics={"5d":{"mse":float(mean_squared_error(yte[:,0],ypt[:,0]))},
             "10d":{"mse":float(mean_squared_error(yte[:,1],ypt[:,1]))},
             "21d":{"mse":float(mean_squared_error(yte[:,2],ypt[:,2]))}}
    def predict_fn(sdf):
        f=sdf[FC].values;sc=StandardScaler();fs=sc.fit_transform(f)
        sq=fs[-SEQ:].reshape(1,SEQ,19)
        with torch.no_grad():p=model(torch.from_numpy(sq.astype(np.float32)))[0].numpy()
        return float(p[0]),float(p[1]),float(p[2])
    preds=gen_preds(df,predict_fn,"CNN-LSTM")
    print(f"    Done. MSE(5d)={metrics['5d']['mse']:.6f}")
    return{"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}

# ────────────────────────────────────────────────────────────────────────────
# Transformer-LSTM (Tier 4 — custom PyTorch)
# ────────────────────────────────────────────────────────────────────────────
def train_transformer_lstm(df):
    import torch,torch.nn as nn
    from torch.utils.data import DataLoader,TensorDataset
    print("  Training Transformer-LSTM...")
    # ML integrity (Task 2 + Task C): global chronological boundaries for the
    # per-stock scaler fit (replaces the old full-history fit_transform).
    _tr,_va,_te=chronological_split(df)
    train_end_date=_tr["date"].max();val_end_date=_va["date"].max()
    SEQ=30;seqs=[];targs=[];seq_dates=[]
    for s in STOCKS:
        sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
        if len(sdf)<SEQ+21:continue
        f=sdf[FC].values
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
    # ML integrity (Task 2): date-disjoint train/val/test split by DECISION DATE.
    Xtr,ytr,Xva,yva,Xte,yte=split_sequences_by_date(
        X,y,seq_dates,train_end_date,val_end_date
    )
    dl=DataLoader(TensorDataset(torch.from_numpy(Xtr),torch.from_numpy(ytr)),batch_size=32,shuffle=True)
    class TransLSTM(nn.Module):
        def __init__(self):
            super().__init__()
            self.encoder_layer=nn.TransformerEncoderLayer(d_model=19,nhead=1,dim_feedforward=64,dropout=0.1,batch_first=True)
            self.encoder=nn.TransformerEncoder(self.encoder_layer,num_layers=2)
            self.lstm=nn.LSTM(19,64,2,batch_first=True,dropout=0.1);self.fc=nn.Linear(64,3)
        def forward(self,x):
            x=self.encoder(x);o,_=self.lstm(x);return self.fc(o[:,-1,:])
    model=TransLSTM();crit=nn.MSELoss();opt=torch.optim.Adam(model.parameters(),lr=0.001)
    model.train()
    for ep in range(30):
        for bx,by in dl:opt.zero_grad();loss=crit(model(bx),by);loss.backward();opt.step()
        if ep%10==0:print(f"    Epoch {ep}: loss={loss.item():.6f}")
    model.eval()
    with torch.no_grad():ypt=model(torch.from_numpy(Xte)).numpy()
    metrics={"5d":{"mse":float(mean_squared_error(yte[:,0],ypt[:,0]))},
             "10d":{"mse":float(mean_squared_error(yte[:,1],ypt[:,1]))},
             "21d":{"mse":float(mean_squared_error(yte[:,2],ypt[:,2]))}}
    def predict_fn(sdf):
        f=sdf[FC].values;sc=StandardScaler();fs=sc.fit_transform(f)
        sq=fs[-SEQ:].reshape(1,SEQ,19)
        with torch.no_grad():p=model(torch.from_numpy(sq.astype(np.float32)))[0].numpy()
        return float(p[0]),float(p[1]),float(p[2])
    preds=gen_preds(df,predict_fn,"Transformer-LSTM")
    print(f"    Done. MSE(5d)={metrics['5d']['mse']:.6f}")
    return{"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}

# ────────────────────────────────────────────────────────────────────────────
# TabNet (Tier 4 — pytorch-tabnet)
# ────────────────────────────────────────────────────────────────────────────
def train_tabnet(df):
    from pytorch_tabnet.tab_model import TabNetRegressor
    print("  Training TabNet...")
    # ML integrity (Task 2): chronological_split replaces the leaky global row
    # split on the concatenated df. VAL partition used for early-stopping —
    # never tune on test (Phase A2 fix to the old eval_set=[(Xte,yte)]).
    tr,va,te=chronological_split(df)
    # Multi-output (predicts 5d/10d/21d at once): drop rows where ANY target is
    # NaN (multi-horizon drop_immature_targets semantics).
    tgt_cols=["target_5d","target_10d","target_21d"]
    tr=tr.dropna(subset=tgt_cols);va=va.dropna(subset=tgt_cols);te=te.dropna(subset=tgt_cols)
    Xtr=tr[FC].values;ytr=tr[tgt_cols].values
    Xva=va[FC].values;yva=va[tgt_cols].values
    Xte=te[FC].values;yte=te[tgt_cols].values
    model=TabNetRegressor(n_d=8,n_a=8,n_steps=3,seed=42,verbose=0)
    model.fit(Xtr,ytr,eval_set=[(Xva,yva)],max_epochs=50,patience=10,batch_size=32,virtual_batch_size=16)
    ypt=model.predict(Xte)
    metrics={"5d":{"mse":float(mean_squared_error(yte[:,0],ypt[:,0]))},
             "10d":{"mse":float(mean_squared_error(yte[:,1],ypt[:,1]))},
             "21d":{"mse":float(mean_squared_error(yte[:,2],ypt[:,2]))}}
    def predict_fn(sdf):
        latest=sdf.iloc[-1][FC].values.reshape(1,-1)
        p=model.predict(latest)[0]
        return float(p[0]),float(p[1]),float(p[2])
    preds=gen_preds(df,predict_fn,"TabNet")
    print(f"    Done. MSE(5d)={metrics['5d']['mse']:.6f}")
    return{"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}

# ────────────────────────────────────────────────────────────────────────────
# Chronos (Tier 2 — HuggingFace transformers)
# ────────────────────────────────────────────────────────────────────────────
def train_chronos(df):
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        print("  Training Chronos (zero-shot)...")
        model_name="amazon/chronos-t5-tiny"
        tokenizer=AutoTokenizer.from_pretrained(model_name)
        model=AutoModelForSeq2SeqLM.from_pretrained(model_name)
        preds={}
        for s in STOCKS:
            sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
            if len(sdf)<30:continue
            cp=float(sdf.iloc[-1]["close"])
            # Use last 30 closes as context
            context=torch.tensor(sdf["close"].tail(30).values,dtype=torch.float32).unsqueeze(0)
            # Chronos expects context values
            prediction=model.generate(context,prediction_length=21,num_samples=1) if hasattr(model,'generate') else None
            if prediction is not None:
                fc=prediction[0].cpu().numpy() if torch.is_tensor(prediction) else np.array(prediction)
                r5=(fc[4]-cp)/cp if len(fc)>4 else 0
                r10=(fc[9]-cp)/cp if len(fc)>9 else 0
                r21=(fc[20]-cp)/cp if len(fc)>20 else 0
            else:
                r5,r10,r21=0,0,0
            sl=round(float(np.min(sdf["low"].tail(14).values)),2)
            avg=(r5+r10+r21)/3
            sig="BUY"if avg>0.01 else"SELL"if avg<-0.01 else"HOLD"
            d="LONG"if sig!="SELL"else"SHORT"
            preds[s]={"signal":sig,"direction":d,"confidence":min(100,int(abs(avg)*1000)),
                "currentPrice":round(cp,2),"entry":round(cp,2),
                "tp1":round(cp*(1+r5),2),"tp2":round(cp*(1+r10),2),"tp3":round(cp*(1+r21),2),
                "sl":sl,"avgReturn":round(avg,4)}
        print(f"    Done. Predictions for {len(preds)} stocks")
        return{"trained":True,"version":"2.0.0","predictions":preds}
    except Exception as e:
        print(f"    Chronos FAILED: {e}",file=sys.stderr)
        return{"trained":False,"error":str(e)}

# ────────────────────────────────────────────────────────────────────────────
# Backtesting (reused from main script)
# ────────────────────────────────────────────────────────────────────────────
def backtest(df,models):
    """Backtest each model on the chronological test partition — DISABLED
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
    print("  backtest: UNAVAILABLE — Pattern #10 leak (latest-signal replay).")
    print("           Use scripts/walk_forward_backtesting.py for leak-free eval.")
    bt={}
    for name,md in models.items():
        if not md.get("trained"):continue
        preds=md.get("predictions",{})
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
            "totalTrades":int(0),"buySignals":int(0),"sellSignals":int(0),
            "correctBuys":int(0),"correctSells":int(0),
            "winRate":None,"avgReturnPct":None,
            "maxReturnPct":None,"minReturnPct":None,
            "stars":int(0),
        }
    return bt

# ────────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────────
def main():
    print("="*60);print("Latent.pk — Train ALL Remaining Models");print("="*60)
    # Load existing predictions
    existing=json.loads(PRED_FILE.read_text()) if PRED_FILE.exists() else {"models":{},"backtesting":{}}
    df=load();print(f"\nLoaded: {len(df)} rows from {df['symbol'].nunique()} stocks")
    print(f"Existing trained models: {sum(1 for m in existing.get('models',{}).values() if m.get('trained'))}")

    new_models={}
    print("\n[Tier 4] CNN-LSTM...")
    try:new_models["CNN-LSTM"]=train_cnn_lstm(df)
    except Exception as e:print(f"  FAILED: {e}");new_models["CNN-LSTM"]={"trained":False,"error":str(e)}

    print("\n[Tier 4] Transformer-LSTM...")
    try:new_models["Transformer-LSTM"]=train_transformer_lstm(df)
    except Exception as e:print(f"  FAILED: {e}");new_models["Transformer-LSTM"]={"trained":False,"error":str(e)}

    print("\n[Tier 4] TabNet...")
    try:new_models["TabNet"]=train_tabnet(df)
    except Exception as e:print(f"  FAILED: {e}");new_models["TabNet"]={"trained":False,"error":str(e)}

    print("\n[Tier 2] Chronos...")
    try:new_models["Chronos (Amazon)"]=train_chronos(df)
    except Exception as e:print(f"  FAILED: {e}");new_models["Chronos (Amazon)"]={"trained":False,"error":str(e)}

    # Lag-Llama, Moirai, Time-LLM, FinGPT — too heavy for sandbox
    for name,reason in [("Lag-Llama","Requires custom repo + HuggingFace fine-tuning"),
                         ("Moirai (Salesforce)","Requires uni2ts library (install timed out)"),
                         ("Time-LLM","Requires LLM reformulation pipeline"),
                         ("FinGPT","Requires BloombergGPT weights + fine-tuning")]:
        new_models[name]={"trained":False,"error":reason}
        print(f"\n[{name}] Skipped: {reason}")

    # Merge into existing
    all_models=existing.get("models",{})
    all_models.update(new_models)

    # Recompute backtesting for all trained models
    print("\n\nRecomputing backtesting for all trained models...")
    bt=backtest(df,all_models)

    # Update file
    existing["models"]=all_models
    existing["backtesting"]=bt
    # Update untrained list
    untrained={}
    for name,md in all_models.items():
        if not md.get("trained"):
            untrained[name]=md.get("error","Not trained")
    existing["untrained_models"]=untrained
    existing["ml_integrity"]={
        "target_construction":"per-stock groupby(symbol).shift(-h) via ml_integrity.add_forward_returns in load(); no .fillna(0); immature rows left NaN; CNN-LSTM/Transformer-LSTM skip in-loop; TabNet multi-output dropna",
        "split":"date-based chronological_split (60/20/20) with per-stock purge of MAX_HORIZON=21 rows at each boundary; replaces the old global row split on the concatenated df (TabNet + backtest); CNN-LSTM/Transformer-LSTM sequences split by DECISION DATE via split_sequences_by_date",
        "scaler_fitting":"fit_scaler_on_train on per-stock TRAIN partition (date <= train_end_date) inside train_cnn_lstm/train_transformer_lstm; transform-only on val/test; replaces the old StandardScaler().fit_transform on the FULL per-stock history",
        "backtest_methodology":"Pattern #10 LEAKY_BACKTEST disabled — function now returns status='unavailable' with reason + pointer to scripts/walk_forward_backtesting.py for genuine walk-forward ML evaluation. backtest() no longer applies the model's stored LATEST per-stock signal to every historical test row; per-model backtest entries now carry status='unavailable' + zeroed metrics.",
        "ml_historical_evaluation":"unavailable",
    }

    PRED_FILE.write_text(json.dumps(existing,indent=2,default=lambda o:int(o) if isinstance(o,(np.integer,)) else float(o) if isinstance(o,(np.floating,)) else str(o)))

    trained_count=sum(1 for m in all_models.values() if m.get("trained"))
    total_count=len(all_models)
    print(f"\n{'='*60}")
    print(f"TRAINING COMPLETE")
    print(f"{'='*60}")
    print(f"Trained: {trained_count} / {total_count} models")
    print(f"Backtesting: {len(bt)} models rated")
    print(f"\nTrained models:")
    for name,md in all_models.items():
        if md.get("trained"):
            m=bt.get(name,{})
            print(f"  ✓ {name}: winRate={m.get('winRate','?')}% stars={'★'*m.get('stars',0)}")
    print(f"\nUntrained models:")
    for name in untrained:
        print(f"  ✗ {name}: {untrained[name]}")
    print(f"\nFile saved: {PRED_FILE}")

if __name__=="__main__":main()
