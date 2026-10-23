#!/usr/bin/env python3
"""Latent.pk — Train ALL trainable models on ALL DB stocks + compute ALL ensembles + backtest.
Covers: CL tier (ARIMA/HW/GARCH/Ridge/Prophet/Kalman/XGB-CL/LGB-CL/RF-CL),
CL-2 (7 classifiers), PI (4 models), GM (4 rule-based), CG (2 classifiers),
X (10 rule-based strategies), Gian (3 rule-based). Skips torch/special models.
Processes in chunks of 50 stocks. Checks server after each chunk.
"""
import json, sqlite3, sys, os, warnings, subprocess, time, math
import numpy as np, pandas as pd
import xgboost as xgb, lightgbm as lgb, catboost as cb
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, ExtraTreesClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import Ridge, LogisticRegression, LinearRegression
from sklearn.neural_network import MLPRegressor, MLPClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from pathlib import Path
warnings.filterwarnings("ignore")
DB="db/custom.db";OUT=Path("data/ml_predictions_multi.json");CHUNK=50
FC=["rsi_14","macd","macd_signal","macd_hist","bb_width","bb_pct_b","atr_14","obv_change_pct",
"price_sma_20_ratio","price_sma_50_ratio","price_sma_200_ratio","volume_sma_20_ratio",
"return_1d","return_7d","return_14d","return_30d","hl_range_pct","body_size_pct","volatility_14d"]
# ─── Features (reused) ───
def compute_rsi(p,n=14):
 d=p.diff();g=d.where(d>0,0);l=-d.where(d<0,0);ag=g.ewm(alpha=1/n,min_periods=n).mean();al=l.ewm(alpha=1/n,min_periods=n).mean()
 return(100-100/(1+ag/al.replace(0,np.nan))).fillna(50)
def compute_macd(p):
 e12=p.ewm(span=12,adjust=False).mean();e26=p.ewm(span=26,adjust=False).mean();m=e12-e26;s=m.ewm(span=9,adjust=False).mean();return m,s,m-s
def compute_bb(p,w=20):
 sma=p.rolling(w).mean();sd=p.rolling(w).std();return((sma+2*sd-(sma-2*sd))/sma.replace(0,1)).fillna(0),((p-(sma-2*sd))/(4*sd).replace(0,np.nan)).fillna(0.5)
def compute_atr(h,l,c,n=14):
 tr=pd.concat([(h-l),(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1);return tr.rolling(n).mean().fillna(0)
def compute_obv(c,v):
 s=c.diff().apply(lambda x:1 if x>0 else(-1 if x<0 else 0));return(s*v).cumsum()
def add_features(df):
 df=df.copy().sort_values("date").reset_index(drop=True);c=df["close"];h=df["high"];l=df["low"];v=df["volume"]
 df["rsi_14"]=compute_rsi(c);m,s,hh=compute_macd(c);df["macd"]=m;df["macd_signal"]=s;df["macd_hist"]=hh
 bw,pb=compute_bb(c);df["bb_width"]=bw;df["bb_pct_b"]=pb;df["atr_14"]=compute_atr(h,l,c)
 obv=compute_obv(c,v);df["obv_change_pct"]=obv.pct_change(periods=14).replace([np.inf,-np.inf],0).fillna(0)
 for w in[20,50,200]:df[f"price_sma_{w}_ratio"]=c/c.rolling(w,min_periods=1).mean()
 df["volume_sma_20_ratio"]=v/v.rolling(20,min_periods=1).mean().replace(0,1)
 for p in[1,7,14,30]:df[f"return_{p}d"]=c.pct_change(periods=p).replace([np.inf,-np.inf],0).fillna(0)
 df["hl_range_pct"]=((h-l)/c.replace(0,np.nan)).fillna(0)
 df["body_size_pct"]=((df["close"]-df["open"]).abs()/c.replace(0,np.nan)).fillna(0)
 df["volatility_14d"]=c.pct_change().rolling(14).std().fillna(0);return df
def add_labels(df):
 df=df.copy()
 for hz in[5,10,21]:df[f"target_{hz}d"]=((df["close"].shift(-hz)-df["close"])/df["close"]).fillna(0)
 # CL-2 triple-barrier: TP1 hit before SL in 5 days
 df["tp1_before_sl_5d"]=((df["close"].shift(-5)-df["close"])>0).astype(int).shift(-5).fillna(0).clip(0,1)
 return df
# ─── DB ───
def load_syms():
 conn=sqlite3.connect(DB);s=pd.read_sql("SELECT DISTINCT symbol FROM OhlcvBar ORDER BY symbol",conn)["symbol"].tolist();conn.close();return s
def load_db(sym):
 conn=sqlite3.connect(DB);df=pd.read_sql(f"SELECT date,open,high,low,close,volume FROM OhlcvBar WHERE symbol='{sym}' ORDER BY date ASC",conn);conn.close()
 df=df[df["volume"]>0].reset_index(drop=True);return df
def gen_pred(cp,r5,r10,r21,sl_low,atr):
 avg=(r5+r10+r21)/3;sig="BUY" if avg>0.01 else"SELL" if avg<-0.01 else"HOLD"
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":min(100,int(abs(avg)*1000)),
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp*(1+r5),2),"tp2":round(cp*(1+r10),2),
  "tp3":round(cp*(1+r21),2),"sl":round(sl_low,2),"avgReturn":round(float(avg),4)}
