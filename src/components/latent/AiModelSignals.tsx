"use client";
import{useEffect,useState,useRef,Fragment}from"react";
import{Card,CardContent,CardHeader,CardTitle}from"@/components/ui/card";
import{Button}from"@/components/ui/button";
import{Badge}from"@/components/ui/badge";
import{Skeleton}from"@/components/ui/skeleton";
import{Dialog,DialogContent,DialogHeader,DialogTitle}from"@/components/ui/dialog";
import{StockSearch}from"./StockSearch";
import{useLatentStore}from"@/lib/latent/store";
import{Brain,Sparkles,Layers,Cpu,BarChart3,DollarSign,Play,Loader2,Eye,ChevronLeft,TrendingUp,TrendingDown}from"lucide-react";
import{toast}from"sonner";
import{LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,Legend}from"recharts";

interface MP{name:string;tier:string;tierLabel:string;category:string;trained:boolean;untrainedReason?:string;direction?:"LONG"|"SHORT";signal?:"BUY"|"SELL"|"HOLD";confidence?:number;currentPrice?:number;entry?:number;sl?:number;tp1?:number;tp2?:number;tp3?:number;avgReturn?:number;raw_prob?:number;exp_win_rate?:number;agreement?:number;metrics?:any;backtest?:{totalTrades:number;buySignals:number;sellSignals:number;correctBuys:number;correctSells:number;winRate:number;avgReturnPct:number;maxReturnPct:number;minReturnPct:number;stars:number;coveredSymbols?:number;};extended?:boolean;}
interface ER{method:string;methodLabel:string;signal:"BUY"|"SELL"|"HOLD";direction:"LONG"|"SHORT";confidence:number;predictedPrice:number;entry:number;sl:number;tp1:number;tp2:number;tp3:number;modelCount:number;buyCount:number;sellCount:number;holdCount:number;raw_prob?:number;exp_win_rate?:number;agreement?:number;total_score?:number;pillars?:any;expected_return?:number;r_pct?:number;strategy_signals?:any;}
interface FC{signal:"BUY"|"SELL"|"HOLD";direction:"LONG"|"SHORT";confidence:number;agreement:number;predictedPriceRange:{min:number;max:number};entry:number;sl:number;tp1:number;tp2:number;tp3:number;}
interface API{symbol:string;stockName:string;currentPrice:number;tiers:{tier:string;label:string;models:MP[]}[];ensembles:ER[];finalConsensus:FC;trainedModelCount:number;totalModelCount:number;trainedAt:string;cached:boolean;latencyMs:number;backtesting:Record<string,any>;ensembleBacktesting:Record<string,any>;extendedCount?:number;extendedAt?:string|null;backtestSource?:string;}

