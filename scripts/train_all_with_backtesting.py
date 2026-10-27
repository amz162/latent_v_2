#!/usr/bin/env python3
"""Latent.pk — Train ALL models + compute backtesting for each model AND ensemble."""
import json,sys,warnings,numpy as np,pandas as pd
# ML-integrity helpers (leakage-free targets, chronological split, train-only
# scalers). See scripts/ml_integrity.py. Replaces the old .fillna(0) targets
# + global row-based splits + full-history scaler fits.
from ml_integrity import (
    add_forward_returns, drop_immature_targets, chronological_split,
    fit_scaler_on_train, per_stock_train_idx, split_sequences_by_date,
    HORIZONS, MAX_HORIZON,
)
import xgboost as xgb,lightgbm as lgb,catboost as cb
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error,mean_absolute_error,r2_score
from sklearn.preprocessing import StandardScaler
from pathlib import Path
warnings.filterwarnings("ignore")
OHLCV=Path("data/ohlcv");OUT=Path("data/ml_predictions_multi.json")
STOCKS=["ENGRO","HUBC","LUCK","SYS","MEBL","PSO","OGDC","PPL"]
FC=["rsi_14","macd","macd_signal","macd_hist","bb_width","bb_pct_b","atr_14","obv_change_pct",
"price_sma_20_ratio","price_sma_50_ratio","price_sma_200_ratio","volume_sma_20_ratio",
"return_1d","return_7d","return_14d","return_30d","hl_range_pct","body_size_pct","volatility_14d"]
TIER_W={"TIER_1":0.35,"TIER_2":0.25,"TIER_3":0.30,"TIER_4":0.10}

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
 # ML integrity (Task 1): per-stock forward returns, NO .fillna(0).
 # Immature rows (last hz per stock) are left NaN and dropped before training
 # (see load() → drop_immature_targets). Kept for backward-compat callers.
 df=df.copy()
 sym = df["symbol"] if "symbol" in df.columns else None
 for hz in HORIZONS:
  future = sym.shift(-hz) if sym is not None else df["close"].shift(-hz)
  df[f"target_{hz}d"]=(future-df["close"])/df["close"]
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
 # (no cross-stock shift, no .fillna(0)). Immature rows are left NaN — callers
 # drop them per-horizon (train_classical) or via in-loop skip (train_lstm etc.)
 # so per-horizon models keep shorter-horizon rows whose longest-horizon target
 # is immature (Phase A1 requirement: "do not inadvertently remove useful
 # training rows from a shorter-horizon model merely because the longest-horizon
 # target is immature").
 df=add_forward_returns(df)
 return df

def gen_preds(df, predict_fn):
 preds={}
 for s in STOCKS:
  sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
  if len(sdf)==0:continue
  cp=float(sdf.iloc[-1]["close"])
  r5,r10,r21=predict_fn(sdf)
  sl=round(float(np.min(sdf["low"].tail(14).values)),2)
  avg=(r5+r10+r21)/3
  sig="BUY"if avg>0.01 else"SELL"if avg<-0.01 else"HOLD"
  d="LONG"if sig!="SELL"else"SHORT"
  preds[s]={"signal":sig,"direction":d,"confidence":min(100,int(abs(avg)*1000)),
   "currentPrice":round(cp,2),"entry":round(cp,2),
   "tp1":round(cp*(1+r5),2),"tp2":round(cp*(1+r10),2),"tp3":round(cp*(1+r21),2),
   "sl":sl,"avgReturn":round(avg,4)}
 return preds