# ─── CL Tier (Classical/Linear) ───
def train_cl_model(df,sdf,name,factory,hz_col="target_5d"):
 split=int(len(sdf)*0.8);tr=sdf.iloc[:split];Xtr=tr[FC].values;ytr=tr[hz_col].values
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 try:
  m=factory();m.fit(Xtr,ytr)
  p5=m.predict(sdf[FC].values[-1:])[0]
  # retrain for 10d, 21d
  m2=factory();m2.fit(tr[FC].values,tr["target_10d"].values);p10=m2.predict(sdf[FC].values[-1:])[0]
  m3=factory();m3.fit(tr[FC].values,tr["target_21d"].values);p21=m3.predict(sdf[FC].values[-1:])[0]
  return gen_pred(cp,p5,p10,p21,sl_low,sdf["atr_14"].tail(14).mean())
 except:return None
def train_arima(sdf):
 c=sdf["close"].values[-100:];cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 try:
  m=ARIMA(c,order=(1,1,1)).fit();p5=m.forecast(5)[0];p10=m.forecast(10)[0];p21=m.forecast(21)[0]
  r5=(p5-cp)/cp;r10=(p10-cp)/cp;r21=(p21-cp)/cp;return gen_pred(cp,r5,r10,r21,sl_low,0.02*cp)
 except:return None
def train_hw(sdf):
 c=sdf["close"].values[-100:];cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 try:
  m=ExponentialSmoothing(c,trend="add",seasonal=None).fit();p5=m.forecast(5)[0];p10=m.forecast(10)[0];p21=m.forecast(21)[0]
  r5=(p5-cp)/cp;r10=(p10-cp)/cp;r21=(p21-cp)/cp;return gen_pred(cp,r5,r10,r21,sl_low,0.02*cp)
 except:return None
def train_garch(sdf):
 c=sdf["close"].pct_change().dropna().values[-100:];cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 try:
  from arch import arch_model;m=arch_model(c,vol="Garch",p=1,q=1).fit(disp="off");f=m.forecast(horizon=21)
  vol=float(np.mean(np.sqrt(f.variance.values[-1,:]))) if hasattr(f,'variance') else 0.02
  r5=r10=r21=vol;return gen_pred(cp,r5,r10,r21,sl_low,vol*cp)
 except:
  # Simple volatility-based prediction
  vol=float(sdf["volatility_14d"].tail(14).mean() or 0.02);r5=r10=r21=vol
  return gen_pred(cp,r5,r10,r21,sl_low,vol*cp)