export function AiModelSignals(){
 const selectedSymbol=useLatentStore(s=>s.selectedSymbol);
 const[symbol,setSymbol]=useState(selectedSymbol||"ENGRO");
 const[data,setData]=useState<API|null>(null);
 const[loading,setLoading]=useState(false);
 const[btOpen,setBtOpen]=useState(false);
 // NEW (Task 49): Walk-Forward ML Forecast Evaluation state — fetched from
 // /api/backtest/walk-forward which reads data/backtest_reports/walk_forward_latest.json.
 // SEPARATE from the existing `data.backtesting`/`data.ensembleBacktesting`
 // (which is the runtime Rule-BT technical-rule evaluation). Do NOT conflate.
 const[wfData,setWfData]=useState<any>(null);
 const[wfLoading,setWfLoading]=useState(false);
 const[wfError,setWfError]=useState<string|null>(null);
 const refreshWf=async()=>{
  setWfLoading(true);setWfError(null);
  try{
   const r=await fetch("/api/backtest/walk-forward?_="+Date.now(),{cache:"no-store"});
   const j=await r.json();
   setWfData(j);
  }catch(e:any){
   setWfError(e?.message||"Failed to load walk-forward report.");
  }finally{setWfLoading(false);}
 };
 useEffect(()=>{if(btOpen&&!wfData&&!wfLoading)refreshWf();},[btOpen]);
 // Task 59: genuine out-of-sample ML trading simulation artifact (lazy-loaded).
 const[trdData,setTrdData]=useState<any|null>(null);
 const[trdLoading,setTrdLoading]=useState(false);
 const[trdError,setTrdError]=useState<string|null>(null);
 const loadTrd=async()=>{
  if(trdData||trdLoading) return;
  setTrdLoading(true);setTrdError(null);
  try{
   const r=await fetch("/api/backtest/walk-forward/trading?_="+Date.now(),{cache:"no-store"});
   const j=await r.json();
   setTrdData(j);
  }catch(e:any){
   setTrdError(e?.message||"Failed to load trading artifact.");
  }finally{setTrdLoading(false);}
 };
 // Task 60: trading-robustness artifact (per-model/horizon breakdown + date-block bootstrap CIs)
 const[robData,setRobData]=useState<any|null>(null);
 const[robLoading,setRobLoading]=useState(false);
 const[robError,setRobError]=useState<string|null>(null);
 const loadRob=async()=>{
  if(robData||robLoading) return;
  setRobLoading(true);setRobError(null);
  try{
   const r=await fetch("/api/backtest/walk-forward/trading-robustness?_="+Date.now(),{cache:"no-store"});
   const j=await r.json();
   setRobData(j);
  }catch(e:any){
   setRobError(e?.message||"Failed to load trading-robustness artifact.");
  }finally{setRobLoading(false);}
 };
 // Task 61: portfolio simulation (genuine cash/position/equity-curve metrics)
 const[prtData,setPrtData]=useState<any|null>(null);
 const[prtLoading,setPrtLoading]=useState(false);
 const[prtError,setPrtError]=useState<string|null>(null);
 const loadPrt=async()=>{
  if(prtData||prtLoading) return;
  setPrtLoading(true);setPrtError(null);
  try{
   const r=await fetch("/api/backtest/walk-forward/portfolio?_="+Date.now(),{cache:"no-store"});
   const j=await r.json();
   setPrtData(j);
  }catch(e:any){
   setPrtError(e?.message||"Failed to load portfolio artifact.");
  }finally{setPrtLoading(false);}
 };
 // Task 66: prospective paper-trading
 const[pstData,setPstData]=useState<any|null>(null);
 const[pstLoading,setPstLoading]=useState(false);
 const[pstError,setPstError]=useState<string|null>(null);
 const loadPst=async()=>{
  if(pstData||pstLoading) return;
  setPstLoading(true);setPstError(null);
  try{
   const r=await fetch("/api/backtest/walk-forward/prospective?_="+Date.now(),{cache:"no-store"});
   const j=await r.json();
   setPstData(j);
  }catch(e:any){
   setPstError(e?.message||"Failed to load prospective artifact.");
  }finally{setPstLoading(false);}
 };
 const[simOpen,setSimOpen]=useState(false);
 const[simAmount,setSimAmount]=useState("100000");
 // Issue 5 — Portfolio Simulation redesign: removed "Position Size" input.
 // Added "No of days" + "No of trades" inputs per user spec.
 const[simDays,setSimDays]=useState("10");
 const[simTrades,setSimTrades]=useState("20");
 const[simSymbol,setSimSymbol]=useState(""); // optional stock filter (default "" = ALL stocks)
 const[simRankBy,setSimRankBy]=useState<"winRate"|"netPnl"|"prediction">("winRate"); // ranking metric
 const[predictScores,setPredictScores]=useState<Record<string,number>>({}); // streak: consecutive 100% win-rate simulations per ensemble
 const[simTargetScore,setSimTargetScore]=useState("1"); // target prediction score for automate
 const[simWinRateThreshold,setSimWinRateThreshold]=useState("100"); // min win rate % to count as a prediction score
 const[automateRunning,setAutomateRunning]=useState(false);
 const[automateCount,setAutomateCount]=useState(0);
 const[automateFinalCount,setAutomateFinalCount]=useState(0); // persists after automate finishes
 const predictScoresRef=useRef<Record<string,number>>({}); // reliable score tracking in async loop
 const automateStopRef=useRef(false); // stop flag for the automate loop
 // Phase 3: per-model actual-vs-predicted graph view (in the Backtesting modal).
 // Enhanced: multi-model checkboxes (All/None), user-tunable decision-point
 // cadence (step), StockSearch symbol picker, KSE-100-only vs whole-market filter.
 const[graphModels,setGraphModels]=useState<string[]>(["XGBoost"]); // multi-select
 const[graphSymbol,setGraphSymbol]=useState(""); // "" = use the current data.symbol
 const[graphHorizon,setGraphHorizon]=useState("21");
 const[graphStep,setGraphStep]=useState("21"); // decision-point cadence (bars between decisions)
 const[graphUniverse,setGraphUniverse]=useState<"all"|"kse100">("all");
 const[kse100Syms,setKse100Syms]=useState<string[]>([]);
 const[graphChart,setGraphChart]=useState<{dates:string[];actual:(number|null)[];models:any[]}|null>(null);
 const[graphLoading,setGraphLoading]=useState(false);
 const[graphMeta,setGraphMeta]=useState<{points?:number;dataSourceDate?:string|null}|null>(null);
 // Task 72: genuine trained-ML out-of-sample graph
 const[mlGraphMode,setMlGraphMode]=useState<"ml"|"rule">("ml"); // ml = trained-ML, rule = strategySignal
 const[mlGraphData,setMlGraphData]=useState<any>(null);
 const[mlGraphLoading,setMlGraphLoading]=useState(false);
 const[mlGraphModel,setMlGraphModel]=useState("XGBoost");
 const[mlGraphHorizon,setMlGraphHorizon]=useState("5");
 const[mlGraphPeriod,setMlGraphPeriod]=useState<"final-test"|"validation">("final-test");
 const ML_GRAPH_MODELS=["XGBoost","LightGBM","CatBoost","Random Forest","Ridge Regression"];
 // KSE-100 constituents (fetched once) — used to restrict the StockSearch picker.
 useEffect(()=>{fetch("/api/psx/indices/KSE100").then(r=>r.ok?r.json():null).then(j=>{if(j?.constituents)setKse100Syms(j.constituents.map((c:any)=>c.symbol));}).catch(()=>{});},[]);
 const GRAPH_MODEL_OPTIONS=["XGBoost","LightGBM","CatBoost","Random Forest","Ridge Regression","ARIMA","Holt-Winters","GARCH","Prophet","Kalman Filter","GRU","LSTM","CNN-LSTM","Transformer-LSTM","PatchTST","N-BEATS","TimesNet","Informer","XGBoost (CL)","LightGBM (CL)","Random Forest (CL)","LightGBM-A (CL-2)","Logistic (CL-2)","Linear Regression (PI)","Pattern Matcher KNN (PI)","LightGBM (CG)","XGBoost (CG)","Trend Multi-TF (X)","Gian-Ensemble (GIAN)","M-Ensemble (M)","majority_vote","probability_weighted","tier_weighted","cl_ensemble","cl2_ensemble","pi_ensemble","gm_model","cg_ensemble","x_ensemble","gian_ensemble","m_ensemble"];
 const GRAPH_COLORS=["#FBBF24","#60A5FA","#A78BFA","#34D399","#F472B6","#22D3EE","#FB923C","#E879F9"];
 const toggleModel=(k:string)=>setGraphModels(prev=>prev.includes(k)?prev.filter(x=>x!==k):[...prev,k]);
 const loadGraph=async()=>{
  const sym=(graphSymbol||data?.symbol||"LUCK").trim().toUpperCase();
  if(!sym){toast.error("Pick a symbol");return;}
  if(graphModels.length===0){toast.error("Select at least one model");return;}
  setGraphLoading(true);
  try{
   const r=await fetch(`/api/backtest/model-graph?models=${encodeURIComponent(graphModels.join(","))}&symbol=${encodeURIComponent(sym)}&horizon=${encodeURIComponent(graphHorizon)}&step=${encodeURIComponent(graphStep)}`);
   const j=await r.json();
   if(j.error){toast.error(j.error);setGraphChart(null);setGraphMeta(null);return;}
   setGraphChart({dates:j.dates||[],actual:j.actual||[],models:j.models||[]});
   setGraphMeta({points:j.points,dataSourceDate:j.dataSourceDate});
  }catch{toast.error("Graph load failed");}
  finally{setGraphLoading(false);}
 };
 useEffect(()=>{ predictScoresRef.current={}; setPredictScores({}); }, [simSymbol]); // reset all scores when the stock changes
 const[simData,setSimData]=useState<any>(null);
 const[simLoading,setSimLoading]=useState(false);
 // "View in depth — Trade by trade" toggle: null = show ranking; an ensemble
 // name = show that ensemble's per-trade table for that section (top-5 or
 // the "rest" list).
 const[simDrilldown,setSimDrilldown]=useState<string|null>(null);
 // Issue 1: LIVE current-price overlay (psxdata-api.fastapicloud.dev), fetched
 // whenever the selected symbol changes. The ml_predictions snapshot price
 // baked into the model file is ~2 days stale — this overlays the live quote.
 const[livePrice,setLivePrice]=useState<number|null>(null);
 const[liveLoading,setLiveLoading]=useState(false);
 const[liveFailed,setLiveFailed]=useState(false);
 // When the user navigates here from another view (e.g. SignalSection's
 // "View in depth" button → setView("ai_model_signals") after selectSymbol),
 // pick up the newly-selected symbol.
 useEffect(()=>{if(selectedSymbol)setSymbol(selectedSymbol);},[selectedSymbol]);
 const load=async()=>{setLoading(true);try{const r=await fetch(`/api/ai-model-signals/${encodeURIComponent(symbol)}`);if(!r.ok)throw new Error(`Failed(${r.status})`);const j=await r.json();setData(j);toast.success(`${j.trainedModelCount}/${j.totalModelCount} models·${j.finalConsensus.signal}(${j.finalConsensus.confidence}%)`);}catch(e){toast.error(e instanceof Error?e.message:"Failed");}finally{setLoading(false);}};
 useEffect(()=>{load();},[symbol]);
 // Issue 1: refetch the live quote every time the symbol changes (independent
 // of the main data load so it doesn't block the model cards). Falls back to
 // data.currentPrice (snapshot) if the upstream is unreachable.
 useEffect(()=>{
  let cancelled=false;
  setLivePrice(null);
  setLiveFailed(false);
  setLiveLoading(true);
  fetch(`/api/psx/live?symbol=${encodeURIComponent(symbol)}`)
   .then(r=>r.ok?r.json():null)
   .then(j=>{
    if(cancelled)return;
    if(j&&typeof j.price==="number"&&j.price>0){setLivePrice(j.price as number);}
    else{setLiveFailed(true);}
   })
   .catch(()=>{if(!cancelled)setLiveFailed(true);})
   .finally(()=>{if(!cancelled)setLiveLoading(false);});
  return()=>{cancelled=true;};
 },[symbol]);
 const sc=(s?:string)=>s==="BUY"?"text-[#00E676]":s==="SELL"?"text-[#FF5C5C]":"text-[#94A3B8]";
 const sb=(s?:string)=>s==="BUY"?"bg-[#00E676]/10 border-[#00E676]/40 text-[#00E676]":s==="SELL"?"bg-[#FF5C5C]/10 border-[#FF5C5C]/40 text-[#FF5C5C]":"bg-white/[0.04] border-white/[0.12] text-[#94A3B8]";
 // Collect backtesting data
 const indBt=data?Object.entries(data.backtesting||{}).map(([name,b]:[string,any])=>({name,...b})).sort((a,b)=>b.winRate-a.winRate):[];
 const ensBt=data?Object.entries(data.ensembleBacktesting||{}).map(([name,b]:[string,any])=>({name,...b})):[];

 return(<div className="min-h-screen bg-[#0A0E1A]">
 <main className="px-3 md:px-6 py-4 md:py-6 max-w-5xl mx-auto">
  <div className="mb-4 md:mb-6">
   <h1 className="text-xl md:text-2xl font-bold text-[#F4F7FB] flex items-center gap-2"><Brain className="h-5 w-5 md:h-6 md:w-6 text-[#00E676]"/>AI Model Signals</h1>
   <p className="text-xs md:text-sm text-[#94A3B8] mt-1">{data?`${data.trainedModelCount}/${data.totalModelCount} models trained·SL=support·TP1/2/3=5d/10d/21d predictions`:"Loading..."}</p>
  </div>

  <Card className="bg-[#131829] border-white/[0.08] mb-3 md:mb-4"><CardContent className="p-3 md:p-4">
   <div className="flex items-center gap-3 flex-wrap">
    <div className="flex-1 min-w-[180px]"><label className="text-[10px] uppercase tracking-wider text-[#64748B]">Select Stock (any of 1000+ PSX-listed companies)</label>
    <div className="mt-1"><StockSearch value={symbol} onChange={(sym)=>setSymbol(sym)} placeholder="Search any PSX stock..." /></div>
    </div>
    {data&&<div className="text-right">
     <div className="text-[10px] uppercase text-[#64748B] flex items-center gap-1 justify-end">
      {liveLoading?<span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/>Live</span>:(livePrice!=null&&!liveFailed)?<span className="text-[#00E676] flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#00E676] animate-pulse"/>Live</span>:"Current Price"}
     </div>
     <div className="text-xl md:text-2xl font-bold text-[#F4F7FB] font-mono">PKR {(livePrice!=null?livePrice:data.currentPrice).toFixed(2)}</div>
     {liveFailed&&livePrice==null&&<div className="text-[9px] text-[#64748B]">snapshot fallback</div>}
    </div>}
    <Button size="sm" variant="outline" onClick={load} disabled={loading} className="border-white/[0.12] text-[#94A3B8]">{loading?"...":"Refresh"}</Button>
   </div>
  </CardContent></Card>

  {loading&&!data&&<div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-20 md:h-24 bg-white/[0.04]"/>)}</div>}

  {data&&(<>
   <Card className="bg-gradient-to-br from-[#00E676]/[0.07] to-[#131829] border-[#00E676]/30 mb-3 md:mb-4">
    <CardHeader className="pb-2"><CardTitle className="text-sm md:text-base text-[#F4F7FB] flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#00E676]"/>Final Ensemble Consensus</CardTitle></CardHeader>
    <CardContent>
     <div className="grid md:grid-cols-2 gap-3">
      <div><div className="text-[10px] uppercase text-[#64748B] mb-1">Signal</div>
      <div className="flex items-center gap-2"><span className={`text-2xl md:text-3xl font-bold ${sc(data.finalConsensus.signal)}`}>{data.finalConsensus.signal}</span><Badge variant="outline" className={`${sb(data.finalConsensus.signal)} border`}>{data.finalConsensus.direction}</Badge></div>
      <div className="text-xs text-[#94A3B8] mt-2">Conf:<span className="text-[#F4F7FB] font-mono">{data.finalConsensus.confidence}%</span>·Agreement:<span className="text-[#F4F7FB] font-mono">{data.finalConsensus.agreement}%</span></div></div>
      <div><div className="text-[10px] uppercase text-[#64748B] mb-1">Predicted Range</div><div className="text-base md:text-lg font-mono text-[#F4F7FB]">PKR {data.finalConsensus.predictedPriceRange.min.toFixed(2)} — {data.finalConsensus.predictedPriceRange.max.toFixed(2)}</div></div>
     </div>
     <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3">
      <TS label="Entry" v={data.finalConsensus.entry.toFixed(2)}/><TS label="SL(support)" v={data.finalConsensus.sl.toFixed(2)} tone="negative"/><TS label="TP1(5d)" v={data.finalConsensus.tp1.toFixed(2)} tone="positive"/><TS label="TP2(10d)" v={data.finalConsensus.tp2.toFixed(2)} tone="positive"/><TS label="TP3(21d)" v={data.finalConsensus.tp3.toFixed(2)} tone="positive"/>
     </div>
    </CardContent>
   </Card>

   <Card className="bg-[#131829] border-white/[0.08] mb-3 md:mb-4"><CardHeader className="pb-2"><CardTitle className="text-sm md:text-base text-[#F4F7FB] flex items-center gap-2"><Layers className="h-4 w-4 text-[#00E676]"/>Ensemble Methods</CardTitle></CardHeader><CardContent>
    <div className="grid md:grid-cols-3 gap-2 md:gap-3">{data.ensembles.map(en=>(
     <div key={en.method} className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-2.5 md:p-3">
      <div className="text-[10px] uppercase text-[#64748B] mb-1.5">{en.methodLabel}</div>
      <div className={`text-lg md:text-xl font-bold mb-1 ${sc(en.signal)}`}>{en.signal}</div>
      <div className="text-[10px] text-[#94A3B8] mb-1.5">Confidence:<span className="font-mono">{en.confidence}%</span></div>
      <div className="grid grid-cols-2 gap-1 text-[10px]">
       <div><span className="text-[#64748B]">Entry:</span><span className="font-mono text-[#F4F7FB]">{en.entry.toFixed(2)}</span></div>
       <div><span className="text-[#64748B]">SL:</span><span className="font-mono text-[#FF5C5C]">{en.sl.toFixed(2)}</span></div>
       <div><span className="text-[#64748B]">TP1:</span><span className="font-mono text-[#00E676]">{en.tp1.toFixed(2)}</span></div>
       <div><span className="text-[#64748B]">TP2:</span><span className="font-mono text-[#00E676]">{en.tp2.toFixed(2)}</span></div>
       <div><span className="text-[#64748B]">TP3:</span><span className="font-mono text-[#00E676]">{en.tp3.toFixed(2)}</span></div>
       <div><span className="text-[#64748B]">Pred:</span><span className="font-mono text-[#F4F7FB]">{en.predictedPrice.toFixed(2)}</span></div>
      </div>
      <div className="text-[10px] text-[#64748B] mt-1.5 pt-1.5 border-t border-white/[0.04]">{en.buyCount}B·{en.sellCount}S·{en.holdCount}H</div>
      {en.raw_prob!=null&&en.exp_win_rate!=null&&en.agreement!=null&&(
       <div className="text-[10px] text-[#64748B] mt-1 pt-1 border-t border-white/[0.04]">
        <div className="flex items-center justify-between"><span>raw_prob:</span><span className="font-mono text-[#94A3B8]">{typeof en.raw_prob==="number"?en.raw_prob.toFixed(3):String(en.raw_prob)}</span></div>
        <div className="flex items-center justify-between"><span>exp_win_rate:</span><span className="font-mono text-[#00E676]">{typeof en.exp_win_rate==="number"?(en.exp_win_rate*100).toFixed(1)+"%":String(en.exp_win_rate)}</span></div>
        <div className="flex items-center justify-between"><span>agreement:</span><span className="font-mono text-[#F4F7FB]">{typeof en.agreement==="number"?(en.agreement*100).toFixed(0)+"%":String(en.agreement)}</span></div>
       </div>
      )}
      {en.total_score!=null&&en.pillars!=null&&typeof en.total_score==="number"&&(
       <div className="text-[10px] text-[#64748B] mt-1 pt-1 border-t border-white/[0.04]">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[#94A3B8] font-semibold">GM 4-Pillar Score:</span>
          <span className={`font-mono font-bold ${en.total_score>=0.45?"text-[#00E676]":en.total_score<=-0.45?"text-[#FF5C5C]":"text-[#94A3B8]"}`}>{en.total_score>=0?"+":""}{en.total_score.toFixed(3)}</span>
        </div>
        {typeof en.pillars.tech_score==="number"&&<div className="flex items-center justify-between"><span>Tech (35%):</span><span className="font-mono text-[#00E676]">{en.pillars.tech_score>=0?"+":""}{en.pillars.tech_score.toFixed(3)}</span></div>}
        {typeof en.pillars.anno_score==="number"&&<div className="flex items-center justify-between"><span>Anno (30%):</span><span className="font-mono text-[#00E676]">{en.pillars.anno_score>=0?"+":""}{en.pillars.anno_score.toFixed(3)}</span></div>}
        {typeof en.pillars.fund_score==="number"&&<div className="flex items-center justify-between"><span>Fund (20%):</span><span className="font-mono text-[#00E676]">{en.pillars.fund_score>=0?"+":""}{en.pillars.fund_score.toFixed(3)}</span></div>}
        {typeof en.pillars.macro_score==="number"&&<div className="flex items-center justify-between"><span>Macro (15%):</span><span className="font-mono text-[#00E676]">{en.pillars.macro_score>=0?"+":""}{en.pillars.macro_score.toFixed(3)}</span></div>}
       </div>
      )}
      {typeof en.expected_return==="number"&&typeof en.r_pct==="number"&&(
       <div className="text-[10px] text-[#64748B] mt-1 pt-1 border-t border-white/[0.04]">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[#94A3B8] font-semibold">CG Cost-Aware:</span>
          <span className={`font-mono font-bold ${en.expected_return>0?"text-[#00E676]":"text-[#FF5C5C]"}`}>{en.expected_return>=0?"+":""}{(en.expected_return*100).toFixed(2)}%</span>
        </div>
        <div className="flex items-center justify-between"><span>R (risk/share):</span><span className="font-mono text-[#94A3B8]">{(en.r_pct*100).toFixed(2)}%</span></div>
        <div className="text-[9px] text-[#64748B] mt-0.5 italic">net of 50bps round-trip + 15% CGT on gains</div>
       </div>
      )}
      {en.strategy_signals!=null&&typeof en.strategy_signals==="object"&&(
       <div className="text-[10px] text-[#64748B] mt-1 pt-1 border-t border-white/[0.04]">
        <div className="text-[#94A3B8] font-semibold mb-0.5">X 10-Strategy Signals:</div>
        {Object.entries(en.strategy_signals).slice(0,10).map(([sname,sval]:[string,any])=>(
          <div key={sname} className="flex items-center justify-between">
            <span className="truncate">{sval===1?"✓":"✗"} {sname}</span>
            <span className={`font-mono ${sval===1?"text-[#00E676]":"text-[#64748B]"}`}>{sval===1?"BUY":"—"}</span>
          </div>
        ))}
       </div>
      )}
     </div>))}</div>
   </CardContent></Card>

   {data.tiers.map(tg=>(
    <Card key={tg.tier} className="bg-[#131829] border-white/[0.08] mb-3 md:mb-4"><CardHeader className="pb-2"><CardTitle className="text-sm md:text-base text-[#F4F7FB] flex items-center gap-2"><Cpu className="h-4 w-4 text-[#00E676]"/>{tg.label}</CardTitle><p className="text-[10px] md:text-xs text-[#94A3B8] mt-0.5">{tg.models.filter(m=>m.trained).length}/{tg.models.length} trained</p></CardHeader><CardContent>
     <div className="space-y-2">{tg.models.map(m=>{
      // coveredSymbols (stocks the model was backtested across) lives in the
      // DB ModelBacktestCache, which the route merges into data.backtesting
      // (NOT into m.backtest — that's the file-based subset). Merge it here so
      // the model card's "Stocks covered" badge reflects the full extended
      // universe (the user spec: "how much stock each model is trained on").
      const btAny=data?.backtesting?.[m.name]as any;
      const m2=btAny&&btAny.coveredSymbols!==undefined?{...m,backtest:{...(m.backtest as any),coveredSymbols:btAny.coveredSymbols}}:m;
      return <MC key={m.name} m={m2}/>;
     })}</div>
    </CardContent></Card>
   ))}

   {/* Action Buttons */}
   <div className="text-center py-4 md:py-6 flex gap-3 justify-center flex-wrap">
    <Button onClick={()=>setBtOpen(true)} size="lg" className="bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold">
     <BarChart3 className="h-4 w-4 md:h-5 md:w-5 mr-2"/>Check Backtesting Results
    </Button>
    <Button onClick={()=>setSimOpen(true)} size="lg" variant="outline" className="border-[#00E676]/40 text-[#00E676] hover:bg-[#00E676]/10 font-semibold">
     <DollarSign className="h-4 w-4 md:h-5 md:w-5 mr-2"/>Portfolio Simulation
    </Button>
   </div>

   {/* Simulation Modal — Issue 5 redesign */}
   <Dialog open={simOpen} onOpenChange={o=>{if(!o){setSimOpen(false);setSimDrilldown(null);}}}>
    <DialogContent className="bg-[#131829] border-white/[0.12] w-[95vw] max-w-[1600px] max-h-[90vh] overflow-y-auto">
     <DialogHeader><DialogTitle className="text-[#F4F7FB] flex items-center gap-2"><DollarSign className="h-5 w-5 text-[#00E676]"/>Portfolio Simulation</DialogTitle></DialogHeader>
     <div className="space-y-4">
      <p className="text-xs text-[#94A3B8]">
       <span className="text-[#F4F7FB] font-semibold">REAL-history simulation</span> — each ensemble runs on ITS OWN per-stock BUY signals
       (from ml_predictions_multi.json) over the <span className="text-[#00E676]">real</span> DB-backed daily OHLCV. Trades enter at <span className="text-[#00E676]">real</span> bar closes
       + use the ensemble's SL/TP distances. <span className="text-[#F4F7FB]">No of days (optional)</span>:
       if given → window = the last N real bars (today back N days, e.g. 5 → 18–23 Oct); if blank → any start day.
       Take <span className="text-[#00E676] font-mono">N trades</span> within the window; exit by <span className="text-[#00E676]">TP3</span> (best TP) / TP2 / TP1 / SL / window-end
       (TP rule: check TP3 → TP2 → TP1). Costs: 0.30% commission (0.15% × 2 sides) + 0.50% round-trip slippage + 15% CGT on net gains.
      </p>

      {/* Input controls — Issue 5: removed "Position Size %", added "No of days" + "No of trades" */}
      <div className="flex gap-3 flex-wrap items-end">
       <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Capital (PKR)</label>
        <input type="number" value={simAmount} onChange={e=>setSimAmount(e.target.value)} placeholder="100000" className="bg-[#0A0E1A] border border-white/[0.12] rounded px-3 py-2 text-[#F4F7FB] font-mono text-sm w-[160px]" />
       </div>
       <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">No of days (optional · blank = any start)</label>
        <input type="number" value={simDays} onChange={e=>setSimDays(e.target.value)} placeholder="5 (recent N days)" min="0" max="252" className="bg-[#0A0E1A] border border-white/[0.12] rounded px-3 py-2 text-[#F4F7FB] font-mono text-sm w-[140px]" />
       </div>
       <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">No of trades</label>
        <input type="number" value={simTrades} onChange={e=>setSimTrades(e.target.value)} placeholder="20" min="1" max="100" className="bg-[#0A0E1A] border border-white/[0.12] rounded px-3 py-2 text-[#F4F7FB] font-mono text-sm w-[120px]" />
       </div>
       <div className="min-w-[200px] flex-1">
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Stock (optional · default ALL)</label>
        <div className="bg-[#0A0E1A] border border-white/[0.12] rounded"><StockSearch value={simSymbol} onChange={(s)=>setSimSymbol(s)} placeholder="ALL stocks — or pick one" /></div>
       </div>
       <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Rank by</label>
        <div className="flex bg-[#0A0E1A] border border-white/[0.12] rounded p-0.5">
         <button onClick={()=>setSimRankBy("winRate")} className={`px-2.5 py-1.5 rounded text-[10px] font-mono font-semibold transition-colors ${simRankBy==="winRate"?"bg-[#00E676]/15 text-[#00E676]":"text-[#64748B] hover:text-[#F4F7FB]"}`}>Win Rate</button>
         <button onClick={()=>setSimRankBy("netPnl")} className={`px-2.5 py-1.5 rounded text-[10px] font-mono font-semibold transition-colors ${simRankBy==="netPnl"?"bg-[#00E676]/15 text-[#00E676]":"text-[#64748B] hover:text-[#F4F7FB]"}`}>Net P&L</button>
         <button onClick={()=>setSimRankBy("prediction")} className={`px-2.5 py-1.5 rounded text-[10px] font-mono font-semibold transition-colors ${simRankBy==="prediction"?"bg-[#00E676]/15 text-[#00E676]":"text-[#64748B] hover:text-[#F4F7FB]"}`}>Prediction</button>
        </div>
       </div>
       <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Streak Target (repeats)</label>
        <input type="number" value={simTargetScore} onChange={e=>setSimTargetScore(e.target.value)} placeholder="1" min="1" max="999" className="bg-[#0A0E1A] border border-white/[0.12] rounded px-3 py-2 text-[#F4F7FB] font-mono text-sm w-[100px]" />
       </div>
       <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Min Win Rate: <span className="text-[#00E676] font-mono">{simWinRateThreshold}%</span></label>
        <input type="range" value={simWinRateThreshold} onChange={e=>setSimWinRateThreshold(e.target.value)} min="0" max="100" step="1" className="w-[140px] accent-[#00E676]" />
       </div>
       <Button onClick={async()=>{
         setSimLoading(true); setSimDrilldown(null);
         try{
          const symParam = simSymbol ? `&symbol=${encodeURIComponent(simSymbol)}` : "";
          const r=await fetch(`/api/backtest/ensembles?capital=${encodeURIComponent(simAmount)}&numTrades=${encodeURIComponent(simTrades)}&numDays=${encodeURIComponent(simDays)}${symParam}&rankBy=${simRankBy === "prediction" ? "winRate" : simRankBy}`);
          const d=await r.json();
          if(d.error){toast.error(d.error);return;}
          setSimData(d);
          const threshold = parseInt(simWinRateThreshold) || 100;
          const currentScores = { ...predictScoresRef.current };
          for (const r of [...(d.top5||[]), ...(d.rest||[])]) {
            if (r.metrics && r.metrics.winRate >= threshold) {
              currentScores[r.ensembleName] = (currentScores[r.ensembleName] || 0) + 1;
            }
          }
          predictScoresRef.current = currentScores;
          setPredictScores(currentScores);
          toast.success(`Simulated ${d.totalEnsembles} ensembles · ${d.numTrades} trades each · ${d.numDays}-day hold`);
         }catch(e){toast.error("Simulation failed");}
         finally{setSimLoading(false);}
        }} disabled={simLoading||automateRunning} size="sm" className="bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881]">
        {simLoading?"Running...":"Simulate"}<Play className="h-3 w-3 ml-2"/>
       </Button>
       <Button onClick={async()=>{
         const target = parseInt(simTargetScore) || 1;
         const maxRuns = 50;
         automateStopRef.current = false;
         setAutomateRunning(true); setAutomateCount(0); setSimDrilldown(null);
         predictScoresRef.current={}; setPredictScores({}); setAutomateFinalCount(0); // reset scores + count to 0 on each Automate click
         let count = 0; let reached = false;
         while (count < maxRuns && !automateStopRef.current) {
          count++; setAutomateCount(count);
          try{
           const symParam = simSymbol ? `&symbol=${encodeURIComponent(simSymbol)}` : "";
           const r=await fetch(`/api/backtest/ensembles?capital=${encodeURIComponent(simAmount)}&numTrades=${encodeURIComponent(simTrades)}&numDays=${encodeURIComponent(simDays)}${symParam}&rankBy=winRate`);
           const d=await r.json();
           if(d.error){toast.error(d.error);break;}
           setSimData(d);
           const threshold = parseInt(simWinRateThreshold) || 100;
           const currentScores = { ...predictScoresRef.current };
           reached = false;
           for (const r of [...(d.top5||[]), ...(d.rest||[])]) {
             if (r.metrics && r.metrics.winRate >= threshold) {
               currentScores[r.ensembleName] = (currentScores[r.ensembleName] || 0) + 1;
               if (currentScores[r.ensembleName] >= target) reached = true;
             }
           }
           predictScoresRef.current = currentScores;
           setPredictScores(currentScores);
           if (reached) {
             toast.success(`Target score ${target} reached after ${count} simulations!`);
             break;
           }
          }catch(e){toast.error("Simulation failed");break;}
         }
         setAutomateRunning(false);
         setAutomateFinalCount(count); // persist the count after automate finishes
         if (!reached && count >= maxRuns) {
          toast.info(`Stopped after ${count} simulations (max). No ensemble reached score ${target}.`);
         }
        }} disabled={automateRunning||simLoading} size="sm" className="bg-[#FBBF24] text-[#0A0E1A] hover:bg-[#FBBF24]/90">
        {automateRunning?`Auto (${automateCount})`:"Automate"}<Play className="h-3 w-3 ml-2"/>
       </Button>
       {automateRunning && <Button onClick={()=>{automateStopRef.current=true;}} size="sm" className="bg-[#FF5C5C] text-white hover:bg-[#FF5C5C]/90">Stop</Button>}
       {automateRunning && <span className="text-[10px] text-[#FBBF24] animate-pulse">Running simulation {automateCount}...</span>}
       {!automateRunning && automateFinalCount > 0 && (
         <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FBBF24]/10 border border-[#FBBF24]/30 text-[11px] text-[#FBBF24] font-semibold">
           <TrendingUp className="h-3.5 w-3.5" /> Automate finished: {automateFinalCount} simulation{automateFinalCount===1?"":"s"} run.
         </div>
       )}
      </div>

      {simData&&simData.top5&&(
       <>
       {/* Summary */}
       <div className="rounded-lg bg-[#0A0E1A] border border-[#00E676]/20 p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
         <div><div className="text-[10px] uppercase text-[#64748B]">Starting Capital</div><div className="font-mono font-bold text-[#F4F7FB]">PKR {Number(simData.capital).toLocaleString()}</div></div>
         <div><div className="text-[10px] uppercase text-[#64748B]">Amount Per Trade</div><div className="font-mono font-bold text-[#F4F7FB]">PKR {Number(simData.amountPerTrade).toLocaleString()}</div></div>
         <div><div className="text-[10px] uppercase text-[#64748B]">Ensembles Simulated</div><div className="font-mono font-bold text-[#00E676]">{simData.totalEnsembles}</div></div>
         <div><div className="text-[10px] uppercase text-[#64748B]">Days · Trades</div><div className="font-mono font-bold text-[#F4F7FB]">{simData.numDays}d · {simData.numTrades}</div></div>
        </div>
       </div>

       {/* Drill-down: show one ensemble's trade-by-trade table */}
       {simDrilldown?(()=>{
         const all=[...simData.top5,...simData.rest];
         const ens=all.find(e=>e.ensembleName===simDrilldown);
         if(!ens)return null;
         return (
          <div>
           <Button onClick={()=>setSimDrilldown(null)} variant="outline" size="sm" className="border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB] mb-3">
            <ChevronLeft className="h-3.5 w-3.5 mr-1"/>Back to ranking
           </Button>
           <h3 className="text-sm font-semibold text-[#00E676] mb-2">{ens.ensembleLabel} — Trade by trade</h3>
           {ens.trades.length===0?(
            <p className="text-xs text-[#64748B] py-4 text-center">No trades — this ensemble had no actionable signals with OHLCV bars in the DB.</p>
           ):(
            <div className="overflow-x-auto custom-scroll rounded-md border border-white/[0.06]">
             <table className="w-full text-[10px] whitespace-nowrap">
              <thead className="bg-[#0A0E1A] sticky top-0">
               <tr className="border-b border-white/[0.08] text-[#64748B]">
                <th className="text-left py-1.5 px-1.5">#</th>
                <th className="text-left py-1.5 px-1.5">Symbol</th>
                <th className="text-right py-1.5 px-1.5">Entry date</th>
                <th className="text-right py-1.5 px-1.5">Closing date</th>
                <th className="text-left py-1.5 px-1.5">Signal</th>
                <th className="text-right py-1.5 px-1.5">CS</th>
                <th className="text-right py-1.5 px-1.5">Entry</th>
                <th className="text-right py-1.5 px-1.5">Close</th>
                <th className="text-right py-1.5 px-1.5">SL</th>
                <th className="text-left py-1.5 px-1.5">Hit</th>
                <th className="text-right py-1.5 px-1.5">TP1</th>
                <th className="text-right py-1.5 px-1.5">TP2</th>
                <th className="text-right py-1.5 px-1.5">TP3</th>
                <th className="text-right py-1.5 px-1.5">Invested</th>
                <th className="text-left py-1.5 px-1.5">Result</th>
                <th className="text-right py-1.5 px-1.5">P&amp;L</th>
                <th className="text-right py-1.5 px-1.5">Portfolio</th>
               </tr>
              </thead>
              <tbody>
               {ens.trades.map((t:any)=>(
                <tr key={t.tradeNo} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                 <td className="py-1 px-1.5 font-mono text-[#64748B]">{t.tradeNo}</td>
                 <td className="py-1 px-1.5 font-mono font-semibold text-[#F4F7FB]">{t.symbol}</td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#94A3B8]">{t.entryDate ? new Date(t.entryDate).toLocaleDateString("en-PK",{year:"2-digit",month:"short",day:"numeric"}) : "—"}</td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#94A3B8]">{t.exitDate ? new Date(t.exitDate).toLocaleDateString("en-PK",{year:"2-digit",month:"short",day:"numeric"}) : "—"}</td>
                 <td className="py-1 px-1.5"><Badge variant="outline" className="text-[8px] py-0 h-3.5 border-[#00E676]/40 text-[#00E676]">{t.signal || t.side}</Badge></td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#94A3B8]">{t.confidence ?? 0}</td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#F4F7FB]">{t.entryPrice.toFixed(2)}</td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#F4F7FB]">{(t.close ?? t.exitPrice ?? 0).toFixed(2)}</td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#FF5C5C]/80">{t.sl.toFixed(2)}</td>
                 <td className="py-1 px-1.5"><Badge variant="outline" className={`text-[8px] py-0 h-3.5 ${t.exitReason==="TP3"?"border-[#00E676]/40 text-[#00E676] bg-[#00E676]/10":t.exitReason==="TP2"?"border-[#00E676]/30 text-[#00E676] bg-[#00E676]/8":t.exitReason==="TP1"?"border-[#00E676]/25 text-[#00E676]/90 bg-[#00E676]/6":t.exitReason==="SL"?"border-[#FF5C5C]/40 text-[#FF5C5C] bg-[#FF5C5C]/10":"border-white/[0.12] text-[#64748B] bg-white/[0.04]"}`}>{t.exitReason === "TIME" ? "Close" : t.exitReason}</Badge></td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#00E676]/80">{t.tp1.toFixed(2)}</td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#00E676]/90">{t.tp2.toFixed(2)}</td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#00E676]">{t.tp3.toFixed(2)}</td>
                 <td className="py-1 px-1.5 text-right font-mono text-[#94A3B8]">{Math.round(t.invested).toLocaleString()}</td>
                 <td className={`py-1 px-1.5 font-mono font-semibold ${t.isWin?"text-[#00E676]":"text-[#FF5C5C]"}`}>{t.isWin?"✓ W":"✗ L"}</td>
                 <td className={`py-1 px-1.5 text-right font-mono font-semibold ${t.netPnl>=0?"text-[#00E676]":"text-[#FF5C5C]"}`}>{t.netPnl>=0?"+":""}{Math.round(t.netPnl).toLocaleString()}</td>
                 <td className={`py-1 px-1.5 text-right font-mono ${t.portfolio>=ens.metrics.startingCapital?"text-[#00E676]":"text-[#FF5C5C]"}`}>{Math.round(t.portfolio).toLocaleString()}</td>
                </tr>
               ))}
              </tbody>
             </table>
            </div>
           )}
          </div>
         );
       })():(
        <>
         {/* ALL ensemble models — ranked by win rate, full metrics each (per user spec) */}
         <div>
          <h3 className="text-sm font-semibold text-[#00E676] mb-2 flex items-center gap-1.5">
           <TrendingUp className="h-4 w-4"/>All ensemble models — ranked by {simRankBy === "winRate" ? "win rate" : simRankBy === "netPnl" ? "net P&L" : "streak count"}
           <span className="text-[10px] text-[#64748B] ml-2">
             Showing {[...simData.top5, ...simData.rest].filter((r:any) => r.metrics && r.metrics.totalTrades > 0 && r.metrics.winRate >= (parseInt(simWinRateThreshold) || 0)).length} of {[...simData.top5, ...simData.rest].length} (min win rate: {simWinRateThreshold}%)
           </span>
          </h3>
          <div className="space-y-2">
           {((simRankBy === "prediction"
             ? [...simData.top5, ...simData.rest].sort((a:any,b:any) => (predictScores[b.ensembleName]||0) - (predictScores[a.ensembleName]||0))
             : [...simData.top5, ...simData.rest]
           ).filter((r:any) => {
             // Phase 5: slider actually FILTERS results — only show results meeting the threshold
             // Results with 0 completed trades are excluded from win-rate-qualified results
             const threshold = parseInt(simWinRateThreshold) || 0;
             return r.metrics && r.metrics.totalTrades > 0 && r.metrics.winRate >= threshold;
           })).map((r:any,idx:number)=>(
            <div key={r.ensembleName} className="rounded-lg bg-[#0A0E1A] border border-[#00E676]/20 p-3">
             <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
               <span className="h-6 w-6 rounded-full bg-[#00E676] text-[#0A0E1A] font-bold text-xs flex items-center justify-center">{idx+1}</span>
               <span className="text-sm font-semibold text-[#00E676]">{r.ensembleLabel}</span>
               {predictScores[r.ensembleName] > 0 && <Badge variant="outline" className="text-[8px] py-0 h-3.5 border-[#FBBF24]/40 text-[#FBBF24] bg-[#FBBF24]/10 ml-1">Streak: {predictScores[r.ensembleName]}</Badge>}
               {r.metrics && r.metrics.totalTrades > 0 ? (
                 <Badge variant="outline" className="text-[8px] py-0 h-3.5 border-[#00E676]/40 text-[#00E676] bg-[#00E676]/10 ml-1" title={`Empirical win rate from ${r.metrics.totalTrades} completed trades`}>
                   Backtest Score: {(r.metrics.winRate / 100).toFixed(2)} <span className="text-[#64748B]">({r.metrics.totalTrades} trades)</span>
                 </Badge>
               ) : (
                 <Badge variant="outline" className="text-[8px] py-0 h-3.5 border-white/[0.12] text-[#64748B] ml-1">Backtest Score: unavailable</Badge>
               )}
              </div>
              <Button onClick={()=>setSimDrilldown(r.ensembleName)} size="sm" variant="outline" className="border-[#00E676]/30 text-[#00E676] hover:bg-[#00E676]/10 h-7 text-[11px]">
               <Eye className="h-3 w-3 mr-1"/>View in depth — Trade by trade
              </Button>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div><div className="text-[10px] uppercase text-[#64748B]">Starting Capital</div><div className="font-mono text-[#F4F7FB]">PKR {Math.round(r.metrics.startingCapital).toLocaleString()}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Amount Per Trade</div><div className="font-mono text-[#F4F7FB]">PKR {Math.round(r.metrics.amountPerTrade).toLocaleString()}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Total Trades (BUY only)</div><div className="font-mono text-[#F4F7FB]">{r.metrics.totalTrades} <span className="text-[#64748B] text-[10px]">(natural: {r.metrics.naturalBuyCount})</span></div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Days</div><div className="font-mono text-[#F4F7FB]">{r.metrics.numDays} days <span className="text-[#64748B] text-[10px]">({r.metrics.tradesPerDay}/day)</span></div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Win Rate</div><div className="font-mono text-[#00E676]">{r.metrics.winRate.toFixed(2)}%</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Win/Loss Trades</div><div className="font-mono"><span className="text-[#00E676]">{r.metrics.winTrades}</span>/<span className="text-[#FF5C5C]">{r.metrics.lossTrades}</span></div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Avg Win</div><div className="font-mono text-[#00E676]">+{r.metrics.avgWinPct.toFixed(2)}%</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Avg Loss</div><div className="font-mono text-[#FF5C5C]">{r.metrics.avgLossPct.toFixed(2)}%</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Gross Profit</div><div className="font-mono text-[#00E676]">PKR {Math.round(r.metrics.grossProfit).toLocaleString()}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Gross Loss</div><div className="font-mono text-[#FF5C5C]">PKR {Math.round(r.metrics.grossLoss).toLocaleString()}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Total Costs (comm+slip+CGT)</div><div className="font-mono text-[#94A3B8]">PKR {Math.round(r.metrics.totalCosts).toLocaleString()}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Gross Before Costs</div><div className="font-mono text-[#94A3B8]">PKR {Math.round(r.metrics.grossBeforeCosts).toLocaleString()}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Net P&L</div><div className={`font-mono font-bold ${r.metrics.netPnL>=0?"text-[#00E676]":"text-[#FF5C5C]"}`}>{r.metrics.netPnL>=0?"+":""}PKR {Math.round(r.metrics.netPnL).toLocaleString()}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Final Portfolio Value</div><div className={`font-mono font-bold ${r.metrics.finalValue>=r.metrics.startingCapital?"text-[#00E676]":"text-[#FF5C5C]"}`}>PKR {Math.round(r.metrics.finalValue).toLocaleString()}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">ROI</div><div className={`font-mono font-bold ${r.metrics.roiPct>=0?"text-[#00E676]":"text-[#FF5C5C]"}`}>{r.metrics.roiPct>=0?"+":""}{r.metrics.roiPct.toFixed(2)}%</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Max Drawdown</div><div className="font-mono text-[#FF5C5C]">PKR {Math.round(r.metrics.maxDrawdownPkr).toLocaleString()} <span className="text-[10px]">(-{r.metrics.maxDrawdownPct.toFixed(2)}%)</span></div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Sharpe / Sortino</div><div className="font-mono text-[#94A3B8]">{r.metrics.sharpe.toFixed(2)} / {r.metrics.sortino.toFixed(2)}</div></div>
              <div><div className="text-[10px] uppercase text-[#64748B]">Profit Factor</div><div className={`font-mono ${r.metrics.profitFactor>=1.3?"text-[#00E676]":r.metrics.profitFactor>=1?"text-[#FBBF24]":"text-[#FF5C5C]"}`}>{r.metrics.profitFactor.toFixed(2)}</div></div>
             </div>
            </div>
           ))}
           {[...simData.top5, ...simData.rest].length===0&&<p className="text-xs text-[#64748B] py-4 text-center">No results — no ensemble produced any trades for this stock/filter.</p>}
          </div>
         </div>
        </>
       )}

       <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3 text-[11px] text-[#64748B] leading-relaxed">
        <span className="text-[#94A3B8] font-semibold">Simulation notes:</span> Each ensemble is treated as a
        separate "model" in the ranking; each uses its own per-symbol signals (entry/SL/TP1/TP2/TP3) —
        the per-ensemble values computed from ml_predictions_multi.json. Trades are sorted by R:R
        (deterministic). Entry bar = the bar `numDays` before the latest DB bar; fill = that bar's close.
        Exit at first TP-tier / SL hit during the hold period, or time-up at the N-day close. Per-trade
        costs: 0.15% × 2 sides commission + 0.50% round-trip slippage + 15% CGT on net gains. MaxDD =
        peak-to-trough on the equity curve. Past performance does not guarantee future returns.
       </div>
       </>
      )}

      {!simData&&(
       <div className="text-center py-8">
        <DollarSign className="h-10 w-10 text-[#00E676]/30 mx-auto mb-3"/>
        <p className="text-sm text-[#94A3B8]">Enter capital, days, and trade count — then click Simulate to rank all 10 ensembles by net ROI.</p>
       </div>
      )}
     </div>
    </DialogContent>
   </Dialog>

   {/* Backtesting Modal */}
   <Dialog open={btOpen} onOpenChange={o=>!o&&setBtOpen(false)}>
    <DialogContent className="bg-[#131829] border-white/[0.12] max-w-3xl max-h-[80vh] overflow-y-auto">
     <DialogHeader><DialogTitle className="text-[#F4F7FB] flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#00E676]"/>Backtesting Report</DialogTitle></DialogHeader>
     <div className="space-y-4">
      <p className="text-xs text-[#94A3B8]">Backtesting on 20% holdout test set. Star ratings:★★★★★=80%+win,★★★★=60%+,★★★=40%+.</p>
      {data?.backtestSource==="db-extended-universe"&&<p className="text-[10px] text-[#FBBF24] mt-1">Full-universe backtest (includes new/low-data PSX stocks via extended training) — DB-cached.</p>}
      {/* ML-integrity honesty banner (Priority 3): the runtime backtest below
          evaluates every model via the shared strategySignal() indicator engine,
          NOT trained-ML artifacts. Treated as a technical-rule-strategy evaluation. */}
      <div className="rounded-md border border-[#22D3EE]/30 bg-[#22D3EE]/[0.06] p-2 text-[10px] text-[#94A3B8] leading-relaxed">
       <span className="text-[#22D3EE] font-semibold">ML-integrity note:</span> The backtest stats below are a <span className="text-[#F4F7FB]">technical-rule-strategy evaluation</span>, not a trained-ML artifact evaluation. The runtime backtest engine (<code className="text-[#00E676]">model-backtest.ts → runAllBacktests</code>) computes every model&apos;s signal via the shared <code className="text-[#00E676]">strategySignal()</code> indicator engine in <code className="text-[#00E676]">fallback-predictions.ts</code> — i.e. 65 indicator-strategy variants, not 65 trained models. Live per-stock predictions (shown on the model cards above) DO use Python-trained artifacts from <code className="text-[#00E676]">data/ml_predictions_multi.json</code> where available. The <span className="text-[#22D3EE] font-semibold">ML Forecast Evaluation (Walk-Forward)</span> section below shows genuine trained-ML walk-forward results when available.
      </div>

      {/* ─── NEW (Task 49): ML Forecast Evaluation — Walk-Forward ────────────────
          Genuine chronological walk-forward evaluation of trained-ML models.
          SEPARATE from (and NOT comparable to) the Technical-Rule Strategy
          Backtest below. Source: data/backtest_reports/walk_forward_latest.json
          via /api/backtest/walk-forward. Renders negative R² honestly. */}
      <div className="rounded-lg border border-[#22D3EE]/30 bg-[#0A0E1A]/60 p-3">
       <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-[#22D3EE] flex items-center gap-1.5">
         <TrendingUp className="h-4 w-4"/> ML Forecast Evaluation — Walk-Forward
        </h3>
        <div className="flex items-center gap-1.5">
         {wfLoading&&<Loader2 className="h-3 w-3 animate-spin text-[#22D3EE]"/>}
         <Button size="sm" variant="outline" onClick={refreshWf} disabled={wfLoading}
          className="h-6 text-[10px] border-[#22D3EE]/30 text-[#22D3EE] hover:bg-[#22D3EE]/10">
          {wfLoading?"Refreshing…":"Refresh"}
         </Button>
        </div>
       </div>
       {wfError&&<p className="text-xs text-[#FF5C5C] mb-2">Error: {wfError}</p>}

       {/* Empty / unavailable state */}
       {!wfLoading&&wfData&&!wfData.available&&(
        <div className="rounded-md border border-[#FBBF24]/30 bg-[#FBBF24]/[0.06] p-2 text-[11px] text-[#94A3B8] leading-relaxed">
         <div className="text-[#FBBF24] font-semibold mb-0.5">No completed walk-forward evaluation is available yet.</div>
         {wfData.error&&<div className="mb-1">{wfData.error}</div>}
         {wfData.how_to_generate&&(
          <div className="font-mono text-[10px] text-[#22D3EE] bg-[#0A0E1A] border border-white/[0.06] rounded p-1.5">
           {wfData.how_to_generate}
          </div>
         )}
        </div>
       )}

       {/* Loaded + available */}
       {wfData&&wfData.available&&(
        <div className="space-y-3">
         {/* Status header */}
         <div className="flex items-center gap-2 flex-wrap text-[10px]">
          <Badge variant="outline" className={`h-4 py-0 ${
            wfData.evaluation_status==="completed"?"border-[#00E676]/40 text-[#00E676]":
            wfData.evaluation_status==="partial"?"border-[#FBBF24]/40 text-[#FBBF24]":
            "border-[#FF5C5C]/40 text-[#FF5C5C]"}`} title="Evaluation completion status">
           {wfData.evaluation_status?.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="h-4 py-0 border-[#22D3EE]/40 text-[#22D3EE]" title="Genuine chronological walk-forward (per-sample retraining on data[date < sample.date] — no look-ahead)">
           WALK-FORWARD
          </Badge>
          <span className="text-[#64748B]">method:</span>
          <code className="text-[#94A3B8] text-[10px]">{wfData.evaluation_method}</code>
          <span className="text-[#64748B]">·schema v{wfData.schema_version}</span>
         </div>

         {/* Meta */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
          <div><div className="text-[9px] uppercase text-[#64748B]">Generated</div><div className="font-mono text-[#94A3B8]">{wfData.generated_at?new Date(wfData.generated_at).toLocaleString():"—"}</div></div>
          <div><div className="text-[9px] uppercase text-[#64748B]">Data cutoff</div><div className="font-mono text-[#94A3B8]">{wfData.data_cutoff?new Date(wfData.data_cutoff).toLocaleDateString():"—"}</div></div>
          <div><div className="text-[9px] uppercase text-[#64748B]">Eval range</div><div className="font-mono text-[#94A3B8]">{wfData.evaluation_date_range?.start?new Date(wfData.evaluation_date_range.start).toLocaleDateString():"—"}→{wfData.evaluation_date_range?.end?new Date(wfData.evaluation_date_range.end).toLocaleDateString():"—"}</div></div>
          <div><div className="text-[9px] uppercase text-[#64748B]">Universe</div><div className="font-mono text-[#94A3B8]">{wfData.universe_size} stocks · {wfData.n_eligible_samples} samples{wfData.universe?.mode?` · ${wfData.universe.mode}`:""}</div></div>
         </div>
         <div className="flex items-center gap-2 flex-wrap text-[10px]">
          <span className="text-[#64748B]">Symbols:</span>
          <code className="text-[#94A3B8] text-[10px]">{(wfData.evaluated_symbols||[]).join(", ")||"—"}</code>
         </div>

         {/* Per-model × per-horizon metrics table */}
         {Array.isArray(wfData.models)&&wfData.models.length>0&&(
          <div className="overflow-x-auto">
           <table className="w-full text-[10px] border-collapse">
            <thead>
             <tr className="text-[#64748B] border-b border-white/[0.08]">
              <th className="text-left py-1 px-1.5 font-medium">Model</th>
              <th className="text-left py-1 px-1.5 font-medium">Type</th>
              <th className="text-left py-1 px-1.5 font-medium">Horizon</th>
              <th className="text-right py-1 px-1.5 font-medium">n_obs</th>
              <th className="text-right py-1 px-1.5 font-medium">MAE</th>
              <th className="text-right py-1 px-1.5 font-medium">RMSE</th>
              <th className="text-right py-1 px-1.5 font-medium">R²</th>
              <th className="text-right py-1 px-1.5 font-medium">Dir Acc</th>
              {/* Task 51 Phase 3: 3 baselines — constant-mean (R² reference), zero-return, training-only-mean */}
              <th className="text-right py-1 px-1.5 font-medium" title="Constant-mean baseline (R² reference — R²=0 by construction)">CM R²</th>
              <th className="text-right py-1 px-1.5 font-medium" title="Zero-return baseline (predict 0 for all — measures no-trade strategy)">Zero R²</th>
              <th className="text-right py-1 px-1.5 font-medium" title="Training-only-mean baseline (per-sample, predict mean of matured training targets — pooled market-wide)">Train-Mean R²</th>
             </tr>
            </thead>
            <tbody>
             {wfData.models.flatMap((m:any)=>(wfData.forecast_horizons||[]).map((hz:number)=>{
              const h=m.horizons?.[String(hz)]||m.horizons?.[hz]||{status:"unavailable"};
              const completed=h.status==="completed";
              const baselines=h.baselines||{};  // Task 51: {constant_mean, zero_return, training_only_mean}
              // R² color: negative = red, 0 = amber, positive = green (honest — no clamping)
              const r2Color=completed&&typeof h.r2==="number"?(h.r2<-0.001?"text-[#FF5C5C]":h.r2>0.001?"text-[#00E676]":"text-[#FBBF24]"):completed&&!h.r2?"text-[#FBBF24]":"text-[#64748B]";
              const r2Display=completed?(h.r2===null||h.r2===undefined?"NaN":h.r2.toFixed(4)):"—";
              const cmR2=baselines.constant_mean?.r2;
              const zeroR2=baselines.zero_return?.r2;
              const tboR2=baselines.training_only_mean?.r2;
              const tboStatus=baselines.training_only_mean?.status||"unavailable";
              return (
               <tr key={m.name+"-"+hz} className="border-b border-white/[0.04] hover:bg-[#22D3EE]/[0.04]">
                <td className="py-1 px-1.5 text-[#F4F7FB] font-medium">{m.name}</td>
                <td className="py-1 px-1.5 text-[#22D3EE]">{m.implementation_type}</td>
                <td className="py-1 px-1.5 text-[#94A3B8]">{hz}d</td>
                <td className="py-1 px-1.5 text-right font-mono text-[#94A3B8]">{completed?(h.n_observations??"—"):"—"}</td>
                <td className="py-1 px-1.5 text-right font-mono text-[#94A3B8]">{completed&&typeof h.mae==="number"?h.mae.toFixed(6):"—"}</td>
                <td className="py-1 px-1.5 text-right font-mono text-[#94A3B8]">{completed&&typeof h.rmse==="number"?h.rmse.toFixed(6):"—"}</td>
                <td className={`py-1 px-1.5 text-right font-mono font-bold ${r2Color}`} title={completed?(h.r2===null?"R² undefined (actual is constant)":"Negative R² = model worse than constant-mean baseline — honest"):"Not evaluated"}>{r2Display}</td>
                <td className="py-1 px-1.5 text-right font-mono text-[#94A3B8]">{completed&&typeof h.directional_accuracy==="number"?(h.directional_accuracy*100).toFixed(2)+"%":"—"}</td>
                {/* Task 51 Phase 3: 3 baselines — R² values, NOT clamped */}
                <td className="py-1 px-1.5 text-right font-mono text-[#64748B]" title={baselines.constant_mean?.definition}>{typeof cmR2==="number"?cmR2.toFixed(4):(cmR2===null?"NaN":"—")}</td>
                <td className="py-1 px-1.5 text-right font-mono text-[#64748B]" title={baselines.zero_return?.definition}>{typeof zeroR2==="number"?zeroR2.toFixed(4):(zeroR2===null?"NaN":"—")}</td>
                <td className="py-1 px-1.5 text-right font-mono text-[#64748B]" title={baselines.training_only_mean?.definition}>
                 {tboStatus==="completed"?(typeof tboR2==="number"?tboR2.toFixed(4):(tboR2===null?"NaN":"—")):<span className="text-[#FBBF24]">unavail</span>}
                </td>
               </tr>
              );
             }))}
            </tbody>
           </table>
          </div>
         )}

         {/* Task 51 Phase 2: WIN_RATE_WEIGHTED ensemble methodology note */}
         {wfData.win_rate_weighted_ensemble_methodology&&(
          <div className="rounded-md border border-[#22D3EE]/20 bg-[#22D3EE]/[0.04] p-2 text-[10px] text-[#94A3B8]">
           <div className="text-[#22D3EE] font-semibold mb-0.5">WIN_RATE_WEIGHTED ensemble — Phase 2 fix (Option A)</div>
           <div>{wfData.win_rate_weighted_ensemble_methodology.phase_2_fix} — frozen validation-period weights (validation samples marked unavailable; final-test samples use frozen weights). No future-outcome leakage.</div>
           {wfData.win_rate_weighted_ensemble_methodology.frozen_weights&&(
            <div className="mt-1 font-mono text-[10px]">
             Frozen weights: {Object.entries(wfData.win_rate_weighted_ensemble_methodology.frozen_weights).map(([k,v]:any)=>`${k}=${(v as number).toFixed(3)}`).join(", ")}
            </div>
           )}
          </div>
         )}

         {/* Task 51 Phase 5: explicit sample-count metadata */}
         <div className="rounded-md border border-white/[0.06] bg-[#0A0E1A]/40 p-2 text-[10px]">
          <div className="text-[#94A3B8] font-semibold mb-1">Sample-count metadata</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
           <div><div className="text-[9px] uppercase text-[#64748B]">Unique (stock,date) samples</div><div className="font-mono text-[#F4F7FB]">{wfData.n_unique_stock_date_samples??"—"}</div></div>
           <div><div className="text-[9px] uppercase text-[#64748B]">Total model fits</div><div className="font-mono text-[#F4F7FB]">{wfData.n_model_fits??"—"}</div></div>
           <div><div className="text-[9px] uppercase text-[#64748B]">Unique prediction dates</div><div className="font-mono text-[#F4F7FB]">{wfData.n_unique_prediction_dates??"—"}</div></div>
           <div><div className="text-[9px] uppercase text-[#64748B]">Sampling interval</div><div className="font-mono text-[#F4F7FB]">{wfData.sampling_interval_sessions??"—"} sessions</div></div>
          </div>
          <div className="mt-1 text-[9px] text-[#64748B]">
           Do NOT interpret {String(wfData.n_unique_stock_date_samples??"")} as "samples per stock" — it's total unique (stock, decision-date) pairs across {wfData.universe_size} stocks. Per-stock sample count ≈ {wfData.n_unique_stock_date_samples&&wfData.universe_size?Math.round(wfData.n_unique_stock_date_samples/wfData.universe_size):"—"}.
          </div>
         </div>

         {/* Task 51 Phase 4: trading-metrics label */}
         {wfData.trading_metrics?.label&&(
          <div className="rounded-md border border-[#FBBF24]/20 bg-[#FBBF24]/[0.04] p-2 text-[10px] text-[#94A3B8]">
           <div className="text-[#FBBF24] font-semibold">Trading metrics: {wfData.trading_metrics.label}</div>
           <div className="mt-0.5">{wfData.trading_metrics.definition}</div>
           <div className="mt-0.5 text-[#FF5C5C]">Net trading P&L: {wfData.trading_metrics.net_trading_pnl} — {wfData.trading_metrics.net_trading_pnl_reason}</div>
          </div>
         )}

         {/* Task 52: universe selector metadata + per-stock results */}
         {wfData.universe&&(
          <div className="rounded-md border border-[#22D3EE]/20 bg-[#22D3EE]/[0.04] p-2 text-[10px] text-[#94A3B8]">
           <div className="text-[#22D3EE] font-semibold mb-0.5">Universe selector — mode: {wfData.universe.mode}</div>
           <div className="text-[9px]">{wfData.universe.criteria}</div>
           <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[9px]">
            <div><div className="text-[#64748B] uppercase text-[8px]">Candidates</div>{wfData.universe.candidate_count??"—"}</div>
            <div><div className="text-[#64748B] uppercase text-[8px]">Eligible</div>{wfData.universe.eligible_count??"—"}</div>
            <div><div className="text-[#64748B] uppercase text-[8px]">Included</div>{wfData.universe.included_count??"—"}</div>
            <div><div className="text-[#64748B] uppercase text-[8px]">Excluded</div><span className={wfData.universe.excluded_count?"text-[#FF5C5C]":""}>{wfData.universe.excluded_count??0}</span></div>
           </div>
           <div className="mt-1 text-[9px] text-[#64748B]">Data source: {wfData.universe.data_source}{wfData.universe.min_bars_required?` · min ${wfData.universe.min_bars_required} bars`:""}</div>
          </div>
         )}

         {/* Task 52: per-stock results table (collapsible) */}
         {wfData.per_stock_results&&Object.keys(wfData.per_stock_results).length>0&&(
          <details className="text-[10px] text-[#94A3B8]">
           <summary className="cursor-pointer text-[#22D3EE] font-semibold">Per-stock results ({Object.keys(wfData.per_stock_results).length} stocks)</summary>
           <div className="mt-1 overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-[9px] border-collapse">
             <thead className="sticky top-0 bg-[#0A0E1A]">
              <tr className="text-[#64748B] border-b border-white/[0.06]">
               <th className="text-left py-1 pr-2 font-medium">Symbol</th>
               <th className="text-right py-1 px-1 font-medium">Samples</th>
               {Array.isArray(wfData.models)&&wfData.models.flatMap((m:any)=>m?[(m.name)]:[]).slice(0,5).map((mn:string)=>(
                <th key={mn} colSpan={3} className="text-center py-1 px-1 font-medium border-l border-white/[0.06]">{mn}</th>
               ))}
              </tr>
              <tr className="text-[#64748B] text-[8px]">
               <th className="py-0.5"></th><th className=""></th>
               {Array.isArray(wfData.models)&&wfData.models.flatMap((m:any)=>m?[(m.name)]:[]).slice(0,5).map((_:string)=>(
                <Fragment key={_+"-h"}>
                 <th className="text-right px-1 border-l border-white/[0.06]">5d R²</th>
                 <th className="text-right px-1">10d R²</th>
                 <th className="text-right px-1">21d R²</th>
                </Fragment>
               ))}
              </tr>
             </thead>
             <tbody>
              {Object.entries(wfData.per_stock_results).sort().map(([sym, info]:[string,any])=>(
               <tr key={sym} className="border-b border-white/[0.04]">
                <td className="py-1 pr-2 font-mono text-[#F4F7FB]">{sym}</td>
                <td className="text-right px-1 text-[#94A3B8]">{info.samples_count}</td>
                {Array.isArray(wfData.models)&&wfData.models.flatMap((m:any)=>m?[(m.name)]:[]).slice(0,5).map((mn:string)=>{
                 const m=info.models?.[mn]||{};
                 return (
                  <Fragment key={sym+mn}>
                   <td className={"text-right px-1 border-l border-white/[0.06] "+((m[5]?.r2!=null&&m[5]?.r2<0)?"text-[#FF5C5C]":"text-[#94A3B8]")}>{m[5]?.status==="completed"?(m[5]?.r2!=null?m[5].r2.toFixed(3):"—"):"unavail"}</td>
                   <td className={"text-right px-1 "+((m[10]?.r2!=null&&m[10]?.r2<0)?"text-[#FF5C5C]":"text-[#94A3B8]")}>{m[10]?.status==="completed"?(m[10]?.r2!=null?m[10].r2.toFixed(3):"—"):"unavail"}</td>
                   <td className={"text-right px-1 "+((m[21]?.r2!=null&&m[21]?.r2<0)?"text-[#FF5C5C]":"text-[#94A3B8]")}>{m[21]?.status==="completed"?(m[21]?.r2!=null?m[21].r2.toFixed(3):"—"):"unavail"}</td>
                  </Fragment>
                 );
                })}
               </tr>
              ))}
             </tbody>
            </table>
           </div>
           <div className="mt-1 text-[9px] text-[#64748B]">R² shown per stock × model × horizon. Negative R² in red — model worse than constant-mean baseline on that stock. "unavail" = fewer than 2 matured samples for that stock×model×horizon.</div>
          </details>
         )}

         {/* Unevaluated combos */}
         {Array.isArray(wfData.unevaluated)&&wfData.unevaluated.length>0&&(
          <div className="rounded-md border border-[#FBBF24]/20 bg-[#FBBF24]/[0.04] p-2 text-[10px]">
           <div className="text-[#FBBF24] font-semibold mb-1">Not evaluated ({wfData.unevaluated.length} model×horizon combos)</div>
           <ul className="space-y-0.5 text-[#94A3B8]">
            {wfData.unevaluated.slice(0,8).map((u:any,i:number)=>(
             <li key={i}><code className="text-[#94A3B8]">{u.model}</code> {u.horizon}d — {u.reason}</li>
            ))}
            {wfData.unevaluated.length>8&&<li className="text-[#64748B]">…and {wfData.unevaluated.length-8} more</li>}
           </ul>
          </div>
         )}

         {/* Task 59: Out-of-Sample ML Trading Simulation (collapsible, lazy-loaded) */}
         <details className="text-[10px] text-[#94A3B8]" onToggle={(e)=>{const o=(e.target as HTMLDetailsElement).open; if(o) loadTrd();}}>
          <summary className="cursor-pointer text-[#00E676] font-semibold">
            Out-of-Sample ML Trading Simulation (Task 59) — genuine executed trades, realized net P&L
          </summary>
          {trdLoading&&<div className="mt-1 text-[#94A3B8]">Loading trading artifact…</div>}
          {trdError&&<div className="mt-1 text-[#FF5C5C]">{trdError}</div>}
          {trdData&&trdData.available===true&&(
           <div className="mt-1 space-y-2">
             <div className="rounded-md border border-[#00E676]/20 bg-[#00E676]/[0.04] p-2 text-[9px]">
               <div className="text-[#00E676] font-semibold mb-0.5">Genuine out-of-sample ML trading — DISTINCT from forecast-quality (R²/MAE) + signal-stats replay + technical-rule backtest</div>
               <div className="text-[#94A3B8]">Signal: BUY if stored OOS predicted return &gt; +1% (long-only). Entry: next session OPEN. Costs: {trdData.cost_profile_primary?.label ?? "standard_psx"}. Final-test samples: {trdData.final_test_sample_range?.count}. Verified OHLCV: {trdData.forward_return_verification?.verified}/{trdData.forward_return_verification?.verified + trdData.forward_return_verification?.mismatch} (maxAbsDiff={trdData.forward_return_verification?.maxAbsDiff?.toExponential(2)}).</div>
             </div>
             {/* Strategy metrics table */}
             <div className="overflow-x-auto">
               <table className="w-full text-[9px] border-collapse">
                 <thead className="bg-[#0A0E1A]">
                   <tr className="text-[#64748B] border-b border-white/[0.06]">
                     <th className="text-left py-1 pr-2 font-medium">Strategy</th>
                     <th className="text-right py-1 px-1 font-medium">Trades</th>
                     <th className="text-right py-1 px-1 font-medium">Wins</th>
                     <th className="text-right py-1 px-1 font-medium">Losses</th>
                     <th className="text-right py-1 px-1 font-medium">Net P&L (PKR)</th>
                     <th className="text-right py-1 px-1 font-medium">Profit Factor</th>
                     <th className="text-right py-1 px-1 font-medium">Avg Net %</th>
                     <th className="text-right py-1 px-1 font-medium">TP-then-SL</th>
                   </tr>
                 </thead>
                 <tbody>
                   {trdData.metrics&&Object.entries(trdData.metrics).filter(([k]:[string,any])=>k!=="progressive_tp_sl_high_slippage_sensitivity").map(([k,m]:[string,any])=>(
                     <tr key={k} className="border-b border-white/[0.04]">
                       <td className="py-0.5 pr-2 font-mono text-[#F4F7FB]">{k==="fixed_horizon"?"Fixed-horizon":"Progressive TP/SL"}</td>
                       <td className="text-right px-1 text-[#94A3B8]">{m.n_executed_trades}</td>
                       <td className="text-right px-1 text-[#00E676]">{m.wins}</td>
                       <td className="text-right px-1 text-[#FF5C5C]">{m.losses}</td>
                       <td className={"text-right px-1 font-mono "+(m.total_net_pnl>=0?"text-[#00E676]":"text-[#FF5C5C]")}>{Math.round(m.total_net_pnl).toLocaleString()}</td>
                       <td className="text-right px-1 font-mono text-[#94A3B8]">{m.profit_factor!=null?m.profit_factor.toFixed(3):"—"}</td>
                       <td className="text-right px-1 font-mono text-[#94A3B8]">{(m.avg_net_return_pct??0).toFixed(3)}%</td>
                       <td className="text-right px-1 text-[#FF5C5C]">{k==="progressive_tp_sl"?m.n_tp_then_sl:"—"}</td>
                     </tr>
                   ))}
                   {/* High-slippage sensitivity row */}
                   {trdData.metrics?.progressive_tp_sl_high_slippage_sensitivity&&(
                     <tr className="border-b border-white/[0.04] bg-[#FBBF24]/[0.04]">
                       <td className="py-0.5 pr-2 font-mono text-[#FBBF24]">Progressive TP/SL (high-slip sens.)</td>
                       <td className="text-right px-1 text-[#94A3B8]">{trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.n_executed_trades}</td>
                       <td className="text-right px-1 text-[#00E676]">{trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.wins}</td>
                       <td className="text-right px-1 text-[#FF5C5C]">{trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.losses}</td>
                       <td className={"text-right px-1 font-mono "+(trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.total_net_pnl>=0?"text-[#00E676]":"text-[#FF5C5C]")}>{Math.round(trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.total_net_pnl).toLocaleString()}</td>
                       <td className="text-right px-1 font-mono text-[#94A3B8]">{trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.profit_factor!=null?trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.profit_factor.toFixed(3):"—"}</td>
                       <td className="text-right px-1 font-mono text-[#94A3B8]">{(trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.avg_net_return_pct??0).toFixed(3)}%</td>
                       <td className="text-right px-1 text-[#FF5C5C]">{trdData.metrics.progressive_tp_sl_high_slippage_sensitivity.n_tp_then_sl}</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
             {/* Exit reasons + target milestones (progressive only) */}
             {trdData.metrics?.progressive_tp_sl&&(
               <div className="grid grid-cols-2 gap-2 text-[8px]">
                 <div className="rounded border border-white/[0.06] p-1.5">
                   <div className="text-[#64748B] uppercase text-[7px] mb-0.5">Exit reasons (progressive)</div>
                   <div className="font-mono text-[#94A3B8]">{Object.entries(trdData.metrics.progressive_tp_sl.exit_reason_counts).map(([k,v]:[string,any])=>`${k}=${v}`).join(" · ")}</div>
                 </div>
                 <div className="rounded border border-white/[0.06] p-1.5">
                   <div className="text-[#64748B] uppercase text-[7px] mb-0.5">Target milestones (progressive)</div>
                   <div className="font-mono text-[#94A3B8]">TP1={trdData.metrics.progressive_tp_sl.target_reached_counts.TP1} · TP2={trdData.metrics.progressive_tp_sl.target_reached_counts.TP2} · TP3={trdData.metrics.progressive_tp_sl.target_reached_counts.TP3}</div>
                 </div>
               </div>
             )}
             <div className="text-[8px] text-[#64748B]">
               Negative forecasts not traded (long-only): {trdData.metrics?.fixed_horizon?.n_negative_forecasts_not_traded ?? "—"}. Portfolio-level metrics (ROI/Sharpe/Sortino/maxDD) UNAVAILABLE — no portfolio capital-allocation model. Net P&L based on realized exit prices + {trdData.cost_profile_primary?.id ?? "standard_psx"} costs. {trdData.slippage_discrepancy_note ?? ""}
             </div>
           </div>
          )}
          {trdData&&trdData.available===false&&(
           <div className="mt-1 text-[#FBBF24] text-[9px]">{trdData.note||"Trading artifact not available."}</div>
          )}
         </details>

         {/* Task 60: Trading Robustness (per-model/horizon + date-block bootstrap CIs) */}
         <details className="text-[10px] text-[#94A3B8]" onToggle={(e)=>{const o=(e.target as HTMLDetailsElement).open; if(o) loadRob();}}>
          <summary className="cursor-pointer text-[#FBBF24] font-semibold">
            Trading Robustness (Task 60) — per-model/horizon breakdown, date-block bootstrap 95% CIs, cost reconciliation
          </summary>
          {robLoading&&<div className="mt-1 text-[#94A3B8]">Loading trading-robustness artifact…</div>}
          {robError&&<div className="mt-1 text-[#FF5C5C]">{robError}</div>}
          {robData&&robData.available===true&&(
           <div className="mt-1 space-y-2">
             <div className="rounded-md border border-[#FBBF24]/20 bg-[#FBBF24]/[0.04] p-2 text-[9px]">
               <div className="text-[#FBBF24] font-semibold mb-0.5">Date-block bootstrap uncertainty — {robData.n_unique_decision_date_clusters} decision-date clusters, 1000 reps, deterministic</div>
               <div className="text-[#94A3B8]">{robData.n_executed_trades} executed trades (ledger: {robData.n_ledger_entries} entries). Cost reconciliation: {robData.cost_reconciliation?.ok} ok / {robData.cost_reconciliation?.fail} fail. Negative forecasts not traded: {robData.n_negative_forecasts_not_traded} (long-only).</div>
             </div>
             {/* Strategy × cost-profile summary with CIs */}
             <div className="overflow-x-auto">
               <table className="w-full text-[9px] border-collapse">
                 <thead className="bg-[#0A0E1A]">
                   <tr className="text-[#64748B] border-b border-white/[0.06]">
                     <th className="text-left py-1 pr-2 font-medium">Strategy / Cost</th>
                     <th className="text-right py-1 px-1 font-medium">Trades</th>
                     <th className="text-right py-1 px-1 font-medium">Net P&L</th>
                     <th className="text-right py-1 px-1 font-medium">PF</th>
                     <th className="text-right py-1 px-1 font-medium">Avg Net %</th>
                     <th className="text-right py-1 px-1 font-medium">95% CI (net %)</th>
                     <th className="text-right py-1 px-1 font-medium">Sig?</th>
                   </tr>
                 </thead>
                 <tbody>
                   {robData.breakdown&&Object.entries(robData.breakdown).filter(([k]:[string,any])=>!k.endsWith("__per_model_horizon")).map(([k,c]:[string,any])=>{
                     const parts=k.split("__");
                     const ci=robData.bootstrap?.[k]?.avg_net_return_pct_ci;
                     const sig=ci?(ci.ci_low>0?"✓ sig>0":ci.ci_high<0?"✗ sig<0":"~ ns"):"?";
                     return (
                       <tr key={k} className="border-b border-white/[0.04]">
                         <td className="py-0.5 pr-2 font-mono text-[#F4F7FB]">{parts[0]} / {parts[1]}</td>
                         <td className="text-right px-1 text-[#94A3B8]">{c.executed}</td>
                         <td className={"text-right px-1 font-mono "+(c.total_net_pnl>=0?"text-[#00E676]":"text-[#FF5C5C]")}>{Math.round(c.total_net_pnl).toLocaleString()}</td>
                         <td className="text-right px-1 font-mono text-[#94A3B8]">{c.profit_factor!=null?c.profit_factor.toFixed(3):"—"}</td>
                         <td className="text-right px-1 font-mono text-[#94A3B8]">{(c.avg_net_return_pct??0).toFixed(3)}%</td>
                         <td className="text-right px-1 font-mono text-[#64748B]">{ci?`[${ci.ci_low.toFixed(3)}, ${ci.ci_high.toFixed(3)}]`:"—"}</td>
                         <td className={"text-right px-1 "+(sig.includes("✓")?"text-[#00E676]":sig.includes("✗")?"text-[#FF5C5C]":"text-[#64748B]")}>{sig}</td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
             <div className="text-[8px] text-[#64748B]">
               "ns" = not significant (CI includes 0). All 4 combos include 0 → no strategy has statistically significant positive net return. Date-block bootstrap preserves same-date market dependence (NOT naive iid). Paired diffs + per-model/horizon detail in the artifact JSON.
             </div>
             {/* Selection-bias warnings */}
             <div className="rounded border border-[#FF5C5C]/20 bg-[#FF5C5C]/[0.04] p-1.5 text-[8px] text-[#94A3B8]">
               <div className="text-[#FF5C5C] font-semibold mb-0.5">Selection-bias warnings:</div>
               <ul className="ml-3 space-y-0.5 list-disc">
                 {(robData.selection_bias_warnings||[]).slice(0,3).map((w:string,i:number)=><li key={i}>{w}</li>)}
               </ul>
             </div>
             <div className="text-[8px] text-[#64748B]">
               Portfolio metrics (ROI/Sharpe/Sortino/maxDD) UNAVAILABLE — {robData.unsupported_metrics?.portfolio_roi ?? "no portfolio model"}. Trade ledger: data/backtest_reports/walk_forward_trading_ledger.json ({robData.n_ledger_entries} entries).
             </div>
           </div>
          )}
          {robData&&robData.available===false&&(
           <div className="mt-1 text-[#FBBF24] text-[9px]">{robData.note||"Trading-robustness artifact not available."}</div>
          )}
         </details>

         {/* Task 61: Portfolio Simulation (genuine cash/position/equity-curve metrics) */}
         <details className="text-[10px] text-[#94A3B8]" onToggle={(e)=>{const o=(e.target as HTMLDetailsElement).open; if(o) loadPrt();}}>
          <summary className="cursor-pointer text-[#00E676] font-semibold">
            Portfolio Simulation (Task 61) — genuine cash accounting, position sizing, daily equity curve, Sharpe/Sortino/maxDD
          </summary>
          {prtLoading&&<div className="mt-1 text-[#94A3B8]">Loading portfolio artifact…</div>}
          {prtError&&<div className="mt-1 text-[#FF5C5C]">{prtError}</div>}
          {prtData&&prtData.available===true&&(
           <div className="mt-1 space-y-2">
             <div className="rounded-md border border-[#00E676]/20 bg-[#00E676]/[0.04] p-2 text-[9px]">
               <div className="text-[#00E676] font-semibold mb-0.5">Genuine portfolio simulation — cash, concurrent positions, capital constraints, daily mark-to-market</div>
               <div className="text-[#94A3B8]">Initial capital: PKR {(prtData.config?.initial_capital ?? 0).toLocaleString()}. Max {prtData.config?.max_concurrent_positions} positions, max {(prtData.config?.max_position_size_fraction*100)}%/position, no leverage. Long-only. Historical simulation, NOT live brokerage. {prtData.config_note ?? ""}</div>
             </div>
             {/* Per-portfolio results table */}
             <div className="overflow-x-auto max-h-80 overflow-y-auto">
               <table className="w-full text-[9px] border-collapse">
                 <thead className="sticky top-0 bg-[#0A0E1A]">
                   <tr className="text-[#64748B] border-b border-white/[0.06]">
                     <th className="text-left py-1 pr-2 font-medium">Model</th>
                     <th className="text-left py-1 px-1 font-medium">Strategy</th>
                     <th className="text-right py-1 px-1 font-medium">Trades</th>
                     <th className="text-right py-1 px-1 font-medium">Final Equity</th>
                     <th className="text-right py-1 px-1 font-medium">Return %</th>
                     <th className="text-right py-1 px-1 font-medium">Sharpe</th>
                     <th className="text-right py-1 px-1 font-medium">Max DD %</th>
                     <th className="text-right py-1 px-1 font-medium">Costs</th>
                   </tr>
                 </thead>
                 <tbody>
                   {Array.isArray(prtData.portfolios)&&prtData.portfolios.map((p:any,i:number)=>(
                     <tr key={i} className="border-b border-white/[0.04]">
                       <td className="py-0.5 pr-2 font-mono text-[#F4F7FB]">{p.model}</td>
                       <td className="py-0.5 px-1 text-[#94A3B8]">{p.strategy==="fixed_horizon"?"Fixed":"Prog TP/SL"}</td>
                       <td className="text-right px-1 text-[#94A3B8]">{p.n_completed_positions}+{p.n_open_at_end}o</td>
                       <td className="text-right px-1 font-mono text-[#F4F7FB]">{Math.round(p.final_equity).toLocaleString()}</td>
                       <td className={"text-right px-1 font-mono "+(p.total_return_pct>=0?"text-[#00E676]":"text-[#FF5C5C]")}>{p.total_return_pct.toFixed(3)}%</td>
                       <td className="text-right px-1 font-mono text-[#94A3B8]">{p.sharpe!=null?p.sharpe.toFixed(3):"—"}</td>
                       <td className="text-right px-1 font-mono text-[#FF5C5C]">{p.max_drawdown_pct!=null?(p.max_drawdown_pct*100).toFixed(1)+"%":"—"}</td>
                       <td className="text-right px-1 font-mono text-[#64748B]">{Math.round(p.total_costs).toLocaleString()}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             <div className="text-[8px] text-[#64748B]">
               {prtData.exploratory_warning ?? "EXPLORATORY final-test analysis."} Each combo is a SEPARATE portfolio — P&L is NOT aggregated. Portfolio metrics (Sharpe/Sortino/maxDD) from the daily mark-to-market equity curve, NOT from trade returns. {prtData.unsupported_in_this_run ?? ""}
             </div>
           </div>
          )}
          {prtData&&prtData.available===false&&(
           <div className="mt-1 text-[#FBBF24] text-[9px]">{prtData.note||"Portfolio artifact not available."}</div>
          )}
         </details>

         {/* Task 66: Prospective Paper Trading */}
         <details className="text-[10px] text-[#94A3B8]" onToggle={(e)=>{const o=(e.target as HTMLDetailsElement).open; if(o) loadPst();}}>
          <summary className="cursor-pointer text-[#FBBF24] font-semibold">
            Prospective Paper Trading (Task 66) — genuinely prospective, NOT historical backtest
          </summary>
          {pstLoading&&<div className="mt-1 text-[#94A3B8]">Loading prospective artifact…</div>}
          {pstError&&<div className="mt-1 text-[#FF5C5C]">{pstError}</div>}
          {pstData&&pstData.available===true&&(
           <div className="mt-1 space-y-2">
             <div className={"rounded-md border p-2 text-[9px] "+(pstData.status==="BLOCKED"?"border-[#FF5C5C]/20 bg-[#FF5C5C]/[0.04]":"border-[#00E676]/20 bg-[#00E676]/[0.04]")}>
               <div className={"font-semibold mb-0.5 "+(pstData.status==="BLOCKED"?"text-[#FF5C5C]":"text-[#00E676]")}>
                 Status: {pstData.status}{pstData.block_reason ? " — " + pstData.block_reason.slice(0, 100) + "..." : ""}
               </div>
               <div className="text-[#94A3B8]">Latest market data: {pstData.latest_verified_market_data_date}. Fresh: {String(pstData.data_freshness?.fresh)}. Days stale: {pstData.data_freshness?.daysStale}.</div>
               <div className="text-[#94A3B8]">Inference available: {String(pstData.inference_availability?.available)}. Predictions: {pstData.prediction_counts?.total ?? 0} total, {pstData.prediction_counts?.pending ?? 0} pending, {pstData.prediction_counts?.matured ?? 0} matured.</div>
             </div>
             {pstData.paper_trading_policy&&(
               <div className="rounded border border-white/[0.06] p-1.5 text-[8px] text-[#94A3B8]">
                 <div className="text-[#64748B] uppercase text-[7px] mb-0.5">Paper-trading policy (predeclared, not tuned on final-test)</div>
                 {pstData.paper_trading_policy.direction} · {pstData.paper_trading_policy.strategy} · {pstData.paper_trading_policy.horizon}d · +{(pstData.paper_trading_policy.signal_threshold*100)}% threshold · {pstData.paper_trading_policy.cost_profile} · PKR {pstData.paper_trading_policy.initial_capital?.toLocaleString()} · max {pstData.paper_trading_policy.max_concurrent_positions} positions
               </div>
             )}
             {pstData.honest_disclosure&&(pstData.honest_disclosure as string[]).slice(0,3).map((h,i)=>(
               <div key={i} className="text-[8px] text-[#64748B]">• {h}</div>
             ))}
             <div className="text-[8px] text-[#64748B]">Daily workflow: {pstData.daily_workflow_commands?.step1_update_data} → {pstData.daily_workflow_commands?.step2_generate_predictions} → {pstData.daily_workflow_commands?.step4_run_paper_trading}</div>
           </div>
          )}
          {pstData&&pstData.available===false&&(
           <div className="mt-1 text-[#FBBF24] text-[9px]">{pstData.note||"Prospective artifact not available."}</div>
          )}
         </details>

         {/* Limitations */}
         {Array.isArray(wfData.limitations)&&wfData.limitations.length>0&&(
          <details className="text-[10px] text-[#94A3B8]">
           <summary className="cursor-pointer text-[#22D3EE] font-semibold">Limitations ({wfData.limitations.length})</summary>
           <ul className="mt-1 ml-4 space-y-0.5 list-disc">
            {wfData.limitations.map((l:string,i:number)=><li key={i}>{l}</li>)}
           </ul>
          </details>
         )}

         {/* Honest separator between ML walk-forward and the technical-rule sections below */}
         <div className="text-[10px] text-[#64748B] italic mt-2 pt-2 border-t border-white/[0.04]">
          The sections below (Ensemble Backtesting + Individual Model Backtesting) are a <span className="text-[#FBBF24]">technical-rule-strategy evaluation</span> — NOT a trained-ML walk-forward. Do not compare the two directly.
         </div>
        </div>
       )}

       {/* Loading skeleton */}
       {wfLoading&&!wfData&&(
        <div className="space-y-2">
         <Skeleton className="h-4 w-2/3 bg-[#22D3EE]/20"/>
         <Skeleton className="h-3 w-full bg-[#22D3EE]/10"/>
         <Skeleton className="h-3 w-full bg-[#22D3EE]/10"/>
        </div>
       )}
      </div>


      {/* Ensemble Backtesting Section */}
      <div>
       <h3 className="text-sm font-semibold text-[#00E676] mb-2">Ensemble Backtesting</h3>
       <div className="space-y-2">
        {ensBt.map(m=>(
         <div key={m.name} className="rounded-lg bg-[#0A0E1A] border border-[#00E676]/20 p-3">
          <div className="flex items-center justify-between mb-2">
           <span className="text-sm font-semibold text-[#00E676]">{m.name.replace(/_/g," ")}</span>
           <span className="text-[#FBBF24] text-sm">{"★".repeat(m.stars||0)}<span className="text-[#64748B]">{"★".repeat(5-(m.stars||0))}</span></span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
           <div><div className="text-[10px] uppercase text-[#64748B]">Win Rate</div><div className="font-mono font-bold text-[#00E676]">{m.winRate}%</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Avg Return</div><div className="font-mono text-[#F4F7FB]">{m.avgReturnPct}%</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Best Trade</div><div className="font-mono text-[#00E676]">{m.maxReturnPct}%</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Worst Trade</div><div className="font-mono text-[#FF5C5C]">{m.minReturnPct}%</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Total Trades</div><div className="font-mono text-[#F4F7FB]">{m.totalTrades}</div></div>
           {typeof m.winTrades==="number"&&<div><div className="text-[10px] uppercase text-[#64748B]">Win Trades</div><div className="font-mono font-bold text-[#00E676]">{m.winTrades}</div></div>}
           {typeof m.lossTrades==="number"&&<div><div className="text-[10px] uppercase text-[#64748B]">Loss Trades</div><div className="font-mono font-bold text-[#FF5C5C]">{m.lossTrades}</div></div>}
           {typeof m.profitFactor==="number"&&<div><div className="text-[10px] uppercase text-[#64748B]">Profit Factor</div><div className={`font-mono font-bold ${m.profitFactor>=1.3?"text-[#00E676]":m.profitFactor>=1.0?"text-[#FBBF24]":"text-[#FF5C5C]"}`}>{m.profitFactor.toFixed(2)}</div></div>}
           {typeof m.sharpe==="number"&&<div><div className="text-[10px] uppercase text-[#64748B]">Sharpe</div><div className="font-mono text-[#94A3B8]">{m.sharpe.toFixed(2)}</div></div>}
           {typeof m.sortino==="number"&&<div><div className="text-[10px] uppercase text-[#64748B]">Sortino</div><div className="font-mono text-[#94A3B8]">{m.sortino.toFixed(2)}</div></div>}
           {typeof m.maxDrawdownPct==="number"&&<div><div className="text-[10px] uppercase text-[#64748B]">Max Drawdown</div><div className="font-mono text-[#FF5C5C]">{m.maxDrawdownPct}%</div></div>}
           {typeof m.tp1HitRate==="number"&&<div><div className="text-[10px] uppercase text-[#64748B]">TP1 Hit Rate</div><div className="font-mono text-[#00E676]">{(m.tp1HitRate*100).toFixed(1)}%</div></div>}
           {typeof m.costBps==="number"&&<div><div className="text-[10px] uppercase text-[#64748B]">Cost (bps)</div><div className="font-mono text-[#94A3B8]">{m.costBps}</div></div>}
          </div>
          {m.reliabilityTable&&m.reliabilityTable.length>0&&(
           <div className="mt-2 pt-2 border-t border-white/[0.04]">
            <div className="text-[10px] uppercase text-[#64748B] mb-1">Reliability Table (predicted vs actual hit rate)</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-1 text-[10px]">
             {m.reliabilityTable.map((r:any)=>{
              // CL-2 / PI use "predicted_prob"; GM uses "avg_score". Handle both.
              const predLabel = r.predicted_prob!=null?"pred":(r.avg_score!=null?"score":"pred");
              const predVal = typeof r.predicted_prob==="number"?r.predicted_prob:(typeof r.avg_score==="number"?r.avg_score:0);
              const actVal = typeof r.actual_hit_rate==="number"?r.actual_hit_rate:0;
              return (
               <div key={r.bin} className="rounded bg-[#0A0E1A] border border-white/[0.06] px-1.5 py-1">
                <div className="text-[#64748B] text-[9px]">bin{r.bin}·n={r.count}</div>
                <div className="font-mono text-[#94A3B8]">{predLabel} {predVal.toFixed(2)}</div>
                <div className="font-mono text-[#F4F7FB]">act {actVal.toFixed(2)}</div>
               </div>
              );
             })}
            </div>
           </div>
          )}
         </div>
        ))}
        {ensBt.length===0&&<p className="text-xs text-[#64748B] text-center py-4">No ensemble backtesting data.</p>}
       </div>
      </div>

      {/* Individual Model Backtesting Section */}
      <div>
       <h3 className="text-sm font-semibold text-[#00E676] mb-2">Individual Model Backtesting</h3>
       <div className="space-y-2">
        {indBt.map(m=>(
         <div key={m.name} className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between mb-2">
           <span className="text-sm font-semibold text-[#F4F7FB]">{m.name}</span>
           <span className="text-[#FBBF24] text-sm">{"★".repeat(m.stars||0)}<span className="text-[#64748B]">{"★".repeat(5-(m.stars||0))}</span></span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
           <div><div className="text-[10px] uppercase text-[#64748B]">Win Rate</div><div className="font-mono font-bold text-[#00E676]">{m.winRate}%</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Avg Return</div><div className="font-mono text-[#F4F7FB]">{m.avgReturnPct}%</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Best Trade</div><div className="font-mono text-[#00E676]">{m.maxReturnPct}%</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Worst Trade</div><div className="font-mono text-[#FF5C5C]">{m.minReturnPct}%</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Total Trades</div><div className="font-mono text-[#F4F7FB]">{m.totalTrades}</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Buy Signals</div><div className="font-mono text-[#00E676]">{m.buySignals}</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Correct Buys</div><div className="font-mono text-[#F4F7FB]">{m.correctBuys}</div></div>
           <div><div className="text-[10px] uppercase text-[#64748B]">Sell Signals</div><div className="font-mono text-[#FF5C5C]">{m.sellSignals}</div></div>
          </div>
         </div>
        ))}
        {indBt.length===0&&<p className="text-xs text-[#64748B] text-center py-4">No individual backtesting data.</p>}
       </div>
      </div>

      {/* Phase 3: freshness chip — is the backtest up to date? */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] text-[#64748B]">
       <Badge variant="outline" className={`h-4 py-0 ${data?.backtestSource==="db-extended-universe"?"border-[#00E676]/40 text-[#00E676]":"border-[#FBBF24]/40 text-[#FBBF24]"}`} title="Backtest was recomputed over the full extended universe (original ML-trained + fallback-covered stocks)">{data?.backtestSource==="db-extended-universe"?"FRESH · full-universe":"FILE · subset"}</Badge>
       <span>{data?.backtestSource==="db-extended-universe"?"Backtest freshly recomputed across all DB stocks (ModelBacktestCache populated).":"Backtest from the file subset — run the precompute for full-universe coverage."}</span>
      </div>

      {/* Task 72: Genuine Trained-ML Out-of-Sample Actual vs Predicted Graph */}
      <div className="rounded-lg bg-[#0A0E1A] border border-[#22D3EE]/20 p-3 mb-3">
       <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h3 className="text-sm font-semibold text-[#22D3EE] flex items-center gap-1.5"><TrendingUp className="h-4 w-4"/>Actual vs Predicted — Graph Mode</h3>
        <button onClick={()=>setMlGraphMode("ml")} className={`px-2 py-1 rounded text-[10px] font-mono ${mlGraphMode==="ml"?"bg-[#22D3EE]/15 text-[#22D3EE]":"text-[#64748B]"}`}>Trained-ML (OOS)</button>
        <button onClick={()=>setMlGraphMode("rule")} className={`px-2 py-1 rounded text-[10px] font-mono ${mlGraphMode==="rule"?"bg-[#FBBF24]/15 text-[#FBBF24]":"text-[#64748B]"}`}>Rule-Based Preview</button>
       </div>
       {mlGraphMode==="ml"&&(
        <div>
         <p className="text-[10px] text-[#94A3B8] mb-2">Genuine historical out-of-sample trained-ML predictions from the pilot25 walk-forward evaluation. predictedPrice = decisionClose × (1 + predictedForwardReturn). Target = decision_date + horizon trading sessions (from OHLCV DB, NOT calendar days). <span className="text-[#FBBF24]">NOT live forecasts. NOT prospective. NOT strategySignal.</span></p>
         <div className="flex items-center gap-2 mb-2 flex-wrap">
          <select value={mlGraphModel} onChange={e=>setMlGraphModel(e.target.value)} className="bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-1 text-[#F4F7FB] text-xs">
           {ML_GRAPH_MODELS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <select value={mlGraphHorizon} onChange={e=>setMlGraphHorizon(e.target.value)} className="bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-1 text-[#F4F7FB] text-xs">
            <option value="5">5 sessions</option><option value="10">10 sessions</option><option value="21">21 sessions</option>
          </select>
          <select value={mlGraphPeriod} onChange={e=>setMlGraphPeriod(e.target.value as any)} className="bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-1 text-[#F4F7FB] text-xs">
            <option value="final-test">Final-Test</option><option value="validation">Validation</option>
          </select>
          <Button size="sm" variant="outline" onClick={async()=>{
            const sym=(graphSymbol||data?.symbol||"LUCK").trim().toUpperCase();
            setMlGraphLoading(true);
            try{
              const r=await fetch(`/api/backtest/model-graph/ml?symbol=${encodeURIComponent(sym)}&model=${encodeURIComponent(mlGraphModel)}&horizon=${encodeURIComponent(mlGraphHorizon)}&period=${encodeURIComponent(mlGraphPeriod)}`);
              const d=await r.json();
              if(!d.available){toast.error(d.error||"No ML graph data");setMlGraphData(null);}
              else setMlGraphData(d);
            }catch(e:any){toast.error(e?.message||"Failed");setMlGraphData(null);}
            finally{setMlGraphLoading(false);}
          }} disabled={mlGraphLoading} className="border-[#22D3EE]/30 text-[#22D3EE] hover:bg-[#22D3EE]/10 h-7 text-[11px]">
            {mlGraphLoading?"Loading…":"Generate ML Graph"}
          </Button>
         </div>
         {mlGraphData&&mlGraphData.available&&(
          <div>
           <div className="text-[10px] text-[#64748B] mb-2">
             Source: {mlGraphData.source_run_id} · {mlGraphData.n_points} valid points · {mlGraphData.n_omitted} omitted · {mlGraphData.model} {mlGraphData.horizon}d · {mlGraphData.period}
           </div>
           {/* Task 73: Visual line chart using Recharts */}
           {(() => {
             const mlChartData = mlGraphData.points.map((p:any)=>({
               date: p.target_date||p.decision_date,
               actual: p.actual_price,
               predicted: p.predicted_price,
               decisionDate: p.decision_date,
               decisionClose: p.decision_close,
               error: p.predicted_price - p.actual_price,
               verification: p.verification,
             }));
             return (
              <ResponsiveContainer width="100%" height={250} className="mb-2">
                <LineChart data={mlChartData} margin={{top:8,right:16,left:0,bottom:8}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                  <XAxis dataKey="date" tick={{fontSize:9,fill:"#64748B"}} angle={-25} textAnchor="end" height={50} />
                  <YAxis tick={{fontSize:9,fill:"#64748B"}} />
                  <Tooltip content={({active,payload}:any)=>active&&payload?.length?(
                    <div className="bg-[#0A0E1A] border border-white/20 rounded p-2 text-[10px]">
                      <div className="text-[#64748B]">Target: {payload[0]?.payload?.date}</div>
                      <div className="text-[#64748B]">Decision: {payload[0]?.payload?.decisionDate}</div>
                      <div className="text-[#64748B]">Close: {payload[0]?.payload?.decisionClose?.toFixed(2)}</div>
                      <div className="text-[#00E676] font-mono">Actual: {payload[0]?.payload?.actual?.toFixed(2)} PKR</div>
                      <div className="text-[#22D3EE] font-mono">Predicted: {payload[0]?.payload?.predicted?.toFixed(2)} PKR</div>
                      <div className="text-[#FBBF24]">Error: {payload[0]?.payload?.error?.toFixed(2)}</div>
                      <div className="text-[#64748B]">Verified: {payload[0]?.payload?.verification}</div>
                    </div>
                  ):null} />
                  <Legend wrapperStyle={{fontSize:"10px"}} />
                  <Line type="monotone" dataKey="actual" stroke="#00E676" name="Actual Target Price" dot={{r:3,fill:"#00E676"}} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" stroke="#22D3EE" name="Predicted Target Price" dot={{r:3,fill:"#22D3EE"}} strokeWidth={2} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
             );
           })()}
           {/* Table view (below chart) */}
           <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-[9px] border-collapse">
             <thead className="sticky top-0 bg-[#0A0E1A]">
              <tr className="text-[#64748B] border-b border-white/[0.06]">
               <th className="text-left py-1 px-2">Decision Date</th>
               <th className="text-left py-1 px-1">Target Date</th>
               <th className="text-right py-1 px-1">Decision Close</th>
               <th className="text-right py-1 px-1">Predicted Price</th>
               <th className="text-right py-1 px-1">Actual Price</th>
               <th className="text-right py-1 px-1">Error</th>
               <th className="text-center py-1 px-1">Verified</th>
              </tr>
             </thead>
             <tbody>
              {mlGraphData.points.map((p:any,i:number)=>(
               <tr key={i} className="border-b border-white/[0.04]">
                <td className="py-0.5 px-2 font-mono text-[#94A3B8]">{p.decision_date}</td>
                <td className="py-0.5 px-1 font-mono text-[#64748B]">{p.target_date||"—"}</td>
                <td className="text-right px-1 font-mono text-[#94A3B8]">{p.decision_close.toFixed(2)}</td>
                <td className="text-right px-1 font-mono text-[#22D3EE]">{p.predicted_price.toFixed(2)}</td>
                <td className="text-right px-1 font-mono text-[#00E676]">{p.actual_price.toFixed(2)}</td>
                <td className={"text-right px-1 font-mono "+(p.predicted_price>p.actual_price?"text-[#FF5C5C]":"text-[#00E676]")}>{(p.predicted_price-p.actual_price).toFixed(2)}</td>
                <td className="text-center px-1 text-[8px]">{p.verification==="verified"?"✓":p.verification==="mismatch"?"✗":"?"}</td>
               </tr>
              ))}
             </tbody>
            </table>
           </div>
           <div className="text-[8px] text-[#64748B] mt-1">{mlGraphData.methodology}</div>
          </div>
         )}
         {mlGraphData&&!mlGraphData.available&&<div className="text-[#FBBF24] text-[10px]">{mlGraphData.error||"No data available"}</div>}
         {!mlGraphData&&!mlGraphLoading&&<div className="text-[#64748B] text-[10px]">Select model/horizon/period + click Generate</div>}
        </div>
       )}
      </div>

      {/* Phase 3: per-model Actual vs Predicted graph view (enhanced) */}
      <div>
       <h3 className="text-sm font-semibold text-[#00E676] mb-2 flex items-center gap-1.5"><TrendingUp className="h-4 w-4"/>Model Graph View — Actual vs Predicted</h3>
       <p className="text-[10px] text-[#94A3B8] mb-2">At each decision point (every <span className="text-[#F4F7FB]">{graphStep}</span> bars), each selected model&apos;s predicted target price (entry × (1+predictedReturn)) vs the actual realized close {graphHorizon} bars later. Only actionable (BUY/SELL) points are plotted.</p>
       <div className="flex gap-2 flex-wrap items-end mb-3">
        <div className="min-w-[200px] flex-1">
         <label className="text-[10px] uppercase text-[#64748B] block mb-1">Symbol {graphUniverse==="kse100"&&kse100Syms.length>0?`· KSE-100 only (${kse100Syms.length})`:"· whole market"}</label>
         <div className="bg-[#0A0E1A] border border-white/[0.12] rounded"><StockSearch value={graphSymbol} onChange={(s)=>setGraphSymbol(s)} placeholder={data?.symbol||"LUCK"} showSuggestions={true} allowedSymbols={graphUniverse==="kse100"&&kse100Syms.length>0?kse100Syms:undefined} /></div>
        </div>
        <div>
         <label className="text-[10px] uppercase text-[#64748B] block mb-1">Universe</label>
         <div className="flex bg-[#0A0E1A] border border-white/[0.12] rounded p-0.5">
          <button onClick={()=>setGraphUniverse("all")} className={`px-2 py-1.5 rounded text-[10px] font-mono font-semibold ${graphUniverse==="all"?"bg-[#00E676]/15 text-[#00E676]":"text-[#64748B] hover:text-[#F4F7FB]"}`}>All stocks</button>
          <button onClick={()=>setGraphUniverse("kse100")} className={`px-2 py-1.5 rounded text-[10px] font-mono font-semibold ${graphUniverse==="kse100"?"bg-[#00E676]/15 text-[#00E676]":"text-[#64748B] hover:text-[#F4F7FB]"}`}>KSE-100 only</button>
         </div>
        </div>
        <div><label className="text-[10px] uppercase text-[#64748B] block mb-1">Decision pts (bars)</label>
         <input type="number" value={graphStep} onChange={e=>setGraphStep(e.target.value)} min="2" max="252" className="bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-2 text-[#F4F7FB] font-mono text-xs w-[110px]" />
        </div>
        <div><label className="text-[10px] uppercase text-[#64748B] block mb-1">Horizon (bars)</label>
         <input type="number" value={graphHorizon} onChange={e=>setGraphHorizon(e.target.value)} min="3" max="63" className="bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-2 text-[#F4F7FB] font-mono text-xs w-[90px]" />
        </div>
        <Button size="sm" onClick={loadGraph} disabled={graphLoading} className="bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold">
         {graphLoading?<Loader2 className="h-4 w-4 mr-1 animate-spin"/>:<Play className="h-4 w-4 mr-1"/>}Load graph
        </Button>
       </div>
       {/* Multi-model checkboxes (All / None) */}
       <div className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-2 mb-3">
        <div className="flex items-center justify-between mb-1.5">
         <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Models ({graphModels.length} selected)</span>
         <div className="flex gap-1">
          <button onClick={()=>setGraphModels([...GRAPH_MODEL_OPTIONS])} className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#00E676]/10 text-[#00E676] hover:bg-[#00E676]/20">All</button>
          <button onClick={()=>setGraphModels([])} className="px-2 py-0.5 rounded text-[9px] font-mono bg-white/[0.04] text-[#64748B] hover:bg-white/[0.08]">None</button>
         </div>
        </div>
        <div className="max-h-32 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-1 pr-1">
         {GRAPH_MODEL_OPTIONS.map((k,mi)=>{
          const on=graphModels.includes(k);
          const color=GRAPH_COLORS[mi%8];
          return <label key={k} className={`flex items-center gap-1.5 text-[10px] font-mono px-1.5 py-1 rounded cursor-pointer hover:bg-white/[0.04] ${on?"text-[#F4F7FB]":"text-[#64748B]"}`}>
           <input type="checkbox" checked={on} onChange={()=>toggleModel(k)} className="h-2.5 w-2.5 accent-[#00E676]" />
           <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{background:on?color:"rgba(255,255,255,0.15)"}} />
           <span className="truncate">{k.replace(/_/g," ")}</span>
          </label>;
         })}
        </div>
       </div>
       {graphMeta&&<div className="text-[10px] text-[#64748B] mb-2">{graphModels.join(", ")} on {graphSymbol||data?.symbol||"LUCK"} · {graphMeta.points} decision points · data through {graphMeta.dataSourceDate||"—"}</div>}
       {graphChart&&graphChart.dates.length>0&&(()=>{
        const chartData=graphChart.dates.map((d,i)=>{const row:any={date:d,Actual:graphChart.actual[i]};for(const m of graphChart.models)row[m.label]=m.predicted[i];return row;});
        return (
        <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3" style={{height:360}}>
         <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{top:8,right:16,left:0,bottom:8}}>
           <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
           <XAxis dataKey="date" tick={{fill:"#64748B",fontSize:9}} tickFormatter={(d:string)=>String(d).slice(5)} angle={-20} textAnchor="end" height={50}/>
           <YAxis tick={{fill:"#64748B",fontSize:10}} domain={["auto","auto"]} width={48}/>
           <Tooltip contentStyle={{background:"#0A0E1A",border:"1px solid rgba(0,230,118,0.3)",borderRadius:6,fontSize:11}} labelStyle={{color:"#94A3B8"}} formatter={(v:number,n:string)=>[`${n}: PKR ${(v as number).toFixed(2)}`,n]}/>
           <Legend wrapperStyle={{fontSize:10}}/>
           <Line type="monotone" dataKey="Actual" name="Actual" stroke="#00E676" strokeWidth={2.5} dot={{r:2}}/>
           {graphChart.models.map((m:any,mi:number)=><Line key={m.key} type="monotone" dataKey={m.label} name={m.label} stroke={GRAPH_COLORS[mi%8]} strokeWidth={1.5} dot={false} connectNulls />)}
          </LineChart>
         </ResponsiveContainer>
        </div>
        );
       })()}
      </div>
     </div>
    </DialogContent>
   </Dialog>
  </>)}
 </main></div>);
}

function MC({m}:{m:MP}){
 const sc=m.signal==="BUY"?"text-[#00E676]":m.signal==="SELL"?"text-[#FF5C5C]":"text-[#94A3B8]";
 const sb=m.signal==="BUY"?"bg-[#00E676]/10 border-[#00E676]/40 text-[#00E676]":m.signal==="SELL"?"bg-[#FF5C5C]/10 border-[#FF5C5C]/40 text-[#FF5C5C]":"bg-white/[0.04] border-white/[0.12] text-[#94A3B8]";
 if(!m.trained)return(<div className="rounded-md bg-[#0A0E1A]/50 border border-white/[0.04] p-2.5 opacity-70">
  <div className="flex items-center gap-1.5 mb-0.5"><span className="text-xs md:text-sm font-semibold text-[#94A3B8]">{m.name}</span><Badge variant="outline" className="text-[9px] py-0 h-3.5 border-white/[0.08] text-[#64748B]">Not trained</Badge></div>
  <div className="text-[10px] text-[#64748B] mt-0.5">{m.category}</div><div className="text-[10px] text-[#64748B] mb-1.5 mt-1">{m.untrainedReason}</div>
  <div className="grid grid-cols-5 gap-1 text-[10px]">{["Predicted","Entry","SL","TP1","TP2"].map(l=><div key={l}><div className="text-[#64748B]">{l}</div><div className="font-mono text-[#64748B]">—</div></div>)}</div></div>);
 return(<div className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-2.5 md:p-3">
  <div className="flex items-start justify-between gap-2 mb-1.5"><div><div className="flex items-center gap-1.5 flex-wrap">
   <span className="text-xs md:text-sm font-semibold text-[#F4F7FB]">{m.name}</span>
   <Badge className={`text-[9px] py-0 h-3.5 md:h-4 border ${sb}`}>{m.signal}</Badge>
   {m.extended&&<Badge variant="outline" className="text-[8px] py-0 h-3.5 border-[#FBBF24]/40 text-[#FBBF24]" title="Extended training — indicator-based engine covering stocks outside the original ML universe">EXT</Badge>}
   {m.trained&&<Badge variant="outline" className="text-[8px] py-0 h-3.5 border-[#22D3EE]/30 text-[#22D3EE]" title="A Python-trained artifact exists in ml_predictions_multi.json for LIVE per-stock predictions. The RUNTIME BACKTEST shown here uses the shared strategySignal() indicator engine — NOT this trained artifact — so the BT stats below are an indicator-strategy evaluation, not a trained-ML evaluation.">ML·live</Badge>}
   {m.backtest&&<span className="text-[9px] text-[#FBBF24]">{"★".repeat(m.backtest.stars)}<span className="text-[#64748B]">{"★".repeat(5-m.backtest.stars)}</span></span>}
  </div><div className="text-[10px] text-[#64748B] mt-0.5">{m.category}</div></div>
  <div className="text-right"><div className="text-[9px] text-[#64748B]">TP3</div><div className={`text-xs md:text-sm font-mono font-bold ${sc}`}>PKR {m.tp3?.toFixed(2)}</div></div></div>
  <div className="grid grid-cols-5 gap-1.5 md:gap-2 text-[10px] mt-1.5 pt-1.5 border-t border-white/[0.06]">
   <div><div className="text-[#64748B] uppercase">Entry</div><div className="font-mono text-[#F4F7FB]">{m.entry?.toFixed(2)}</div></div>
   <div><div className="text-[#64748B] uppercase">SL</div><div className="font-mono text-[#FF5C5C]">{m.sl?.toFixed(2)}</div></div>
   <div><div className="text-[#64748B] uppercase">TP1</div><div className="font-mono text-[#00E676]">{m.tp1?.toFixed(2)}</div></div>
   <div><div className="text-[#64748B] uppercase">TP2</div><div className="font-mono text-[#00E676]">{m.tp2?.toFixed(2)}</div></div>
   <div><div className="text-[#64748B] uppercase">TP3</div><div className="font-mono text-[#00E676]">{m.tp3?.toFixed(2)}</div></div>
  </div>
  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-white/[0.04]">
   <div className="text-[10px] text-[#64748B]">Conf:<span className="font-mono text-[#F4F7FB]">{m.confidence}%</span>{m.avgReturn!==undefined&&<>·Avg:<span className="font-mono text-[#F4F7FB]">{(m.avgReturn*100).toFixed(1)}%</span></>}</div>
   {m.backtest&&<div className="text-[10px] text-[#64748B]" title="The runtime backtest (model-backtest.ts) evaluates this model via the shared strategySignal() indicator engine — these BT stats are a technical-rule-strategy evaluation, NOT a trained-ML artifact evaluation.">Rule-BT:<span className="font-mono text-[#94A3B8]">{(m.backtest.winRate||0).toFixed(2)}%win</span>·<span className="font-mono text-[#94A3B8]">{(m.backtest.avgReturnPct||0).toFixed(2)}%avg</span>·<span className="font-mono text-[#94A3B8]" title="Number of PSX stocks this model was backtested across (the extended universe — original ML-trained + fallback-covered)">{m.backtest.coveredSymbols??0}stk</span></div>}
  </div></div>);
}

function TS({label,v,tone}:{label:string;v:string;tone?:"positive"|"negative"}){
 const c=tone==="positive"?"text-[#00E676]":tone==="negative"?"text-[#FF5C5C]":"text-[#F4F7FB]";
 return<div className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-1.5 md:p-2"><div className="text-[9px] md:text-[10px] uppercase text-[#64748B]">{label}</div><div className={`text-xs md:text-sm font-mono font-bold ${c}`}>{v}</div></div>;
}