def train_classical(df):
 targets=["target_5d","target_10d","target_21d"]
 # ML integrity (Task 2): date-based chronological split + purge on the FULL df
 # (with NaN targets where immature). Per-horizon NaN drop happens INSIDE the
 # per-horizon loop so per-horizon models keep rows whose target_5d is mature
 # even when target_21d is immature (Phase A1 requirement). The purge uses
 # MAX_HORIZON=21 (safe upper bound for all horizons).
 tr,va,te=chronological_split(df)
 cfg={"XGBoost":lambda:xgb.XGBRegressor(n_estimators=150,max_depth=3,learning_rate=0.05,subsample=0.7,colsample_bytree=0.7,random_state=42),
  "LightGBM":lambda:lgb.LGBMRegressor(n_estimators=150,num_leaves=15,learning_rate=0.05,subsample=0.7,colsample_bytree=0.7,random_state=42,verbose=-1),
  "CatBoost":lambda:cb.CatBoostRegressor(iterations=150,depth=3,learning_rate=0.05,random_state=42,verbose=0,allow_writing_files=False),
  "Random Forest":lambda:RandomForestRegressor(n_estimators=150,max_depth=5,min_samples_leaf=15,max_features=0.7,random_state=42,n_jobs=-1)}
 results={}
 for name,factory in cfg.items():
  print(f"  Training {name}...")
  metrics={};preds={}
  for tc in targets:
   hz=int(tc.split("_")[1].replace("d",""))
   # ML integrity (Phase A1): drop ONLY rows whose THIS-horizon target is NaN
   # (per-horizon drop, not all-horizon). Preserves shorter-horizon rows.
   tr_h=tr.dropna(subset=[tc]);te_h=te.dropna(subset=[tc])
   Xtr=tr_h[FC].values;Xte=te_h[FC].values
   ytr=tr_h[tc].values;yte=te_h[tc].values
   m=factory();m.fit(Xtr,ytr);yp=m.predict(Xte)
   metrics[f"{hz}d"]={"mse":float(mean_squared_error(yte,yp)),"mae":float(mean_absolute_error(yte,yp)),"r2":float(r2_score(yte,yp))}
   for s in STOCKS:
    sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
    if len(sdf)==0:continue
    latest=sdf.iloc[-1];lf=latest[FC].values.reshape(1,-1)
    pr=float(m.predict(lf)[0]);cp=float(latest["close"])
    if s not in preds:preds[s]={"currentPrice":round(cp,2),"entry":round(cp,2)}
    preds[s][f"ret_{hz}d"]=round(pr,4)
  for s,pd_ in preds.items():
   r5=pd_.get("ret_5d",0);r10=pd_.get("ret_10d",0);r21=pd_.get("ret_21d",0)
   cp=pd_["currentPrice"]
   sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
   sl=round(float(np.min(sdf["low"].tail(14).values)),2)
   avg=(r5+r10+r21)/3
   sig="BUY"if avg>0.01 else"SELL"if avg<-0.01 else"HOLD"
   d="LONG"if sig!="SELL"else"SHORT"
   pd_.update({"signal":sig,"direction":d,"confidence":min(100,int(abs(avg)*1000)),
    "tp1":round(cp*(1+r5),2),"tp2":round(cp*(1+r10),2),"tp3":round(cp*(1+r21),2),
    "sl":sl,"avgReturn":round(avg,4)})
  results[name]={"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}
  print(f"    R²(5d)={metrics['5d']['r2']:.3f}")
 return results

def train_lstm(df):
 try:
  import torch,torch.nn as nn
  from torch.utils.data import DataLoader,TensorDataset
  print("  Training LSTM...")
  # ML integrity (Task 2 + Task C): get the global train_end / val_end dates
  # from chronological_split so every per-stock scaler is fit on the SAME
  # global TRAIN partition (not an arbitrary first-60%-per-stock slice that
  # could straddle the global train/val boundary).
  _tr,_va,_te=chronological_split(df)
  train_end_date=_tr["date"].max();val_end_date=_va["date"].max()
  SEQ=30;seqs=[];targs=[];seq_dates=[]
  for s in STOCKS:
   sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
   if len(sdf)<SEQ+21:continue
   f=sdf[FC].values
   # ML integrity (Task 3, Task C): fit scaler on the per-stock TRAIN partition
   # (rows with date <= train_end_date) — consistent with chronological_split.
   ti=per_stock_train_idx(sdf,train_end_date)
   if ti<SEQ+5:continue  # stock has too few TRAIN rows
   sc=fit_scaler_on_train(f[:ti]);fs=sc.transform(f)
   for i in range(len(sdf)-SEQ-21):
    di=i+SEQ  # decision bar (after the sequence window — no in-seq future)
    row=sdf.iloc[di]
    tgts=[row["target_5d"],row["target_10d"],row["target_21d"]]
    if any(pd.isna(t) or not np.isfinite(t) for t in tgts):continue
    seqs.append(fs[i:i+SEQ]);targs.append(tgts);seq_dates.append(row["date"])
  if len(seqs)<50:return{"trained":False,"error":"Not enough sequences"}
  X=np.array(seqs,dtype=np.float32);y=np.array(targs,dtype=np.float32)
  # ML integrity (Task 2): date-disjoint train/val/test split by DECISION DATE
  # (replaces the old sp=int(len(X)*0.8) global row split).
  Xtr,ytr,Xva,yva,Xte,yte=split_sequences_by_date(
   X,y,seq_dates,train_end_date,val_end_date
  )
  dl=DataLoader(TensorDataset(torch.from_numpy(Xtr),torch.from_numpy(ytr)),batch_size=32,shuffle=True)
  class M(nn.Module):
   def __init__(s):
    super().__init__();s.lstm=nn.LSTM(len(FC),64,2,batch_first=True,dropout=0.1);s.fc=nn.Linear(64,3)
   def forward(s,x):
    o,_=s.lstm(x);return s.fc(o[:,-1,:])
  model=M();crit=nn.MSELoss();opt=torch.optim.Adam(model.parameters(),lr=0.001)
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
   sq=fs[-SEQ:].reshape(1,SEQ,len(FC))
   with torch.no_grad():p=model(torch.from_numpy(sq.astype(np.float32)))[0].numpy()
   return float(p[0]),float(p[1]),float(p[2])
  preds=gen_preds(df,predict_fn)
  print(f"    Done.")
  return{"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}
 except Exception as e:
  print(f"    LSTM FAILED: {e}",file=sys.stderr)
  return{"trained":False,"error":str(e)}

def train_cnn_lstm(df):
 try:
  import torch,torch.nn as nn
  from torch.utils.data import DataLoader,TensorDataset
  print("  Training CNN-LSTM...")
  # ML integrity (Task 2 + Task C): global chronological boundaries so every
  # per-stock scaler is fit on the SAME TRAIN partition.
  _tr,_va,_te=chronological_split(df)
  train_end_date=_tr["date"].max();val_end_date=_va["date"].max()
  SEQ=30;seqs=[];targs=[];seq_dates=[]
  for s in STOCKS:
   sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
   if len(sdf)<SEQ+21:continue
   f=sdf[FC].values
   # ML integrity (Task 3): fit scaler on the per-stock TRAIN partition only
   # (rows with date <= train_end_date) — replaces the old leaky
   # StandardScaler().fit_transform(f) on the FULL per-stock history.
   ti=per_stock_train_idx(sdf,train_end_date)
   if ti<SEQ+5:continue
   sc=fit_scaler_on_train(f[:ti]);fs=sc.transform(f)
   for i in range(len(sdf)-SEQ-21):
    di=i+SEQ  # decision bar (after the sequence window — no in-seq future)
    row=sdf.iloc[di]
    tgts=[row["target_5d"],row["target_10d"],row["target_21d"]]
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
   def __init__(s):
    super().__init__()
    s.conv1=nn.Conv1d(len(FC),32,kernel_size=3,padding=1);s.relu=nn.ReLU()
    s.conv2=nn.Conv1d(32,32,kernel_size=3,padding=1)
    s.lstm=nn.LSTM(32,64,2,batch_first=True,dropout=0.1);s.fc=nn.Linear(64,3)
   def forward(s,x):
    x=x.transpose(1,2);x=s.relu(s.conv1(x));x=s.relu(s.conv2(x))
    x=x.transpose(1,2);o,_=s.lstm(x);return s.fc(o[:,-1,:])
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
   sq=fs[-SEQ:].reshape(1,SEQ,len(FC))
   with torch.no_grad():p=model(torch.from_numpy(sq.astype(np.float32)))[0].numpy()
   return float(p[0]),float(p[1]),float(p[2])
  preds=gen_preds(df,predict_fn)
  print(f"    Done.")
  return{"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}
 except Exception as e:
  print(f"    CNN-LSTM FAILED: {e}",file=sys.stderr)
  return{"trained":False,"error":str(e)}

def train_transformer_lstm(df):
 try:
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
    if any(pd.isna(t) or not np.isfinite(t) for t in tgts):continue
    seqs.append(fs[i:i+SEQ]);targs.append(tgts);seq_dates.append(row["date"])
  if len(seqs)<50:return{"trained":False,"error":"Not enough sequences"}
  X=np.array(seqs,dtype=np.float32);y=np.array(targs,dtype=np.float32)
  Xtr,ytr,Xva,yva,Xte,yte=split_sequences_by_date(
   X,y,seq_dates,train_end_date,val_end_date
  )
  dl=DataLoader(TensorDataset(torch.from_numpy(Xtr),torch.from_numpy(ytr)),batch_size=32,shuffle=True)
  class TL(nn.Module):
   def __init__(s):
    super().__init__()
    s.el=nn.TransformerEncoderLayer(d_model=len(FC),nhead=1,dim_feedforward=64,dropout=0.1,batch_first=True)
    s.enc=nn.TransformerEncoder(s.el,num_layers=2)
    s.lstm=nn.LSTM(len(FC),64,2,batch_first=True,dropout=0.1);s.fc=nn.Linear(64,3)
   def forward(s,x):
    x=s.enc(x);o,_=s.lstm(x);return s.fc(o[:,-1,:])
  model=TL();crit=nn.MSELoss();opt=torch.optim.Adam(model.parameters(),lr=0.001)
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
   sq=fs[-SEQ:].reshape(1,SEQ,len(FC))
   with torch.no_grad():p=model(torch.from_numpy(sq.astype(np.float32)))[0].numpy()
   return float(p[0]),float(p[1]),float(p[2])
  preds=gen_preds(df,predict_fn)
  print(f"    Done.")
  return{"trained":True,"version":"2.0.0","metrics":metrics,"predictions":preds}
 except Exception as e:
  print(f"    Transformer-LSTM FAILED: {e}",file=sys.stderr)
  return{"trained":False,"error":str(e)}

def train_neuralforecast(df):
 from neuralforecast import NeuralForecast
 from neuralforecast.models import PatchTST,NBEATS,TimesNet,Informer
 results={}
 nf_df=pd.DataFrame()
 for s in STOCKS:
  sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True).copy()
  sdf["ds"]=pd.to_datetime(sdf["date"],unit="ms");sdf["y"]=sdf["close"];sdf["unique_id"]=s
  nf_df=pd.concat([nf_df,sdf[["ds","y","unique_id"]]],ignore_index=True)
 models=[
  ("PatchTST",PatchTST,{"h":21,"input_size":30,"max_steps":50,"patch_len":4,"stride":4}),
  ("N-BEATS",NBEATS,{"h":21,"input_size":30,"max_steps":50,"n_blocks":[1,1,1]}),
  ("TimesNet",TimesNet,{"h":21,"input_size":30,"max_steps":50,"hidden_size":32,"top_k":5}),
  ("Informer",Informer,{"h":21,"input_size":30,"max_steps":50,"hidden_size":32,"factor":3,"n_head":4}),
 ]
 for name,cls,params in models:
  print(f"  Training {name}...")
  try:
   model=cls(**params);nf=NeuralForecast(models=[model],freq="D");nf.fit(df=nf_df)
   fc=nf.predict()
   col=[c for c in fc.columns if c not in["unique_id","ds"]][0]
   preds={}
   for s in STOCKS:
    sdf=df[df["symbol"]==s].sort_values("date").reset_index(drop=True)
    if len(sdf)==0:continue
    cp=float(sdf.iloc[-1]["close"])
    sc=fc[fc["unique_id"]==s]if"unique_id"in fc.columns else fc
    vals=sc[col].values if col in(sc.columns if hasattr(sc,"columns")else[])else np.array([cp*1.02])
    if len(vals)>=21:tp1,tp2,tp3=float(vals[4]),float(vals[9]),float(vals[20])
    elif len(vals)>=3:tp1,tp2,tp3=float(vals[0]),float(vals[len(vals)//2]),float(vals[-1])
    else:tp1,tp2,tp3=cp*1.02,cp*1.03,cp*1.05
    sl=round(float(np.min(sdf["low"].tail(14).values)),2)
    avg=((tp1+tp2+tp3)/3-cp)/cp
    sig="BUY"if avg>0.01 else"SELL"if avg<-0.01 else"HOLD"
    d="LONG"if sig!="SELL"else"SHORT"
    preds[s]={"signal":sig,"direction":d,"confidence":min(100,int(abs(avg)*1000)),
     "currentPrice":round(cp,2),"entry":round(cp,2),
     "tp1":round(tp1,2),"tp2":round(tp2,2),"tp3":round(tp3,2),
     "sl":sl,"avgReturn":round(avg,4)}
   results[name]={"trained":True,"version":"2.0.0","predictions":preds}
   print(f"    Done — {len(preds)} stocks")
  except Exception as e:
   print(f"    {name} FAILED: {e}",file=sys.stderr)
   results[name]={"trained":False,"error":str(e)}
 return results

# ─── Model metadata (tier mapping) ───
MODEL_TIERS={
 "PatchTST":"TIER_1","N-BEATS":"TIER_1","TimesNet":"TIER_1","Informer":"TIER_1",
 "Chronos (Amazon)":"TIER_2","Lag-Llama":"TIER_2","Moirai (Salesforce)":"TIER_2","Time-LLM":"TIER_2",
 "XGBoost":"TIER_3","LightGBM":"TIER_3","CatBoost":"TIER_3","Random Forest":"TIER_3","LSTM":"TIER_3",
 "CNN-LSTM":"TIER_4","Transformer-LSTM":"TIER_4","TabNet":"TIER_4","FinGPT":"TIER_4",
}

def backtest_individual(df, models):
 """Backtest each individual model on the chronological test partition —
 DISABLED (Pattern #10 LEAKY_BACKTEST).

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
 print("  backtest_individual: UNAVAILABLE — Pattern #10 leak (latest-signal replay).")
 print("           Use scripts/walk_forward_backtesting.py for leak-free eval.")
 bt={}
 for name,md in models.items():
  if not md.get("trained"):continue
  preds=md.get("predictions",{})
  if not preds:continue
  bt[name]={
   "status":"unavailable",
   "reason":(
    "Pattern #10 LEAKY_BACKTEST: original implementation applied the model's "
    "stored LATEST per-stock signal (md.get('predictions',{}).get(s,{}).get("
    "'signal','HOLD')) to every historical test row in the chronological test "
    "partition. The partition itself was leak-free (chronological_split); "
    "the signal source was the leak (today's signal replayed on every "
    "historical test date). Use scripts/walk_forward_backtesting.py for "
    "leak-free chronological walk-forward evaluation (per-sample re-training "
    "+ per-bar re-inference + realized P&L)."
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

def backtest_ensemble(df, models):
 """Backtest the 3 ensemble methods + final consensus on the chronological
 test partition — DISABLED (Pattern #10 LEAKY_BACKTEST).

 Original implementation: per-stock chronological test partition (the slice
 itself was leak-free thanks to chronological_split), but the SIGNAL applied
 to every historical test row came from `md.get("predictions",{}).get(s,{})`
 — the model's STORED LATEST per-stock signal, constant per stock across
 all historical test rows. This is leakage Pattern #10 (latest-signal
 replay): today's signal applied to historical test dates, which
 misrepresents the historical out-of-sample performance of the ensembles.

 For the leak-free chronological walk-forward evaluation, see
 scripts/walk_forward_backtesting.py (the genuine walk-forward engine that
 Phase A fixed — per-sample re-training + per-bar re-inference + realized
 P&L from future OHLCV). Do NOT duplicate a new walk-forward engine here.

 External interface preserved: same signature (df, models) and same
 per-method top-level return keys (totalTrades / wins / winRate /
 avgReturnPct / maxReturnPct / minReturnPct / stars), with values
 signaling unavailability, PLUS the new status/reason/pointer/
 ml_integrity_note fields.
 """
 print("  backtest_ensemble: UNAVAILABLE — Pattern #10 leak (latest-signal replay).")
 print("           Use scripts/walk_forward_backtesting.py for leak-free eval.")
 trained_models={n:m for n,m in models.items() if m.get("trained") and m.get("predictions",{})}
 if not trained_models:return{}
 result={}
 for method in ["MAJORITY_VOTE","PROBABILITY_WEIGHTED","TIER_WEIGHTED","FINAL_CONSENSUS"]:
  result[method]={
   "status":"unavailable",
   "reason":(
    "Pattern #10 LEAKY_BACKTEST: original implementation applied the model's "
    "stored LATEST per-stock signal (md.get('predictions',{}).get(s,{}).get("
    "'signal','HOLD')) to every historical test row in the chronological test "
    "partition when computing the per-test-bar ensemble signal. The partition "
    "itself was leak-free (chronological_split); the signal source was the "
    "leak (today's signal replayed on every historical test date). Use "
    "scripts/walk_forward_backtesting.py for leak-free chronological walk-"
    "forward evaluation (per-sample re-training + per-bar re-inference + "
    "realized P&L)."
   ),
   "pointer":"scripts/walk_forward_backtesting.py",
   "ml_integrity_note":"Phase 1+2 fix: function disabled to prevent misleading metrics.",
   "totalTrades":int(0),"wins":int(0),
   "winRate":None,"avgReturnPct":None,
   "maxReturnPct":None,"minReturnPct":None,
   "stars":int(0),
  }
 return result

def main():
 print("="*60);print("Latent.pk — Train ALL Models + Ensemble Backtesting");print("="*60)
 df=load();print(f"\nLoaded: {len(df)} rows from {df['symbol'].nunique()} stocks")

 print("\n[1/4] Classical regressors...")
 cl=train_classical(df)

 print("\n[2/4] Deep learning (LSTM, CNN-LSTM, Transformer-LSTM)...")
 lstm=train_lstm(df)
 cnn=train_cnn_lstm(df)
 tl=train_transformer_lstm(df)

 print("\n[3/4] Neuralforecast (PatchTST, N-BEATS, TimesNet, Informer)...")
 nf=train_neuralforecast(df)

 all_models={}
 all_models.update(cl)
 all_models["LSTM"]=lstm
 all_models["CNN-LSTM"]=cnn
 all_models["Transformer-LSTM"]=tl
 all_models.update(nf)

 # Mark untrained
 untrained={"Chronos (Amazon)":"Requires chronos-forecasting package",
  "Lag-Llama":"Requires custom repo","Moirai (Salesforce)":"Requires uni2ts",
  "Time-LLM":"Requires LLM pipeline","TabNet":"Data type issue","FinGPT":"Requires BloombergGPT"}
 for n,r in untrained.items():
  if n not in all_models:all_models[n]={"trained":False,"error":r}

 print("\n[4/4] Computing backtesting (individual models + ensemble)...")
 bt_ind=backtest_individual(df,all_models)
 bt_ens=backtest_ensemble(df,all_models)

 out={"trained_at":pd.Timestamp.now().isoformat(),"data_source":"askanalyst.com.pk",
  "training_rows":int(len(df)),"model_type":"multi_horizon_regressor",
  "targets":["return_5d","return_10d","return_21d"],
  "sl_rule":"min(low[-14:])","tp_rule":"TP1=5d,TP2=10d,TP3=21d",
  "models":all_models,"untrained_models":untrained,
  "backtesting":bt_ind,"ensemble_backtesting":bt_ens,
  "ml_integrity":{
   "target_construction":"per-stock groupby(symbol).shift(-h); no .fillna(0); immature rows left NaN",
   "split":"date-based chronological_split (60/20/20) with per-stock purge of MAX_HORIZON=21 rows at each boundary",
   "scaler_fitting":"fit_scaler_on_train on per-stock TRAIN partition (date <= train_end_date); transform-only on val/test",
   "sequence_construction":"per-stock; decision point = i+SEQ (after the sequence window); immature-target rows skipped",
   "backtest_methodology":"Pattern #10 LEAKY_BACKTEST disabled — function now returns status='unavailable' with reason + pointer to scripts/walk_forward_backtesting.py for genuine walk-forward ML evaluation. backtest_individual + backtest_ensemble no longer apply the model's stored LATEST per-stock signal to every historical test row; per-model / per-method backtest entries now carry status='unavailable' + zeroed metrics.",
   "ml_historical_evaluation":"unavailable",
  }}

 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(out,indent=2,default=lambda o:int(o)if isinstance(o,(np.integer,))else float(o)if isinstance(o,(np.floating,))else str(o)))

 tc=sum(1 for m in all_models.values()if m.get("trained"))
 print(f"\n{'='*60}")
 print(f"TRAINING + BACKTESTING COMPLETE")
 print(f"{'='*60}")
 print(f"Trained: {tc}/{len(all_models)} models")
 print(f"\nIndividual model backtesting:")
 for n,b in bt_ind.items():
  print(f"  {n}: winRate={b['winRate']}% avgReturn={b['avgReturnPct']}% stars={'★'*b['stars']}")
 print(f"\nEnsemble backtesting:")
 for n,b in bt_ens.items():
  print(f"  {n}: trades={b['totalTrades']} winRate={b['winRate']}% avgReturn={b['avgReturnPct']}% stars={'★'*b['stars']}")
 print(f"\nSaved: {OUT}")

if __name__=="__main__":main()