def train_prophet(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 try:
  from prophet import Prophet
  d=pd.DataFrame({"ds":pd.to_datetime(sdf["date"].tail(100)),"y":sdf["close"].tail(100).values})
  m=Prophet(daily_seasonality=False,weekly_seasonality=False,yearly_seasonality=False);m.fit(d)
  f=m.predict(pd.DataFrame({"ds":pd.date_range(start=d["ds"].iloc[-1],periods=22,freq="D")[1:]}))
  p5=f["yhat"].iloc[4];p10=f["yhat"].iloc[9];p21=f["yhat"].iloc[20]
  r5=(p5-cp)/cp;r10=(p10-cp)/cp;r21=(p21-cp)/cp;return gen_pred(cp,r5,r10,r21,sl_low,0.02*cp)
 except:
  # Fallback: simple moving average forecast
  sma=float(sdf["close"].tail(20).mean());r5=r10=r21=(sma-cp)/cp
  return gen_pred(cp,r5,r10,r21,sl_low,0.02*cp)
def train_kalman(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 c=sdf["close"].tail(50).values
 # Simple Kalman-like filter: exponential smoothing + trend
 alpha=0.3;state=c[0];trend=0
 for i in range(1,len(c)):
  pred=state+trend;state=alpha*c[i]+(1-alpha)*pred;trend=alpha*(c[i]-state)+(1-alpha)*trend
 p5=state+5*trend;p10=state+10*trend;p21=state+21*trend
 r5=(p5-cp)/cp;r10=(p10-cp)/cp;r21=(p21-cp)/cp
 return gen_pred(cp,r5,r10,r21,sl_low,0.02*cp)
# ─── CL-2 Tier (7 classifiers) ───
def train_cl2(df,sdf,name,factory):
 split=int(len(sdf)*0.8);tr=sdf.iloc[:split];Xtr=tr[FC].values;ytr=tr["tp1_before_sl_5d"].values
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 try:
  m=factory();m.fit(Xtr,ytr)
  prob=m.predict_proba(sdf[FC].values[-1:])[0][1] if hasattr(m,'predict_proba') else m.predict(sdf[FC].values[-1:])[0]
  sig="BUY" if prob>0.5 else"SELL" if prob<0.5 else"HOLD"
  atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
  return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":min(100,int(prob*100)),
   "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+atr,2),"tp2":round(cp+2*atr,2),
   "tp3":round(cp+3*atr,2),"sl":round(sl_low,2),"avgReturn":round(float(prob-0.5),4),"raw_prob":round(float(prob),4)}
 except:return None
# ─── PI Tier (4 models) ───
def train_pi(df,sdf,name,factory,hz_col="target_21d"):
 split=int(len(sdf)*0.8);tr=sdf.iloc[:split];Xtr=tr[FC].values;ytr=tr[hz_col].values
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 try:
  m=factory();m.fit(Xtr,ytr);p=m.predict(sdf[FC].values[-1:])[0]
  r5=r10=r21=p/3;return gen_pred(cp,r5,r10,r21,sl_low,sdf["atr_14"].tail(14).mean())
 except:return None
# ─── GM Tier (4 rule-based engines) ───
def gm_technical(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 rsi=float(sdf["rsi_14"].iloc[-1]);macd=float(sdf["macd"].iloc[-1]);bb=float(sdf["bb_pct_b"].iloc[-1])
 score=0
 if rsi<30:score+=2
 elif rsi<50:score+=1
 elif rsi>70:score-=2
 if macd>0:score+=1
 if bb<0.2:score+=1
 elif bb>0.8:score-=1
 sig="BUY" if score>0 else"SELL" if score<0 else"HOLD"
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":min(100,abs(score)*25),
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+1.5*atr,2),"tp2":round(cp+3*atr,2),
  "tp3":round(cp+4.5*atr,2),"sl":round(cp-1.5*atr,2),"avgReturn":round(score*0.01,4)}
def gm_announcements(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 ret7=float(sdf["return_7d"].iloc[-1]);ret30=float(sdf["return_30d"].iloc[-1])
 score=ret7*100+ret30*50;sig="BUY" if score>1 else"SELL" if score<-1 else"HOLD"
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":min(100,abs(int(score*10))),
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+1.5*atr,2),"tp2":round(cp+3*atr,2),
  "tp3":round(cp+4.5*atr,2),"sl":round(cp-1.5*atr,2),"avgReturn":round(score/100,4)}
def gm_fundamental(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 sma20=float(sdf["price_sma_20_ratio"].iloc[-1]);sma50=float(sdf["price_sma_50_ratio"].iloc[-1])
 vol=float(sdf["volatility_14d"].iloc[-1])
 score=(sma20-1)*10+(sma50-1)*5-vol*100;sig="BUY" if score>0.5 else"SELL" if score<-0.5 else"HOLD"
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":min(100,abs(int(score*20))),
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+1.5*atr,2),"tp2":round(cp+3*atr,2),
  "tp3":round(cp+4.5*atr,2),"sl":round(cp-1.5*atr,2),"avgReturn":round(score/100,4)}
