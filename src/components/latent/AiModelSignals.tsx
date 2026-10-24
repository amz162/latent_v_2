"use client";
import{useEffect,useState,useRef}from"react";
import{Card,CardContent,CardHeader,CardTitle}from"@/components/ui/card";
import{Button}from"@/components/ui/button";
import{Badge}from"@/components/ui/badge";
import{Skeleton}from"@/components/ui/skeleton";
import{Dialog,DialogContent,DialogHeader,DialogTitle}from"@/components/ui/dialog";
import{AppNav}from"./AppNav";
import{StockSearch}from"./StockSearch";
import{useLatentStore}from"@/lib/latent/store";
import{Brain,Sparkles,Layers,Cpu,BarChart3,DollarSign,Play,Loader2,Eye,ChevronLeft,TrendingUp,TrendingDown}from"lucide-react";
import{toast}from"sonner";

interface MP{name:string;tier:string;tierLabel:string;category:string;trained:boolean;untrainedReason?:string;direction?:"LONG"|"SHORT";signal?:"BUY"|"SELL"|"HOLD";confidence?:number;currentPrice?:number;entry?:number;sl?:number;tp1?:number;tp2?:number;tp3?:number;avgReturn?:number;raw_prob?:number;exp_win_rate?:number;agreement?:number;metrics?:any;backtest?:{totalTrades:number;buySignals:number;sellSignals:number;correctBuys:number;correctSells:number;winRate:number;avgReturnPct:number;maxReturnPct:number;minReturnPct:number;stars:number;};extended?:boolean;}
interface ER{method:string;methodLabel:string;signal:"BUY"|"SELL"|"HOLD";direction:"LONG"|"SHORT";confidence:number;predictedPrice:number;entry:number;sl:number;tp1:number;tp2:number;tp3:number;modelCount:number;buyCount:number;sellCount:number;holdCount:number;raw_prob?:number;exp_win_rate?:number;agreement?:number;total_score?:number;pillars?:any;expected_return?:number;r_pct?:number;strategy_signals?:any;}
interface FC{signal:"BUY"|"SELL"|"HOLD";direction:"LONG"|"SHORT";confidence:number;agreement:number;predictedPriceRange:{min:number;max:number};entry:number;sl:number;tp1:number;tp2:number;tp3:number;}
interface API{symbol:string;stockName:string;currentPrice:number;tiers:{tier:string;label:string;models:MP[]}[];ensembles:ER[];finalConsensus:FC;trainedModelCount:number;totalModelCount:number;trainedAt:string;cached:boolean;latencyMs:number;backtesting:Record<string,any>;ensembleBacktesting:Record<string,any>;extendedCount?:number;extendedAt?:string|null;backtestSource?:string;}

export function AiModelSignals(){
 const selectedSymbol=useLatentStore(s=>s.selectedSymbol);
 const[symbol,setSymbol]=useState(selectedSymbol||"ENGRO");
 const[data,setData]=useState<API|null>(null);
 const[loading,setLoading]=useState(false);
 const[btOpen,setBtOpen]=useState(false);
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

 return(<div className="min-h-screen bg-[#0A0E1A]"><AppNav/>
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
     <div className="space-y-2">{tg.models.map(m=><MC key={m.name} m={m}/>)}</div>
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
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Prediction Score (target)</label>
        <input type="number" value={simTargetScore} onChange={e=>setSimTargetScore(e.target.value)} placeholder="1" min="1" max="999" className="bg-[#0A0E1A] border border-white/[0.12] rounded px-3 py-2 text-[#F4F7FB] font-mono text-sm w-[100px]" />
       </div>
       <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Win Rate (min %)</label>
        <input type="number" value={simWinRateThreshold} onChange={e=>setSimWinRateThreshold(e.target.value)} placeholder="100" min="0" max="100" className="bg-[#0A0E1A] border border-white/[0.12] rounded px-3 py-2 text-[#F4F7FB] font-mono text-sm w-[100px]" />
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
           <TrendingUp className="h-4 w-4"/>All ensemble models ({[...simData.top5, ...simData.rest].length}) — ranked by {simRankBy === "winRate" ? "win rate" : simRankBy === "netPnl" ? "net P&L" : "prediction score"}
          </h3>
          <div className="space-y-2">
           {(simRankBy === "prediction"
             ? [...simData.top5, ...simData.rest].sort((a:any,b:any) => (predictScores[b.ensembleName]||0) - (predictScores[a.ensembleName]||0))
             : [...simData.top5, ...simData.rest]
           ).map((r:any,idx:number)=>(
            <div key={r.ensembleName} className="rounded-lg bg-[#0A0E1A] border border-[#00E676]/20 p-3">
             <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
               <span className="h-6 w-6 rounded-full bg-[#00E676] text-[#0A0E1A] font-bold text-xs flex items-center justify-center">{idx+1}</span>
               <span className="text-sm font-semibold text-[#00E676]">{r.ensembleLabel}</span>
               {predictScores[r.ensembleName] > 0 && <Badge variant="outline" className="text-[8px] py-0 h-3.5 border-[#00E676]/40 text-[#00E676] bg-[#00E676]/10 ml-1">Score: {predictScores[r.ensembleName]}</Badge>}
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
   {m.backtest&&<div className="text-[10px] text-[#64748B]">BT:<span className="font-mono text-[#94A3B8]">{(m.backtest.winRate||0).toFixed(2)}%win</span>·<span className="font-mono text-[#94A3B8]">{(m.backtest.avgReturnPct||0).toFixed(2)}%avg</span></div>}
  </div></div>);
}

function TS({label,v,tone}:{label:string;v:string;tone?:"positive"|"negative"}){
 const c=tone==="positive"?"text-[#00E676]":tone==="negative"?"text-[#FF5C5C]":"text-[#F4F7FB]";
 return<div className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-1.5 md:p-2"><div className="text-[9px] md:text-[10px] uppercase text-[#64748B]">{label}</div><div className={`text-xs md:text-sm font-mono font-bold ${c}`}>{v}</div></div>;
}