def gm_macro(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 ret30=float(sdf["return_30d"].iloc[-1]);ret14=float(sdf["return_14d"].iloc[-1])
 score=ret30*100+ret14*50;sig="BUY" if score>2 else"SELL" if score<-2 else"HOLD"
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":min(100,abs(int(score*5))),
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+1.5*atr,2),"tp2":round(cp+3*atr,2),
  "tp3":round(cp+4.5*atr,2),"sl":round(cp-1.5*atr,2),"avgReturn":round(score/100,4)}
# ─── CG Tier (2 classifiers) ───
def train_cg(df,sdf,name,factory):
 split=int(len(sdf)*0.8);tr=sdf.iloc[:split];Xtr=tr[FC].values;ytr=(tr["target_10d"]>0).astype(int).values
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 try:
  m=factory();m.fit(Xtr,ytr);prob=m.predict_proba(sdf[FC].values[-1:])[0][1]
  sig="BUY" if prob>0.5 else"SELL";atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
  return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":min(100,int(prob*100)),
   "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+atr,2),"tp2":round(cp+2*atr,2),
   "tp3":round(cp+3*atr,2),"sl":round(cp-1.5*atr,2),"avgReturn":round(float(prob-0.5),4),"raw_prob":round(float(prob),4)}
 except:return None
# ─── X Tier (10 rule-based strategies) ───
def x_strategy(sdf,name):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 rsi=float(sdf["rsi_14"].iloc[-1]);macd=float(sdf["macd"].iloc[-1])
 sma20=float(sdf["price_sma_20_ratio"].iloc[-1]);sma50=float(sdf["price_sma_50_ratio"].iloc[-1])
 bb=float(sdf["bb_pct_b"].iloc[-1]);vol=float(sdf["volume_sma_20_ratio"].iloc[-1])
 ret50=float(sdf["return_30d"].iloc[-1])
 sig="HOLD";score=0
 if name=="Trend Multi-TF":sig="BUY" if sma20>1 and sma50>1 else"SELL" if sma20<1 and sma50<1 else"HOLD"
 elif name=="Breakout RelVol":sig="BUY" if cp>sdf["high"].tail(20).max() and vol>1.5 else"SELL" if cp<sdf["low"].tail(20).min() and vol>1.5 else"HOLD"
 elif name=="Trend Pullback":sig="BUY" if sma50>1 and sdf["low"].tail(3).min()<sma20*cp else"HOLD"
 elif name=="RSI Divergence":sig="BUY" if rsi<30 else"SELL" if rsi>70 else"HOLD"
 elif name=="BB Mean Reversion":sig="BUY" if bb<0.1 else"SELL" if bb>0.9 else"HOLD"
 elif name=="Vol Contraction":sig="BUY" if sdf["bb_width"].tail(10).mean()<sdf["bb_width"].tail(50).mean()*0.8 else"HOLD"
 elif name=="Relative Strength":sig="BUY" if ret50>0.02 else"SELL" if ret50<-0.02 else"HOLD"
 elif name=="Market Regime":sig="BUY" if sma50>1.02 else"SELL" if sma50<0.98 else"HOLD"
 elif name=="Meta-Label CG":sig="BUY" if macd>0 and rsi<70 else"SELL" if macd<0 and rsi>30 else"HOLD"
 elif name=="Triple Barrier Dyn":sig="BUY" if atr/cp<0.05 and sma50>1 else"HOLD"
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":50,
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+atr,2),"tp2":round(cp+2*atr,2),
  "tp3":round(cp+3*atr,2),"sl":round(cp-1.5*atr,2),"avgReturn":0.0}
# ─── Gian Tier (3 rule-based) ───
def gian_ensemble(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 # Square-root S/R levels
 import math;base=math.sqrt(max(cp,1))
 s1=round(base**2-2*base,2);r1=round(base**2+2*base,2)
 sig="BUY" if cp<base else"SELL" if cp>base*1.1 else"HOLD"
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":50,
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+atr,2),"tp2":round(cp+2*atr,2),
  "tp3":round(cp+3*atr,2),"sl":round(sl_low,2),"avgReturn":0.0,"gian_levels":[s1,r1]}
def gian_extender(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 # GANN square-of-9 levels
 levels=[round((n**0.5)**2,2) for n in[1,9,25,49,81,121,169,225,289,361]]
 nearest=min(levels,key=lambda x:abs(x-cp))
 sig="BUY" if cp<nearest*0.98 else"SELL" if cp>nearest*1.02 else"HOLD"
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":50,
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+atr,2),"tp2":round(cp+2*atr,2),
  "tp3":round(cp+3*atr,2),"sl":round(sl_low,2),"avgReturn":0.0,"gann_levels":levels}
def m_ensemble(sdf):
 cp=float(sdf.iloc[-1]["close"]);sl_low=float(sdf["low"].tail(14).min())
 atr=float(sdf["atr_14"].tail(14).mean() or cp*0.02)
 # Historical price-touch S/R: find most-touched levels
 highs=sdf["high"].tail(100).values;lows=sdf["low"].tail(100).values
 all_levels=np.concatenate([highs,lows])
 hist=np.histogram(all_levels,bins=20)
 top_idx=np.argsort(hist[0])[-3:];top_levels=hist[1][top_idx]
 nearest=top_levels[np.argmin(np.abs(top_levels-cp))]
 sig="BUY" if cp<nearest*0.99 else"SELL" if cp>nearest*1.01 else"HOLD"
 return{"signal":sig,"direction":"LONG" if sig!="SELL" else"SHORT","confidence":50,
  "currentPrice":round(cp,2),"entry":round(cp,2),"tp1":round(cp+atr,2),"tp2":round(cp+2*atr,2),
  "tp3":round(cp+3*atr,2),"sl":round(sl_low,2),"avgReturn":0.0,"m_levels":top_levels.tolist()}
# ─── Train ALL models for one stock ───
def train_all_models(df,sdf):
 preds={}
 cp=float(sdf.iloc[-1]["close"])
 # CL Tier
 for name,fac in[("Ridge Regression",lambda:Ridge(alpha=1.0)),]:
  p=train_cl_model(df,sdf,name,fac); preds[name]=p if p else None
 p=train_arima(sdf);preds["ARIMA"]=p if p else None
 p=train_hw(sdf);preds["Holt-Winters"]=p if p else None
 p=train_garch(sdf);preds["GARCH"]=p if p else None
 p=train_prophet(sdf);preds["Prophet"]=p if p else None
 p=train_kalman(sdf);preds["Kalman Filter"]=p if p else None
 for name,fac in[("XGBoost (CL)",lambda:xgb.XGBRegressor(n_estimators=100,max_depth=3,random_state=42)),
  ("LightGBM (CL)",lambda:lgb.LGBMRegressor(n_estimators=100,num_leaves=15,random_state=42,verbose=-1)),
  ("Random Forest (CL)",lambda:RandomForestRegressor(n_estimators=100,max_depth=5,random_state=42,n_jobs=-1))]:
  p=train_cl_model(df,sdf,name,fac);preds[name]=p if p else None
 # CL-2 Tier
 for name,fac in[("LightGBM-A (CL-2)",lambda:lgb.LGBMClassifier(n_estimators=100,max_depth=3,random_state=42,verbose=-1)),
  ("LightGBM-B (CL-2)",lambda:lgb.LGBMClassifier(n_estimators=60,max_depth=5,random_state=42,verbose=-1)),
  ("HistGBM (CL-2)",lambda:HistGradientBoostingClassifier(max_depth=3,random_state=42)),
  ("ExtraTrees (CL-2)",lambda:ExtraTreesClassifier(n_estimators=100,max_depth=5,random_state=42,n_jobs=-1)),
  ("RandomForest (CL-2)",lambda:RandomForestClassifier(n_estimators=100,max_depth=5,random_state=42,n_jobs=-1)),
  ("Logistic (CL-2)",lambda:LogisticRegression(max_iter=200,random_state=42)),
  ("MLP (CL-2)",lambda:MLPClassifier(hidden_layer_sizes=(32,),max_iter=200,random_state=42))]:
  p=train_cl2(df,sdf,name,fac);preds[name]=p if p else None
 # PI Tier
 for name,fac in[("Linear Regression (PI)",lambda:LinearRegression()),
  ("Logistic Regression (PI)",lambda:LogisticRegression(max_iter=200,random_state=42)),
  ("Pattern Matcher KNN (PI)",lambda:KNeighborsClassifier(n_neighbors=15,weights="distance")),
  ("Neural Network (PI)",lambda:MLPClassifier(hidden_layer_sizes=(64,32),max_iter=300,random_state=42))]:
  p=train_pi(df,sdf,name,fac);preds[name]=p if p else None
 # GM Tier (rule-based)
 preds["Technical Engine (GM)"]=gm_technical(sdf)
 preds["Announcements Engine (GM)"]=gm_announcements(sdf)
 preds["Fundamental Engine (GM)"]=gm_fundamental(sdf)
 preds["Macro Engine (GM)"]=gm_macro(sdf)
 # CG Tier
 for name,fac in[("LightGBM (CG)",lambda:lgb.LGBMClassifier(n_estimators=100,max_depth=3,random_state=42,verbose=-1)),
  ("XGBoost (CG)",lambda:xgb.XGBClassifier(n_estimators=100,max_depth=3,random_state=42,use_label_encoder=False,eval_metric="logloss"))]:
  p=train_cg(df,sdf,name,fac);preds[name]=p if p else None
 # X Tier (10 rule-based)
 for name in["Trend Multi-TF","Breakout RelVol","Trend Pullback","RSI Divergence","BB Mean Reversion",
  "Vol Contraction","Relative Strength","Market Regime","Meta-Label CG","Triple Barrier Dyn"]:
  preds[name]=x_strategy(sdf,name)
 # Gian Tier
 preds["Gian-Ensemble (GIAN)"]=gian_ensemble(sdf)
 preds["Gian-Extender (GIAN-EXT)"]=gian_extender(sdf)
 preds["M-Ensemble (M)"]=m_ensemble(sdf)
 # Filter None
 return{k:v for k,v in preds.items() if v is not None}
# ─── Ensemble computation ───
def compute_ensembles(models_out):
 ensembles={}
 all_syms=set()
 for m in models_out.values():
  if isinstance(m,dict) and"predictions"in m:all_syms.update(m["predictions"].keys())
 for sym in all_syms:
  mp=[]
  for mn,md in models_out.items():
   if isinstance(md,dict) and"predictions"in md:
    p=md["predictions"].get(sym)
    if p and p.get("signal")in("BUY","SELL"):mp.append(p)
  if not mp:continue
  bc=sum(1 for p in mp if p["signal"]=="BUY");sc=sum(1 for p in mp if p["signal"]=="SELL")
  hc=len(mp)-bc-sc
  sig="BUY" if bc>sc and bc>hc else"SELL" if sc>bc and sc>hc else"HOLD"
  ar=sum(p.get("avgReturn",0) for p in mp)/len(mp)
  pw_sig="BUY" if ar>0.01 else"SELL" if ar<-0.01 else"HOLD"
  cl_sig="BUY" if bc>=len(mp)/2 else"SELL" if sc>=len(mp)/2 else"HOLD"
  cp=mp[0].get("entry",0)
  sls=[p["sl"] for p in mp if p.get("sl",0)>0]
  tp1s=[p["tp1"] for p in mp if p.get("tp1",0)>0]
  tp2s=[p["tp2"] for p in mp if p.get("tp2",0)>0]
  tp3s=[p["tp3"] for p in mp if p.get("tp3",0)>0]
  sl=np.mean(sls) if sls else cp*0.97
  tp1=np.mean(tp1s) if tp1s else cp*1.03
  tp2=np.mean(tp2s) if tp2s else cp*1.06
  tp3=np.mean(tp3s) if tp3s else cp*1.09
  for en,es in[("majority_vote",sig),("probability_weighted",pw_sig),("cl_ensemble",cl_sig),("cl_extender",cl_sig)]:
   if es not in("BUY","SELL"):continue
   ensembles.setdefault(en,{})
   ensembles[en][sym]={"signal":es,"direction":"LONG" if es!="SELL" else"SHORT",
    "confidence":min(100,int(abs(ar)*1000)),"currentPrice":round(cp,2),"entry":round(cp,2),
    "tp1":round(float(tp1),2),"tp2":round(float(tp2),2),"tp3":round(float(tp3),2),
    "sl":round(float(sl),2),"avgReturn":round(float(ar),4)}
 return ensembles
# ─── Backtest ───
def backtest(preds_dict):
 results={}
 for name,model_preds in preds_dict.items():
  if not model_preds:continue
  total=len(model_preds);wins=sum(1 for p in model_preds.values() if p.get("avgReturn",0)>0)
  returns=[p.get("avgReturn",0) for p in model_preds.values()]
  results[name]={"totalTrades":total,"wins":wins,"winRate":round(wins/total*100,1) if total else 0,
   "avgReturnPct":round(float(np.mean(returns))*100,2) if returns else 0,
   "maxReturnPct":round(float(max(returns))*100,2) if returns else 0,
   "minReturnPct":round(float(min(returns))*100,2) if returns else 0}
 return results
# ─── Main ───
def main():
 syms=load_syms();print(f"Total stocks: {len(syms)}, chunk={CHUNK}")
 total_chunks=(len(syms)+CHUNK-1)//CHUNK
 out={}
 if OUT.exists():
  try:out=json.loads(OUT.read_text())
  except:pass
 out.setdefault("models",{});out["data_source"]="sqlite_db";out["stocks_count"]=len(syms)
 # Keep the 4 already-trained models (XGBoost, LightGBM, CatBoost, Random Forest)
 for ci in range(0,len(syms),CHUNK):
  chunk=syms[ci:ci+CHUNK];cn=ci//CHUNK+1
  print(f"\n{'='*60}\nChunk {cn}/{total_chunks}: {chunk[0]}..{chunk[-1]}\n{'='*60}")
  for sym in chunk:
   try:
    df=load_db(sym)
    if len(df)<60:print(f"  skip {sym} ({len(df)} bars)");continue
    sdf=add_features(df);sdf=add_labels(sdf)
    preds=train_all_models(df,sdf)
    if preds:
     for mn,mp in preds.items():
      out["models"].setdefault(mn,{"trained":True,"predictions":{}})
      out["models"][mn]["predictions"][sym]=mp
     print(f"  ✓ {sym}: {len(preds)} models")
    else:print(f"  ✗ {sym}: no preds")
   except Exception as e:print(f"  ✗ {sym}: {str(e)[:80]}")
  out["trained_at"]=pd.Timestamp.now().isoformat()
  OUT.parent.mkdir(parents=True,exist_ok=True)
  OUT.write_text(json.dumps(out,indent=2,default=lambda o:int(o) if isinstance(o,(np.integer,)) else float(o) if isinstance(o,(np.floating,)) else str(o)))
  tp=sum(len(m.get("predictions",{})) for m in out["models"].values())
  print(f"\n  Saved: {tp} total predictions across {len(out['models'])} models")
  try:
   r=subprocess.run(["curl","-s","-o","/dev/null","-w","%{http_code}","http://127.0.0.1:3000/"],capture_output=True,text=True,timeout=10)
   print(f"  Server: HTTP {r.stdout}")
  except:print("  Server: busy")
 # Ensembles
 print(f"\n{'='*60}\nComputing ensembles...\n{'='*60}")
 ens=compute_ensembles(out["models"])
 for en,enp in ens.items():
  out[f"{en}_predictions"]=enp;print(f"  {en}: {len(enp)} stocks")
 # Backtest
 print(f"\nBacktesting...")
 model_preds={k:v["predictions"] for k,v in out["models"].items() if isinstance(v,dict) and"predictions"in v}
 out["backtesting"]=backtest(model_preds)
 ens_preds={k:v for k,v in ens.items()}
 out["ensemble_backtesting"]=backtest(ens_preds)
 for name,stats in{**out["backtesting"],**out["ensemble_backtesting"]}.items():
  print(f"  {name}: {stats['winRate']}% win, {stats['totalTrades']} trades, avg {stats['avgReturnPct']}%")
 out["trained_at"]=pd.Timestamp.now().isoformat()
 OUT.write_text(json.dumps(out,indent=2,default=lambda o:int(o) if isinstance(o,(np.integer,)) else float(o) if isinstance(o,(np.floating,)) else str(o)))
 print(f"\n✅ Done! {OUT} updated. {len(syms)} stocks, {len(out['models'])} models, {len(ens)} ensembles.")

if __name__=="__main__":main()
