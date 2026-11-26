/* Chart Ndrean v2 — chart ringan ala TradingView buat HP. Bukan saran keuangan. */
(() => {
"use strict";
const LWC = window.LightweightCharts;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const isTest = /[?&]test=1/.test(location.search);

// ---------------- katalog ----------------
const CRYPTO = "BTC ETH SOL BNB XRP DOGE ADA TRX AVAX LINK TON SUI DOT LTC BCH SHIB NEAR APT UNI ICP PEPE XLM ETC FIL ARB OP ATOM HBAR INJ RENDER SEI TIA WLD FET AAVE JUP ENA ONDO TAO HYPE BONK WIF TRUMP POL".split(" ");
const CAT = {
  crypto: [{h:"Populer"}].concat(CRYPTO.map(b=>({id:"bn:"+b+"USDT"}))),
  forex: [
    {h:"Intraday · Hyperliquid"},
    {id:"hl:xyz:EUR",n:"EUR/USD"},{id:"hl:xyz:GBP",n:"GBP/USD"},{id:"hl:xyz:JPY",n:"USD/JPY"},
    {h:"Harian · kurs ECB"},
    {id:"fx:USD:IDR",n:"USD/IDR"},{id:"fx:EUR:IDR",n:"EUR/IDR"},{id:"fx:AUD:USD",n:"AUD/USD"},{id:"fx:USD:CAD",n:"USD/CAD"},
    {id:"fx:USD:CHF",n:"USD/CHF"},{id:"fx:NZD:USD",n:"NZD/USD"},{id:"fx:USD:SGD",n:"USD/SGD"},{id:"fx:EUR:GBP",n:"EUR/GBP"},
    {id:"fx:EUR:JPY",n:"EUR/JPY"},{id:"fx:GBP:JPY",n:"GBP/JPY"}
  ],
  saham: [
    {h:"Saham AS"},
    ...["AAPL","TSLA","NVDA","MSFT","GOOGL","AMZN","META","NFLX","AMD","AVGO","TSM","COIN","MSTR","PLTR","HOOD","INTC","ORCL","BABA","LLY","COST"].map(s=>({id:"hl:xyz:"+s,n:s})),
    {h:"Indeks"},
    {id:"hl:xyz:SP500",n:"S&P 500"},{id:"hl:xyz:XYZ100",n:"Nasdaq 100"},{id:"hl:xyz:JP225",n:"Nikkei 225"},{id:"hl:xyz:KR200",n:"KOSPI 200"},{id:"hl:xyz:NIFTY",n:"Nifty 50"}
  ],
  komoditas: [
    {h:"Logam"},
    {id:"hl:xyz:GOLD",n:"XAU/USD",d:"Emas"},{id:"hl:xyz:SILVER",n:"XAG/USD",d:"Perak"},{id:"hl:xyz:PLATINUM",n:"Platinum"},{id:"hl:xyz:PALLADIUM",n:"Palladium"},{id:"hl:xyz:COPPER",n:"Tembaga"},
    {id:"bn:PAXGUSDT",n:"PAXG/USDT",d:"Token emas"},
    {h:"Energi"},
    {id:"hl:xyz:CL",n:"Minyak WTI"},{id:"hl:xyz:BRENTOIL",n:"Minyak Brent"},{id:"hl:xyz:NATGAS",n:"Gas alam"}
  ]
};
const CAT_NOTE = {
  crypto: "Data Binance (cadangan OKX). Cari pair USDT apa aja di kolom atas.",
  forex: "EUR/GBP/JPY: harga perp Hyperliquid (jalan 24 jam, bisa beda dikit dari broker). Kurs ECB: cuma harga penutupan harian, hari kerja, bukan real-time.",
  saham: "Harga perp Hyperliquid yang ngikutin saham AS (jalan 24 jam; pas bursa tutup bisa beda dari harga resmi). Saham Indonesia (BBCA, BBRI, TLKM, dll.) belum ada: belum ketemu sumber data gratis yang boleh dibuka langsung dari web ini.",
  komoditas: "Emas/perak/minyak: harga perp Hyperliquid, ngikutin harga spot tapi bisa beda dikit dari broker. PAXG = token emas di Binance."
};
const NAMES = {};
Object.values(CAT).flat().forEach(x=>{ if(x.id) NAMES[x.id]=x; });

const TFS = [
  {k:"1m",l:"1m",okx:"1m",sec:60},{k:"5m",l:"5m",okx:"5m",sec:300},{k:"15m",l:"15m",okx:"15m",sec:900},
  {k:"1h",l:"1j",okx:"1H",sec:3600},{k:"4h",l:"4j",okx:"4H",sec:14400},{k:"1d",l:"1D",okx:"1Dutc",sec:86400},{k:"1w",l:"1W",okx:"1Wutc",sec:604800}
];
const BINANCE = ["https://api.binance.com","https://data-api.binance.vision"];
const HL = "https://api.hyperliquid.xyz/info";
const FX = "https://api.frankfurter.dev/v1";

const store = {
  get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
function migrateSym(){ const v2=store.get("cx.sym2",null); if(v2) return v2; const old=store.get("cx.sym",null); return old? "bn:"+old : "bn:BTCUSDT"; }
const IND_DEF = {vol:{on:true}, ma1:{on:true,p:20}, ma2:{on:false,p:50}, ema1:{on:false,p:21}, ema2:{on:false,p:200}, bb:{on:false,p:20,k:2}, vwap:{on:false}, rsi:{on:false,p:14}, macd:{on:false,f:12,s:26,g:9}, stoch:{on:false,k:14,d:3,sm:3}};
function migrateInd(){
  const v2=store.get("cx.ind2",null); const ind=JSON.parse(JSON.stringify(IND_DEF));
  if(v2){ for(const k in ind) if(v2[k]) Object.assign(ind[k], v2[k]); return ind; }
  const o=store.get("cx.ind",null);
  if(o){ ind.ma1.on=!!o.ma; if(o.ema){ ind.ema1.on=true; ind.ema1.p=50; } ind.rsi.on=!!o.rsi; }
  return ind;
}
const state = {
  id: migrateSym(), tf: store.get("cx.tf","1h"), type: store.get("cx.type","candle"),
  ind: migrateInd(), magnet: store.get("cx.magnet",false),
  tool:null, pend:null, sel:null, drag:null,
  bars:[], disp:[], src:null, host:null, ws:null, poll:null, loadId:0, curTf:null
};

// ---------------- symbol info ----------------
function info(id){
  const [src, ...rest] = id.split(":"); const code = rest.join(":");
  const meta = NAMES[id]||{};
  if(src==="bn"){ const b=code.replace(/USDT$/,""); return {src,code,name:meta.n||b+"/USDT",short:b,sub:(meta.d?meta.d+" · ":"")+"Crypto · Binance",key:"cx.draw."+code}; }
  if(src==="hl"){ const nm=code.split(":")[1]; return {src,code,name:meta.n||nm,short:nm,sub:(meta.d?meta.d+" · ":"")+"Hyperliquid · harga perp 24 jam",key:"cx.draw."+id}; }
  if(src==="fx"){ const [a,b]=code.split(":"); return {src,code,a,b,name:meta.n||a+"/"+b,short:a+b,sub:"Kurs ECB · harian (bukan real-time)",key:"cx.draw."+id,daily:true}; }
  return {src:"bn",code:"BTCUSDT",name:"BTC/USDT",short:"BTC",sub:"Crypto",key:"cx.draw.BTCUSDT"};
}
const cur = () => info(state.id);
const tfObj = k => TFS.find(x=>x.k===(k||state.curTf||state.tf))||TFS[3];

// ---------------- charts ----------------
const theme = {
  layout:{background:{type:"solid",color:"#0b0f17"},textColor:"#8a96ad",fontSize:11.5,fontFamily:"system-ui,-apple-system,Roboto,sans-serif"},
  grid:{vertLines:{color:"rgba(36,48,73,.42)"},horzLines:{color:"rgba(36,48,73,.42)"}},
  rightPriceScale:{borderColor:"#243049",minimumWidth:78},
  timeScale:{borderColor:"#243049",timeVisible:true,secondsVisible:false,rightOffset:8,barSpacing:7},
  crosshair:{mode:LWC.CrosshairMode.Normal,vertLine:{color:"#5b6b8c",width:1,style:LWC.LineStyle.Dashed,labelBackgroundColor:"#2a3858"},horzLine:{color:"#5b6b8c",width:1,style:LWC.LineStyle.Dashed,labelBackgroundColor:"#2a3858"}},
  localization:{locale:"id-ID",timeFormatter:t=>fmtTime(t),priceFormatter:p=>fmtAxis(p)},
  kineticScroll:{touch:true,mouse:false}
};
const mainWrap=$("#mainWrap"), chartEl=$("#chart"), ov=$("#overlay"), stage=$("#stage"), panesEl=$("#panes");
const chart = LWC.createChart(chartEl, theme);
const UPC="#22c58b", DNC="#f0506e";
const sCandle = chart.addCandlestickSeries({upColor:UPC,downColor:DNC,borderUpColor:UPC,borderDownColor:DNC,wickUpColor:UPC,wickDownColor:DNC});
const sBar = chart.addBarSeries({upColor:UPC,downColor:DNC,thinBars:false,visible:false});
const sLine = chart.addLineSeries({color:"#7c9cff",lineWidth:2,visible:false,crosshairMarkerRadius:4});
const sVol = chart.addHistogramSeries({priceScaleId:"vol",priceFormat:{type:"volume"},lastValueVisible:false,priceLineVisible:false});
chart.priceScale("vol").applyOptions({scaleMargins:{top:.84,bottom:0}});
chart.priceScale("right").applyOptions({scaleMargins:{top:.08,bottom:.18}});
const lineOpt = c => ({color:c,lineWidth:1.6,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
const ov_ = {
  ma1: chart.addLineSeries(lineOpt("#f5b84a")), ma2: chart.addLineSeries(lineOpt("#fb923c")),
  ema1: chart.addLineSeries(lineOpt("#7c9cff")), ema2: chart.addLineSeries(lineOpt("#e879f9")),
  bbU: chart.addLineSeries(lineOpt("rgba(56,189,248,.85)")), bbM: chart.addLineSeries({...lineOpt("rgba(56,189,248,.55)"),lineStyle:LWC.LineStyle.Dashed}), bbL: chart.addLineSeries(lineOpt("rgba(56,189,248,.85)")),
  vwap: chart.addLineSeries(lineOpt("#facc15"))
};
const IND_COL = {ma1:"#f5b84a",ma2:"#fb923c",ema1:"#7c9cff",ema2:"#e879f9",bb:"#38bdf8",vwap:"#facc15",rsi:"#c084fc",macd:"#38bdf8",stoch:"#f5b84a",vol:"#64748b"};
function S(){ const t=effType(); return t==="bar"? sBar : t==="line"? sLine : sCandle; }

// sub panes (RSI / MACD / Stoch)
const panes = {};
const PANE_ORDER = ["rsi","macd","stoch"];
function makePane(k){
  const el=document.createElement("div"); el.className="pane"; el.dataset.k=k;
  const lab=document.createElement("div"); lab.className="plabel"; el.appendChild(lab);
  panesEl.appendChild(el);
  const c = LWC.createChart(el, {...theme, localization:{...theme.localization, priceFormatter: k==="macd"? (p=>fmtAxis(p)) : (p=>fmtNum(p,1))}, layout:{...theme.layout, attributionLogo:false}, timeScale:{...theme.timeScale,visible:false}, rightPriceScale:{borderColor:"#243049",minimumWidth:78,scaleMargins:{top:.12,bottom:.08}}, handleScale:{axisPressedMouseMove:false}});
  const p = {el, lab, chart:c, s:{}};
  if(k==="rsi"){
    p.s.a=c.addLineSeries({color:IND_COL.rsi,lineWidth:1.6,priceLineVisible:false,crosshairMarkerVisible:false});
    [70,30].forEach(v=>p.s.a.createPriceLine({price:v,color:"rgba(138,150,173,.55)",lineWidth:1,lineStyle:LWC.LineStyle.Dashed,axisLabelVisible:false}));
  } else if(k==="macd"){
    p.s.h=c.addHistogramSeries({priceLineVisible:false,lastValueVisible:false});
    p.s.a=c.addLineSeries({color:"#38bdf8",lineWidth:1.6,priceLineVisible:false,crosshairMarkerVisible:false});
    p.s.b=c.addLineSeries({color:"#fb923c",lineWidth:1.6,priceLineVisible:false,crosshairMarkerVisible:false});
  } else {
    p.s.a=c.addLineSeries({color:"#38bdf8",lineWidth:1.6,priceLineVisible:false,crosshairMarkerVisible:false});
    p.s.b=c.addLineSeries({color:"#fb923c",lineWidth:1.6,priceLineVisible:false,crosshairMarkerVisible:false});
    [80,20].forEach(v=>p.s.a.createPriceLine({price:v,color:"rgba(138,150,173,.55)",lineWidth:1,lineStyle:LWC.LineStyle.Dashed,axisLabelVisible:false}));
  }
  c.timeScale().subscribeVisibleLogicalRangeChange(r=>{ if(syncing||!r) return; syncing=true; chart.timeScale().setVisibleLogicalRange(r); PANE_ORDER.forEach(o=>{ if(panes[o]&&panes[o]!==p) panes[o].chart.timeScale().setVisibleLogicalRange(r); }); syncing=false; });
  panes[k]=p; return p;
}
function syncPanes(){
  PANE_ORDER.forEach(k=>{
    const want = !!state.ind[k].on;
    if(want && !panes[k]) makePane(k);
    if(!want && panes[k]){ panes[k].chart.remove(); panes[k].el.remove(); delete panes[k]; }
  });
  // keep DOM order
  PANE_ORDER.forEach(k=>{ if(panes[k]) panesEl.appendChild(panes[k].el); });
}
let syncing=false;
chart.timeScale().subscribeVisibleLogicalRangeChange(r=>{
  if(r && !syncing){ syncing=true; PANE_ORDER.forEach(k=>{ if(panes[k]) panes[k].chart.timeScale().setVisibleLogicalRange(r); }); syncing=false; }
  requestDraw();
});

function layout(){
  const W = stage.clientWidth, H = stage.clientHeight;
  const ks = PANE_ORDER.filter(k=>panes[k]);
  const ph = ks.length? Math.round(H*(ks.length===1?0.24:ks.length===2?0.2:0.17)) : 0;
  const mh = H - ph*ks.length;
  mainWrap.style.height = mh+"px"; mainWrap.style.width = W+"px";
  chart.resize(W, mh);
  ks.forEach(k=>{ panes[k].el.style.height=ph+"px"; panes[k].chart.resize(W, ph-1); });
  const dpr = window.devicePixelRatio||1;
  ov.width = Math.round(W*dpr); ov.height = Math.round(mh*dpr); ov.style.width=W+"px"; ov.style.height=mh+"px";
  alignScales();
  requestDraw();
}
function alignScales(){
  const all=[chart, ...PANE_ORDER.filter(k=>panes[k]).map(k=>panes[k].chart)];
  const w = Math.max(78, ...all.map(c=>{ try{return c.priceScale("right").width()}catch(e){return 0} }));
  all.forEach(c=>c.applyOptions({rightPriceScale:{minimumWidth:w}}));
}
window.addEventListener("resize", layout);
new ResizeObserver(()=>layout()).observe(stage);

// ---------------- format ----------------
function fmtTime(t){
  const d = new Date(t*1000), p=n=>String(n).padStart(2,"0");
  if(tfObj().sec>=86400) return `${p(d.getDate())}/${p(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)}`;
  return `${p(d.getDate())}/${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
let DEC = 2;
function decFor(p){ p=Math.abs(p); if(p>=100) return 2; if(p>=10) return 3; if(p>=1) return 4; if(p>=0.1) return 5; if(p>=0.01) return 6; return 8; }
function fmtPrice(p,dec){ if(p==null||!isFinite(p)) return "—"; const d=dec==null?DEC:dec; return p.toLocaleString("id-ID",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtAxis(p){ if(p==null||!isFinite(p)) return ""; const a=Math.abs(p); const d = a>=10000? 0 : a>=100? 2 : decFor(a||1); return p.toLocaleString("id-ID",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtPct(x){ return (x>=0?"+":"")+x.toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2})+"%"; }
function fmtNum(x,d=2){ return x.toLocaleString("id-ID",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtDur(sec){ const d=Math.floor(sec/86400), h=Math.floor(sec%86400/3600), m=Math.round(sec%3600/60); if(d) return d+"h "+(h?h+"j":""); if(h) return h+"j "+(m?m+"m":""); return m+"m"; }

// ---------------- data ----------------
async function fetchJSON(url, opt={}, ms=9000){
  const ctl = new AbortController(); const t=setTimeout(()=>ctl.abort(),ms);
  try{ const r = await fetch(url,{...opt,signal:ctl.signal}); if(!r.ok) throw new Error("HTTP "+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}
const kb = k => ({time:Math.floor(k[0]/1000),open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5]});
async function loadBinance(sym, tf){
  let lastErr;
  for(const host of BINANCE.slice()){
    try{
      const d = await fetchJSON(`${host}/api/v3/klines?symbol=${sym}&interval=${tf.k}&limit=1000`);
      if(!Array.isArray(d)||!d.length) throw new Error("kosong");
      if(host!==BINANCE[0]){ BINANCE.splice(BINANCE.indexOf(host),1); BINANCE.unshift(host); }
      return {src:"binance", host, bars:d.map(kb)};
    }catch(e){ lastErr=e; }
  }
  throw lastErr;
}
async function loadOkx(sym, tf){
  const inst = sym.replace(/USDT$/,"")+"-USDT";
  let all=[], after="";
  for(let i=0;i<4;i++){
    const d = await fetchJSON(`https://www.okx.com/api/v5/market/history-candles?instId=${inst}&bar=${tf.okx}&limit=100${after?"&after="+after:""}`);
    if(d.code!=="0"||!d.data) throw new Error(d.msg||"OKX error");
    if(!d.data.length) break;
    all = all.concat(d.data); after = d.data[d.data.length-1][0];
    if(d.data.length<100) break;
  }
  if(!all.length) throw new Error("Pair tidak ditemukan");
  const bars = all.map(k=>({time:Math.floor(+k[0]/1000),open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5]})).sort((a,b)=>a.time-b.time);
  return {src:"okx", bars: bars.filter((b,i)=>i===0||b.time!==bars[i-1].time)};
}
const hb = c => ({time:Math.floor(c.t/1000),open:+c.o,high:+c.h,low:+c.l,close:+c.c,volume:+c.v});
async function hlCandles(coin, tf, startMs){
  const d = await fetchJSON(HL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"candleSnapshot",req:{coin,interval:tf.k,startTime:startMs,endTime:Date.now()+60000}})});
  if(!Array.isArray(d)) throw new Error("HL error");
  return d.map(hb);
}
async function loadHL(coin, tf){
  const bars = await hlCandles(coin, tf, Date.now()-tf.sec*1000*1500);
  if(!bars.length) throw new Error("Data kosong");
  return {src:"hl", bars};
}
async function loadFX(a, b){
  const from = new Date(Date.now()-86400000*365*5).toISOString().slice(0,10);
  const d = await fetchJSON(`${FX}/${from}..?base=${a}&symbols=${b}`);
  const rates = d && d.rates; if(!rates) throw new Error("FX error");
  const bars = Object.keys(rates).sort().map(day=>{ const v=+rates[day][b]; return {time:Math.floor(Date.parse(day+"T00:00:00Z")/1000),open:v,high:v,low:v,close:v,volume:0}; }).filter(x=>isFinite(x.close));
  if(!bars.length) throw new Error("Data kosong");
  return {src:"fx", bars};
}
async function loadBars(id, tf){
  const i = info(id);
  if(i.src==="bn"){ try{ return await loadBinance(i.code, tf); }catch(e){ return await loadOkx(i.code, tf); } }
  if(i.src==="hl") return await loadHL(i.code, tf);
  if(i.src==="fx") return await loadFX(i.a, i.b);
  throw new Error("sumber?");
}

function stopLive(){
  if(state.ws){ state.ws.onclose=null; state.ws.onerror=null; try{state.ws.close()}catch(e){} state.ws=null; }
  if(state.poll){ clearInterval(state.poll); state.poll=null; }
}
function setStatus(c){ const el=$("#status"); el.className=c||""; el.title = {live:"Live (websocket)",poll:"Update tiap beberapa detik",daily:"Data harian"}[c]||"Offline"; }
function startLive(id){
  stopLive();
  const tf = tfObj(), i = cur();
  if(state.src==="fx"){ setStatus("daily"); state.poll=setInterval(async()=>{ if(id!==state.loadId) return; try{ const r=await loadFX(i.a,i.b); r.bars.slice(-3).forEach(applyBar); }catch(e){} }, 10*60000); return; }
  const startPoll = (ms=5000) => {
    setStatus("poll");
    state.poll = setInterval(async()=>{
      if(id!==state.loadId || document.hidden) return;
      try{
        let k=[];
        if(state.src==="binance"){
          const d = await fetchJSON(`${state.host}/api/v3/klines?symbol=${i.code}&interval=${tf.k}&limit=2`,{},5000); k=d.map(kb);
        } else if(state.src==="okx"){
          const d = await fetchJSON(`https://www.okx.com/api/v5/market/candles?instId=${i.code.replace(/USDT$/,"")}-USDT&bar=${tf.okx}&limit=2`,{},5000);
          k = d.data.map(x=>({time:Math.floor(+x[0]/1000),open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]})).reverse();
        } else if(state.src==="hl"){
          const last = state.bars[state.bars.length-1]; k = await hlCandles(i.code, tf, (last?last.time:Date.now()/1000)*1000);
        }
        if(id===state.loadId) k.forEach(applyBar);
      }catch(e){}
    }, ms);
  };
  if(state.src==="hl"){ startPoll(3000); return; }
  if(state.src!=="binance" || isTest){ startPoll(); return; }
  let opened=false;
  try{
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${i.code.toLowerCase()}@kline_${tf.k}`);
    state.ws = ws;
    const to = setTimeout(()=>{ if(!opened){ try{ws.close()}catch(e){} } }, 6000);
    ws.onopen = ()=>{ opened=true; clearTimeout(to); setStatus("live"); };
    ws.onmessage = ev => { if(id!==state.loadId) return; const k=JSON.parse(ev.data).k; if(k) applyBar({time:Math.floor(k.t/1000),open:+k.o,high:+k.h,low:+k.l,close:+k.c,volume:+k.v}); };
    ws.onerror = ()=>{};
    ws.onclose = ()=>{ clearTimeout(to); if(id!==state.loadId) return; state.ws=null; startPoll(); };
  }catch(e){ startPoll(); }
}

// ---------------- indicators ----------------
function smaA(v,n){ const o=new Array(v.length).fill(null); let s=0,c=0; for(let i=0;i<v.length;i++){ if(v[i]==null){ s=0;c=0; continue; } s+=v[i]; c++; if(c>n){ s-=v[i-n]; c=n; } if(c===n) o[i]=s/n; } return o; }
function emaA(v,n){ const o=new Array(v.length).fill(null); const k=2/(n+1); let e=null, s=0, c=0; for(let i=0;i<v.length;i++){ const x=v[i]; if(x==null) continue; if(e===null){ s+=x; c++; if(c===n){ e=s/n; o[i]=e; } } else { e=x*k+e*(1-k); o[i]=e; } } return o; }
function stdA(v,n,m){ const o=new Array(v.length).fill(null); for(let i=n-1;i<v.length;i++){ if(m[i]==null) continue; let s=0; for(let j=i-n+1;j<=i;j++) s+=(v[j]-m[i])**2; o[i]=Math.sqrt(s/n); } return o; }
function rsiA(v,n){ const o=new Array(v.length).fill(null); let g=0,l=0; for(let i=1;i<v.length;i++){ const d=v[i]-v[i-1], up=Math.max(d,0), dn=Math.max(-d,0); if(i<=n){ g+=up; l+=dn; if(i===n){ g/=n; l/=n; o[i]=l===0?100:100-100/(1+g/l); } } else { g=(g*(n-1)+up)/n; l=(l*(n-1)+dn)/n; o[i]=l===0?100:100-100/(1+g/l); } } return o; }
function stochA(b,kp,dp,sm){ const raw=new Array(b.length).fill(null); for(let i=kp-1;i<b.length;i++){ let hh=-Infinity,ll=Infinity; for(let j=i-kp+1;j<=i;j++){ if(b[j].high>hh) hh=b[j].high; if(b[j].low<ll) ll=b[j].low; } raw[i]= hh===ll? 50 : (b[i].close-ll)/(hh-ll)*100; } const k=smaA(raw,sm); return {k, d:smaA(k,dp)}; }
function vwapA(b){ const o=new Array(b.length).fill(null); let pv=0,vv=0,day=null; for(let i=0;i<b.length;i++){ const d=Math.floor(b[i].time/86400); if(d!==day){ day=d; pv=0; vv=0; } const tp=(b[i].high+b[i].low+b[i].close)/3; pv+=tp*b[i].volume; vv+=b[i].volume; o[i]= vv>0? pv/vv : null; } return o; }
function heikin(b){ const o=[]; for(let i=0;i<b.length;i++){ const x=b[i]; const c=(x.open+x.high+x.low+x.close)/4; const op = i? (o[i-1].open+o[i-1].close)/2 : (x.open+x.close)/2; o.push({time:x.time,open:op,close:c,high:Math.max(x.high,op,c),low:Math.min(x.low,op,c)}); } return o; }
const ser = (b,a) => { const o=[]; for(let i=0;i<b.length;i++) if(a[i]!=null&&isFinite(a[i])) o.push({time:b[i].time,value:a[i]}); return o; };
const IV = {}; // latest computed arrays for legend
function computeIndicators(){
  const b=state.bars, c=b.map(x=>x.close), I=state.ind, noVol = state.src==="fx";
  const intraday = tfObj().sec < 86400;
  for(const k of ["ma1","ma2"]){ IV[k] = I[k].on? smaA(c,Math.max(1,I[k].p|0)) : null; ov_[k].setData(IV[k]? ser(b,IV[k]):[]); }
  for(const k of ["ema1","ema2"]){ IV[k] = I[k].on? emaA(c,Math.max(1,I[k].p|0)) : null; ov_[k].setData(IV[k]? ser(b,IV[k]):[]); }
  if(I.bb.on){ const n=Math.max(2,I.bb.p|0), m=smaA(c,n), sd=stdA(c,n,m), k=+I.bb.k||2; IV.bb={m, u:m.map((x,i)=>x==null?null:x+k*sd[i]), l:m.map((x,i)=>x==null?null:x-k*sd[i])}; ov_.bbU.setData(ser(b,IV.bb.u)); ov_.bbM.setData(ser(b,IV.bb.m)); ov_.bbL.setData(ser(b,IV.bb.l)); }
  else { IV.bb=null; ov_.bbU.setData([]); ov_.bbM.setData([]); ov_.bbL.setData([]); }
  IV.vwap = (I.vwap.on && !noVol && intraday)? vwapA(b) : null; ov_.vwap.setData(IV.vwap? ser(b,IV.vwap):[]);
  sVol.setData(I.vol.on && !noVol ? b.map(x=>({time:x.time,value:x.volume,color:x.close>=x.open?"rgba(34,197,139,.32)":"rgba(240,80,110,.32)"})) : []);
  if(panes.rsi){ IV.rsi=rsiA(c,Math.max(2,I.rsi.p|0)); panes.rsi.s.a.setData(ser(b,IV.rsi)); } else IV.rsi=null;
  if(panes.macd){ const f=emaA(c,I.macd.f|0||12), s=emaA(c,I.macd.s|0||26); const m=c.map((_,i)=>f[i]!=null&&s[i]!=null?f[i]-s[i]:null); const sg=emaA(m,I.macd.g|0||9); const h=m.map((x,i)=>x!=null&&sg[i]!=null?x-sg[i]:null);
    IV.macd={m,sg,h}; panes.macd.s.a.setData(ser(b,m)); panes.macd.s.b.setData(ser(b,sg));
    panes.macd.s.h.setData(b.map((x,i)=>h[i]==null?null:{time:x.time,value:h[i],color:h[i]>=0?(i&&h[i-1]!=null&&h[i]<h[i-1]?"rgba(34,197,139,.45)":"rgba(34,197,139,.85)"):(i&&h[i-1]!=null&&h[i]>h[i-1]?"rgba(240,80,110,.45)":"rgba(240,80,110,.85)")}).filter(Boolean)); } else IV.macd=null;
  if(panes.stoch){ IV.stoch=stochA(b,Math.max(1,I.stoch.k|0),Math.max(1,I.stoch.d|0),Math.max(1,I.stoch.sm|0)); panes.stoch.s.a.setData(ser(b,IV.stoch.k)); panes.stoch.s.b.setData(ser(b,IV.stoch.d)); } else IV.stoch=null;
  updateLegend(); updatePaneLabels();
}
let indTimer=null;
function computeSoon(){ if(indTimer) return; indTimer=setTimeout(()=>{ indTimer=null; computeIndicators(); }, 250); }

function setMainData(){
  const b=state.bars;
  state.disp = T()==="ha"? heikin(b) : b;
  sCandle.setData(T()==="candle"||T()==="ha"? state.disp : []);
  sBar.setData(T()==="bar"? b : []);
  sLine.setData(T()==="line"? b.map(x=>({time:x.time,value:x.close})) : []);
  sCandle.applyOptions({visible:T()==="candle"||T()==="ha"}); sBar.applyOptions({visible:T()==="bar"}); sLine.applyOptions({visible:T()==="line"});
}
function applyBar(bar){
  const bars = state.bars, last = bars[bars.length-1];
  if(!last || bar.time < last.time) return;
  const prevClose = last.close;
  if(bar.time === last.time) bars[bars.length-1]=bar; else bars.push(bar);
  if(T()==="ha"){ const n=bars.length; const prev = n>1? state.disp[n-2] : null; const c=(bar.open+bar.high+bar.low+bar.close)/4; const op = prev? (prev.open+prev.close)/2 : (bar.open+bar.close)/2; const h={time:bar.time,open:op,close:c,high:Math.max(bar.high,op,c),low:Math.min(bar.low,op,c)}; if(state.disp.length===n) state.disp[n-1]=h; else state.disp.push(h); sCandle.update(h); }
  else { state.disp = bars; if(T()==="candle") sCandle.update(bar); else if(T()==="bar") sBar.update(bar); else sLine.update({time:bar.time,value:bar.close}); }
  if(state.ind.vol.on && state.src!=="fx") sVol.update({time:bar.time,value:bar.volume,color:bar.close>=bar.open?"rgba(34,197,139,.32)":"rgba(240,80,110,.32)"});
  computeSoon(); updateHeader(); checkAlerts(prevClose, bar.close); requestDraw();
}

// ---------------- legend / header ----------------
let hoverIdx = null;
function idxOfTime(t){ const b=state.bars; let lo=0,hi=b.length-1; while(lo<=hi){ const m=(lo+hi)>>1; if(b[m].time===t) return m; if(b[m].time<t) lo=m+1; else hi=m-1; } return -1; }
chart.subscribeCrosshairMove(p=>{
  const i = (p && p.time!=null)? idxOfTime(p.time) : -1;
  hoverIdx = i>=0? i : null; updateLegend(); updatePaneLabels();
});
function v(a,i){ return a && a[i]!=null ? a[i] : null; }
function updateLegend(){
  const b=state.disp, n=b.length; if(!n){ $("#legend").innerHTML=""; return; }
  let i = hoverIdx!=null? hoverIdx : n-1; if(i>=n || !state.bars[i]) i=Math.min(n,state.bars.length)-1; if(i<0) return; const x=b[i], inf=cur();
  const prev = i? state.bars[i-1].close : x.open, ch = (state.bars[i].close-prev)/prev*100;
  const col = state.bars[i].close>=prev? "var(--up)":"var(--down)";
  const rows = [`<b>${inf.name}</b> · ${tfObj().l}${inf.daily?" · harian":""}`];
  if(state.src==="fx") rows.push(`<span class="o">C <b style="color:${col}">${fmtPrice(x.close)}</b> <span style="color:${col}">${fmtPct(ch)}</span></span>`);
  else rows.push(`<span class="o">O <b>${fmtPrice(x.open)}</b> H <b>${fmtPrice(x.high)}</b></span><br><span class="o">L <b>${fmtPrice(x.low)}</b> C <b style="color:${col}">${fmtPrice(x.close)}</b> <span style="color:${col}">${fmtPct(ch)}</span></span>`);
  const I=state.ind, parts=[];
  for(const k of ["ma1","ma2","ema1","ema2"]) if(I[k].on) parts.push(`<span style="color:${IND_COL[k]}">${k.startsWith("ma")?"MA":"EMA"}${I[k].p} ${fmtPrice(v(IV[k],i))}</span>`);
  if(I.bb.on && IV.bb) parts.push(`<span style="color:${IND_COL.bb}">BB ${fmtPrice(v(IV.bb.u,i))} / ${fmtPrice(v(IV.bb.l,i))}</span>`);
  if(I.vwap.on){ parts.push(IV.vwap? `<span style="color:${IND_COL.vwap}">VWAP ${fmtPrice(v(IV.vwap,i))}</span>` : `<span>VWAP: cuma intraday</span>`); }
  if(parts.length) rows.push(parts.join(" &nbsp;"));
  $("#legend").innerHTML = rows.join("<br>");
}
function updatePaneLabels(){
  const n=state.bars.length; if(!n) return; const i = (hoverIdx!=null && hoverIdx<n)? hoverIdx : n-1, I=state.ind;
  const f=x=>x==null?"—":fmtNum(x,2);
  if(panes.rsi) panes.rsi.lab.innerHTML = `<span style="color:${IND_COL.rsi}">RSI ${I.rsi.p}</span> ${f(v(IV.rsi,i))}`;
  if(panes.macd && IV.macd) panes.macd.lab.innerHTML = `MACD ${I.macd.f},${I.macd.s},${I.macd.g} <span style="color:#38bdf8">${fmtPrice(v(IV.macd.m,i))}</span> <span style="color:#fb923c">${fmtPrice(v(IV.macd.sg,i))}</span>`;
  if(panes.stoch && IV.stoch) panes.stoch.lab.innerHTML = `Stoch ${I.stoch.k},${I.stoch.d},${I.stoch.sm} <span style="color:#38bdf8">${f(v(IV.stoch.k,i))}</span> <span style="color:#fb923c">${f(v(IV.stoch.d,i))}</span>`;
}
function updateHeader(){
  const b=state.bars; if(!b.length) return;
  const last=b[b.length-1].close;
  $("#lastPrice").textContent = fmtPrice(last);
  let ref, lab;
  if(tfObj().sec>=86400){ ref = b.length>1? b[b.length-2].close : b[0].open; lab = ""; }
  else { const cutoff = b[b.length-1].time - 86400; ref=b[0].close; for(let i=b.length-1;i>=0;i--){ if(b[i].time<=cutoff){ ref=b[i].close; break; } } lab=" 24j"; }
  const pct=(last-ref)/ref*100, el=$("#chg");
  el.textContent = fmtPct(pct)+lab; el.style.color = pct>=0? "var(--up)":"var(--down)";
  document.title = `${fmtPrice(last)} ${cur().short} · Chart`;
}

// ---------------- load ----------------
async function load(id, tfKey){
  const loadId = ++state.loadId;
  const inf = info(id);
  const useTf = inf.daily? "1d" : tfKey;
  stopLive(); setStatus("");
  $("#loading").style.display="flex"; $("#loading").textContent="Memuat chart…";
  try{
    const r = await loadBars(id, tfObj(useTf));
    if(loadId!==state.loadId) return true;
    cancelTool(); state.sel=null; showSel();
    state.id=id; state.curTf=useTf; if(!inf.daily) state.tf=tfKey;
    state.src=r.src; state.host=r.host; state.bars=r.bars; state.disp=r.bars; hoverIdx=null;
    store.set("cx.sym2",id); store.set("cx.tf",state.tf);
    DEC = decFor(r.bars[r.bars.length-1].close);
    const pf = {priceFormat:{type:"price",precision:DEC,minMove:1/Math.pow(10,DEC)}};
    [sCandle,sBar,sLine,...Object.values(ov_)].forEach(s=>s.applyOptions(pf));
    if(panes.macd){ panes.macd.s.a.applyOptions(pf); panes.macd.s.b.applyOptions(pf); panes.macd.s.h.applyOptions(pf); }
    if(inf.daily && state.type!=="line"){ state.forcedLine = true; } else state.forcedLine=false;
    applyType(false);
    computeIndicators();
    const n=r.bars.length; chart.timeScale().setVisibleLogicalRange({from:Math.max(0,n-(inf.daily?180:100)),to:n+6});
    renderTfBar();
    $("#symName").textContent = inf.name;
    $("#symSub").textContent = r.src==="okx"? "Crypto · OKX (cadangan)" : inf.sub;
    updateHeader(); loadDrawings(); $("#loading").style.display="none";
    startLive(loadId); setTimeout(alignScales,50); requestDraw();
    return true;
  }catch(e){
    if(loadId!==state.loadId) return false;
    $("#loading").textContent = "Gagal memuat data. Cek internet lalu coba lagi.";
    if(state.bars.length){ $("#loading").style.display="none"; startLive(loadId); }
    return false;
  }
}
function renderTfBar(){
  const daily = cur().daily;
  $("#tfBar").innerHTML = TFS.map(t=>`<button class="chip${t.k===(state.curTf||state.tf)?" on":""}" data-tf="${t.k}"${daily&&t.k!=="1d"?" disabled":""}>${t.l}</button>`).join("");
  const on=$("#tfBar .chip.on"); if(on) on.scrollIntoView({inline:"nearest",block:"nearest"});
}
$("#tfBar").addEventListener("click", e=>{ const b=e.target.closest("[data-tf]"); if(!b||b.disabled) return; if(b.dataset.tf!==state.curTf) load(state.id,b.dataset.tf); });

// ---------------- chart type ----------------
const TYPES = [
  {k:"candle",l:"Candle",svg:'<path d="M7 4v16M17 4v16"/><rect x="4.5" y="8" width="5" height="8" rx="1" fill="currentColor"/><rect x="14.5" y="6" width="5" height="9" rx="1"/>'},
  {k:"ha",l:"Heikin Ashi",svg:'<path d="M7 3v18M17 3v18"/><rect x="4.5" y="7" width="5" height="10" rx="1" fill="currentColor"/><rect x="14.5" y="5" width="5" height="8" rx="1" fill="currentColor" opacity=".5"/>'},
  {k:"bar",l:"Bar (OHLC)",svg:'<path d="M7 4v16M4 8h3M7 15h3M17 4v16M14 7h3M17 13h3"/>'},
  {k:"line",l:"Garis",svg:'<path d="M3 17l5-6 4 3 8-9"/>'}
];
const icon = s => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
function T(){ return effType(); }
function effType(){ return state.forcedLine? "line" : state.type; }
function applyType(save=true){
  const eff = effType(); setMainData();
  const t=TYPES.find(x=>x.k===eff); $("#btnType").innerHTML = icon(t.svg);
  if(save) store.set("cx.type",state.type);
  requestDraw();
}
$("#btnType").addEventListener("click",()=>{
  $("#typeList").innerHTML = TYPES.map(t=>`<button class="mi" data-type="${t.k}"${state.forcedLine&&t.k!=="line"?" disabled":""}>${icon(t.svg)}${t.l}${effType()===t.k?'<span class="r">aktif</span>':""}</button>`).join("") + (state.forcedLine? `<div class="note">Kurs ECB cuma punya harga penutupan, jadi cuma bisa garis.</div>`:"");
  $("#dlgType").showModal();
});
$("#typeList").addEventListener("click",e=>{ const b=e.target.closest("[data-type]"); if(!b||b.disabled) return; state.type=b.dataset.type; applyType(); computeIndicators(); updateLegend(); $("#dlgType").close(); });

// ---------------- coordinate mapping ----------------
function timeToLogical(t){
  const b=state.bars, n=b.length; if(!n) return null;
  const sec=tfObj().sec;
  if(t<=b[0].time) return (t-b[0].time)/sec;
  if(t>=b[n-1].time) return n-1+(t-b[n-1].time)/sec;
  let lo=0,hi=n-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(b[m].time<=t) lo=m; else hi=m; }
  return lo + (t-b[lo].time)/(b[hi].time-b[lo].time);
}
function logicalToTime(l){
  const b=state.bars, n=b.length; if(!n) return null;
  const sec=tfObj().sec;
  if(l<=0) return b[0].time + l*sec;
  if(l>=n-1) return b[n-1].time + (l-(n-1))*sec;
  const i=Math.floor(l), f=l-i; return b[i].time + f*(b[i+1].time-b[i].time);
}
const X = t => { const l=timeToLogical(t); return l==null? null : chart.timeScale().logicalToCoordinate(l); };
const Y = p => S().priceToCoordinate(p);
function fromXY(x,y){
  const l=chart.timeScale().coordinateToLogical(x), p=S().coordinateToPrice(y);
  if(l==null||p==null) return null; return {t:logicalToTime(l), p, l};
}
function snap(pt, x, y){
  if(!state.magnet || !pt) return pt;
  const i = Math.round(pt.l), b=state.disp[i]; if(!b) return pt;
  let best=null, bd=40;
  for(const k of ["open","high","low","close"]){ const yy=Y(b[k]); if(yy!=null && Math.abs(yy-y)<bd){ bd=Math.abs(yy-y); best=b[k]; } }
  if(best==null) return pt;
  return {t:b.time, p:best, l:i};
}

// ---------------- drawings model ----------------
const PALETTE=["#22d3a6","#f5b84a","#f0506e","#7c9cff","#c084fc","#e6ebf5"];
const DEF_COLOR={hline:"#22d3a6",ray:"#22d3a6",vline:"#8a96ad",trend:"#f5b84a",channel:"#7c9cff",fib:"#8a96ad",rect:"#7c9cff",long:"#22c58b",short:"#f0506e",measure:"#7c9cff",text:"#e6ebf5",alert:"#f5b84a"};
const NEED={hline:1,ray:1,vline:1,text:1,alert:1,long:1,short:1,trend:2,rect:2,fib:2,measure:2,channel:3};
const FIB=[0,0.236,0.382,0.5,0.618,0.786,1];
const FIBC=["#8a96ad","#f0506e","#fb923c","#22c58b","#22d3a6","#7c9cff","#8a96ad"];
let drawings=[], undoStack=[];
function loadDrawings(){
  const raw = store.get(cur().key, []);
  drawings = raw.map(d=>{
    if(d.type==="h") return {id:d.id||rid(),type:"hline",pts:[{t:0,p:d.p}],c:d.c||DEF_COLOR.hline,w:2};
    if(d.type==="t") return {id:d.id||rid(),type:"trend",pts:[{t:d.t1,p:d.p1},{t:d.t2,p:d.p2}],c:d.c||DEF_COLOR.trend,w:2,ext:true};
    return d;
  }).filter(d=>d && d.type && Array.isArray(d.pts));
  undoStack=[]; requestDraw();
}
function saveDrawings(){ store.set(cur().key, drawings); }
function rid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function pushUndo(){ undoStack.push(JSON.stringify(drawings)); if(undoStack.length>60) undoStack.shift(); }
function undo(){ if(!undoStack.length){ toast("Nggak ada yang bisa di-undo"); return; } drawings=JSON.parse(undoStack.pop()); state.sel=null; showSel(); saveDrawings(); requestDraw(); toast("Undo"); }
const selD = () => drawings.find(d=>d.id===state.sel)||null;

// ---------------- rendering ----------------
let drawQueued=false;
function requestDraw(){ if(drawQueued) return; drawQueued=true; requestAnimationFrame(()=>{ drawQueued=false; render(); }); }
function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function hexA(c,a){ if(c[0]!=="#") return c; const n=parseInt(c.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
function label(ctx, x, y, text, bg, fg="#0b0f17", align="left", font="600 11.5px system-ui,Roboto,sans-serif"){
  ctx.font=font; const lines=String(text).split("\n"); const w=Math.max(...lines.map(l=>ctx.measureText(l).width))+12, h=lines.length*15+5;
  let lx = align==="center"? x-w/2 : align==="right"? x-w : x; const ly=y-h/2;
  const CW=chart.timeScale().width(); lx=Math.max(2, Math.min(lx, CW-w-2));
  ctx.fillStyle=bg; rr(ctx,lx,ly,w,h,5); ctx.fill();
  ctx.fillStyle=fg; ctx.textBaseline="middle"; ctx.textAlign="left";
  lines.forEach((l,i)=>ctx.fillText(l, lx+6, ly+10+i*15));
  return {x:lx,y:ly,w,h};
}
function axisLabel(ctx,y,text,bg,fg){ const W=chart.timeScale().width(); const full=ov.width/(window.devicePixelRatio||1); ctx.font="600 11.5px system-ui,Roboto,sans-serif"; const h=20; ctx.fillStyle=bg; rr(ctx,W+1,y-h/2,full-W-2,h,4); ctx.fill(); ctx.fillStyle=fg||"#0b0f17"; ctx.textBaseline="middle"; ctx.textAlign="left"; ctx.fillText(text,W+6,y); }
function lineSeg(ctx,a,b){ ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
function extendTo(a,b,W){ if(Math.abs(b.x-a.x)<0.5) return b; const k=(b.y-a.y)/(b.x-a.x); const ex=b.x>a.x?W+50:-50; return {x:ex,y:a.y+k*(ex-a.x)}; }
function pp(pt){ const x=X(pt.t), y=Y(pt.p); return (x==null||y==null)? null : {x,y}; }

function geo(d){
  // screen geometry for render + hit-testing
  const W=chart.timeScale().width(), H=paneH();
  const P=d.pts.map(pp);
  if(P.some(p=>!p) && !["hline","alert","vline"].includes(d.type)) return null;
  return {W,H,P};
}
function paneH(){ return (ov.height/(window.devicePixelRatio||1)) - chart.timeScale().height(); }
function posMetrics(d){ // long/short
  const e=d.pts[0].p, sl=d.pts[1].p, tp=d.pts[2].p;
  const risk=Math.abs(e-sl), rew=Math.abs(tp-e);
  return {e,sl,tp,risk,rew,rr: risk>0? rew/risk : 0};
}
function fibPrice(d,lv){ const p1=d.pts[0].p, p2=d.pts[1].p; return p2 + (p1-p2)*lv; }

function drawOne(ctx,d,sel){
  const g=geo(d); if(!g) return; const {W,H,P}=g; const c=d.c||DEF_COLOR[d.type]; const lw=d.w||2;
  ctx.strokeStyle=c; ctx.lineWidth=lw; ctx.setLineDash([]); ctx.lineCap="round";
  switch(d.type){
    case "hline": { const y=Y(d.pts[0].p); if(y==null) return; lineSeg(ctx,{x:0,y},{x:W,y}); break; }
    case "alert": { const y=Y(d.pts[0].p); if(y==null) return; ctx.setLineDash([6,5]); ctx.strokeStyle=d.fired?"#5b6b8c":c; lineSeg(ctx,{x:0,y},{x:W,y}); ctx.setLineDash([]);
      label(ctx, W-6, y-12, (d.fired?"Alert kena ":"Alert ")+fmtPrice(d.pts[0].p), d.fired?"#2a3858":c, d.fired?"#cbd5e1":"#0b0f17","right"); break; }
    case "ray": { const a=P[0]; lineSeg(ctx,a,{x:W,y:a.y}); dotFill(ctx,a,c); break; }
    case "vline": { const x=X(d.pts[0].t); if(x==null) return; lineSeg(ctx,{x,y:0},{x,y:H}); break; }
    case "trend": { const [a,b]=P; lineSeg(ctx,a, d.ext? extendTo(a,b,W) : b); break; }
    case "channel": { const [a,b]=P; lineSeg(ctx,a,b); if(P[2]){ const off=channelOff(d); const a2={x:a.x,y:Y(d.pts[0].p+off)}, b2={x:b.x,y:Y(d.pts[1].p+off)};
        ctx.fillStyle=hexA(c,.10); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(b2.x,b2.y); ctx.lineTo(a2.x,a2.y); ctx.closePath(); ctx.fill();
        lineSeg(ctx,a2,b2); ctx.setLineDash([5,5]); ctx.lineWidth=1; lineSeg(ctx,{x:a.x,y:(a.y+a2.y)/2},{x:b.x,y:(b.y+b2.y)/2}); ctx.setLineDash([]); } break; }
    case "rect": { const [a,b]=P; const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y), w=Math.abs(b.x-a.x), h=Math.abs(b.y-a.y); ctx.fillStyle=hexA(c,.16); ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h); break; }
    case "fib": { const [a,b]=P; const x1=Math.min(a.x,b.x), x2=Math.max(a.x,b.x, x1+40);
      ctx.setLineDash([4,4]); ctx.lineWidth=1; ctx.strokeStyle="rgba(138,150,173,.7)"; lineSeg(ctx,a,b); ctx.setLineDash([]);
      FIB.forEach((lv,i)=>{ const y=Y(fibPrice(d,lv)); if(i<FIB.length-1){ const y2=Y(fibPrice(d,FIB[i+1])); ctx.fillStyle=hexA(FIBC[i+1],.07); ctx.fillRect(x1,Math.min(y,y2),x2-x1,Math.abs(y2-y)); }
        ctx.strokeStyle=FIBC[i]; ctx.lineWidth=1.3; lineSeg(ctx,{x:x1,y},{x:x2,y});
        ctx.font="600 11px system-ui,Roboto,sans-serif"; ctx.fillStyle=FIBC[i]; ctx.textAlign="left"; ctx.textBaseline="bottom"; ctx.fillText(`${lv} (${fmtPrice(fibPrice(d,lv))})`, x1+3, y-2); });
      break; }
    case "long": case "short": {
      const m=posMetrics(d); const x1=X(d.pts[0].t), x2=X(d.pts[1].t); const xl=Math.min(x1,x2), xr=Math.max(x1,x2), w=Math.max(xr-xl,8);
      const ye=Y(m.e), ys=Y(m.sl), yt=Y(m.tp);
      ctx.fillStyle="rgba(34,197,139,.20)"; ctx.fillRect(xl,Math.min(ye,yt),w,Math.abs(yt-ye));
      ctx.fillStyle="rgba(240,80,110,.20)"; ctx.fillRect(xl,Math.min(ye,ys),w,Math.abs(ys-ye));
      ctx.lineWidth=1; ctx.strokeStyle="rgba(34,197,139,.8)"; lineSeg(ctx,{x:xl,y:yt},{x:xl+w,y:yt});
      ctx.strokeStyle="rgba(240,80,110,.8)"; lineSeg(ctx,{x:xl,y:ys},{x:xl+w,y:ys});
      ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=1.5; lineSeg(ctx,{x:xl,y:ye},{x:xl+w,y:ye});
      const cx=xl+w/2, pct=v=>fmtPct(v/m.e*100);
      const tpTxt=`Target ${fmtPrice(m.tp)}  ${pct(m.tp-m.e)}`, slTxt=`Stop ${fmtPrice(m.sl)}  ${pct(m.sl-m.e)}`;
      label(ctx,cx, yt+(yt<ye?-13:13), tpTxt, "#16a34a", "#fff","center");
      label(ctx,cx, ys+(ys>ye?13:-13), slTxt, "#e11d48", "#fff","center");
      label(ctx,cx, ye, `${d.type==="long"?"Long":"Short"}  R:R 1 : ${fmtNum(m.rr,2)}`, "#1e293b", "#e6ebf5","center");
      break; }
    case "measure": { const [a,b]=P; const up=d.pts[1].p>=d.pts[0].p; const col=up?"#7c9cff":"#f0506e";
      const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y), w=Math.abs(b.x-a.x), h=Math.abs(b.y-a.y);
      ctx.fillStyle=hexA(col,.16); ctx.fillRect(x,y,w,h); ctx.strokeStyle=col; ctx.lineWidth=1;
      lineSeg(ctx,{x:a.x,y:(a.y+b.y)/2},{x:b.x,y:(a.y+b.y)/2}); lineSeg(ctx,{x:(a.x+b.x)/2,y:a.y},{x:(a.x+b.x)/2,y:b.y});
      const dp=d.pts[1].p-d.pts[0].p, bars=Math.round(timeToLogical(d.pts[1].t)-timeToLogical(d.pts[0].t)), dt=Math.abs(d.pts[1].t-d.pts[0].t);
      label(ctx,(a.x+b.x)/2, up? y-24 : y+h+24, `${dp>=0?"+":""}${fmtPrice(dp)} (${fmtPct(dp/d.pts[0].p*100)})\n${Math.abs(bars)} bar · ${fmtDur(dt)}`, col, "#fff","center");
      break; }
    case "text": { const a=P[0]; ctx.font="700 14px system-ui,Roboto,sans-serif"; ctx.textBaseline="middle"; ctx.textAlign="left"; ctx.fillStyle=c;
      const t=d.text||"Teks"; ctx.lineWidth=3; ctx.strokeStyle="rgba(11,15,23,.85)"; ctx.strokeText(t,a.x,a.y); ctx.fillText(t,a.x,a.y); break; }
  }
}
function dotFill(ctx,a,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(a.x,a.y,3,0,Math.PI*2); ctx.fill(); }
function channelOff(d){ const [p0,p1,p2]=d.pts; const l0=timeToLogical(p0.t), l1=timeToLogical(p1.t), l2=timeToLogical(p2.t); const f = l1===l0? 0 : (l2-l0)/(l1-l0); return p2.p - (p0.p + (p1.p-p0.p)*f); }

function handles(d){
  const H=[]; const P=d.pts.map(pp);
  const add=(pt,set)=>{ if(pt&&pt.x!=null&&pt.y!=null) H.push({x:pt.x,y:pt.y,set}); };
  switch(d.type){
    case "hline": case "alert": { const y=Y(d.pts[0].p); add({x:chart.timeScale().width()*0.5,y}, p=>{ d.pts[0].p=p.p; }); break; }
    case "vline": { const x=X(d.pts[0].t); add({x,y:paneH()*0.5}, p=>{ d.pts[0].t=p.t; }); break; }
    case "long": case "short": {
      const x1=X(d.pts[0].t), x2=X(d.pts[1].t);
      add({x:x1,y:Y(d.pts[0].p)}, p=>{ d.pts[0].p=p.p; d.pts[0].t=p.t; });
      add({x:x1,y:Y(d.pts[1].p)}, p=>{ d.pts[1].p=p.p; });
      add({x:x1,y:Y(d.pts[2].p)}, p=>{ d.pts[2].p=p.p; });
      add({x:x2,y:Y(d.pts[0].p)}, p=>{ d.pts[1].t=p.t; d.pts[2].t=p.t; });
      break; }
    default: P.forEach((pt,i)=>add(pt, p=>{ d.pts[i]={t:p.t,p:p.p}; }));
  }
  return H;
}
function render(){
  const dpr=window.devicePixelRatio||1; const ctx=ov.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,ov.width,ov.height);
  if(!state.bars.length) return;
  const W=chart.timeScale().width(), H=paneH();
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,H); ctx.clip();
  const list = state.pend? drawings.concat([state.pend.d]) : drawings;
  list.forEach(d=>{ try{ drawOne(ctx,d,d.id===state.sel); }catch(e){} });
  const s=selD() || (state.pend && state.pend.d);
  if(s){ handles(s).forEach(h=>{ ctx.fillStyle="#0b0f17"; ctx.strokeStyle="#e6ebf5"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(h.x,h.y,7,0,Math.PI*2); ctx.fill(); ctx.stroke(); }); }
  ctx.restore();
  // price-axis labels
  list.forEach(d=>{
    const c=d.c||DEF_COLOR[d.type];
    if(d.type==="hline"||d.type==="ray"){ const y=Y(d.pts[0].p); if(y!=null&&y>=0&&y<=H) axisLabel(ctx,y,fmtPrice(d.pts[0].p),c); }
    if(d.type==="alert"){ const y=Y(d.pts[0].p); if(y!=null&&y>=0&&y<=H) axisLabel(ctx,y,fmtPrice(d.pts[0].p),d.fired?"#2a3858":c,d.fired?"#cbd5e1":null); }
    if(d.id===state.sel && (d.type==="long"||d.type==="short")){ const m=posMetrics(d); [[m.tp,"#16a34a"],[m.e,"#475569"],[m.sl,"#e11d48"]].forEach(([p,col])=>{ const y=Y(p); if(y!=null&&y>=0&&y<=H) axisLabel(ctx,y,fmtPrice(p),col,"#fff"); }); }
  });
}

// ---------------- hit testing ----------------
function segDist(px,py,a,b){ const dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy; if(!L) return Math.hypot(px-a.x,py-a.y); let t=((px-a.x)*dx+(py-a.y)*dy)/L; t=Math.max(0,Math.min(1,t)); return Math.hypot(px-(a.x+t*dx), py-(a.y+t*dy)); }
function inBox(x,y,x1,y1,x2,y2,pad=0){ return x>=Math.min(x1,x2)-pad && x<=Math.max(x1,x2)+pad && y>=Math.min(y1,y2)-pad && y<=Math.max(y1,y2)+pad; }
function dist(d,x,y){
  const g=geo(d); if(!g) return Infinity; const {W,P}=g;
  switch(d.type){
    case "hline": case "alert": { const yy=Y(d.pts[0].p); return yy==null?Infinity:Math.abs(yy-y); }
    case "ray": { const a=P[0]; return x>=a.x-10? Math.abs(a.y-y) : Infinity; }
    case "vline": { const xx=X(d.pts[0].t); return xx==null?Infinity:Math.abs(xx-x); }
    case "trend": { const [a,b]=P; return segDist(x,y,a,d.ext?extendTo(a,b,W):b); }
    case "channel": { const [a,b]=P; let m=segDist(x,y,a,b); if(P[2]){ const off=channelOff(d); const a2={x:a.x,y:Y(d.pts[0].p+off)}, b2={x:b.x,y:Y(d.pts[1].p+off)}; m=Math.min(m,segDist(x,y,a2,b2)); const minX=Math.min(a.x,b.x), maxX=Math.max(a.x,b.x); if(x>=minX&&x<=maxX){ const f=(x-a.x)/((b.x-a.x)||1); const ya=a.y+(b.y-a.y)*f, yb=a2.y+(b2.y-a2.y)*f; if(y>=Math.min(ya,yb)&&y<=Math.max(ya,yb)) m=Math.min(m,12); } } return m; }
    case "rect": case "measure": { const [a,b]=P; return inBox(x,y,a.x,a.y,b.x,b.y)? 12 : Math.min(segDist(x,y,a,{x:b.x,y:a.y}),segDist(x,y,a,{x:a.x,y:b.y}),segDist(x,y,b,{x:b.x,y:a.y}),segDist(x,y,b,{x:a.x,y:b.y})); }
    case "fib": { const [a,b]=P; const x1=Math.min(a.x,b.x), x2=Math.max(a.x,b.x,x1+40); return inBox(x,y,x1,Y(fibPrice(d,0)),x2,Y(fibPrice(d,1)),4)? 12 : Infinity; }
    case "long": case "short": { const m=posMetrics(d); const x1=X(d.pts[0].t), x2=X(d.pts[1].t); const ys=[Y(m.sl),Y(m.tp),Y(m.e)]; return inBox(x,y,x1,Math.min(...ys),x2,Math.max(...ys),4)? 12 : Infinity; }
    case "text": { const a=P[0]; const ctx=ov.getContext("2d"); ctx.font="700 14px system-ui,Roboto,sans-serif"; const w=ctx.measureText(d.text||"Teks").width; return inBox(x,y,a.x,a.y-10,a.x+w,a.y+10,6)?0:Infinity; }
  }
  return Infinity;
}
function hitTest(x,y,tol=18){
  let best=null, bd=tol;
  for(let i=drawings.length-1;i>=0;i--){ const d=drawings[i]; const dd=dist(d,x,y); if(dd<bd){ bd=dd; best=d; } }
  return best;
}
function hitHandle(d,x,y){ const hs=handles(d); let bi=-1, bd=24; hs.forEach((h,i)=>{ const dd=Math.hypot(h.x-x,h.y-y); if(dd<bd){ bd=dd; bi=i; } }); return bi<0? null : hs[bi]; }

// ---------------- interaction ----------------
function posOf(e){ const r=ov.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }
function setOverlayActive(on){ ov.classList.toggle("active", !!on); }
function newDrawing(type, pt){
  const c = store.get("cx.col."+type, DEF_COLOR[type]);
  const d = {id:rid(), type, pts:[{t:pt.t,p:pt.p}], c, w:2};
  if(type==="trend") d.ext=false;
  if(type==="long"||type==="short"){
    const top=S().coordinateToPrice(0), bot=S().coordinateToPrice(paneH()); const range=Math.abs((top||pt.p*1.02)-(bot||pt.p*0.98));
    const risk = range*0.07, sgn = type==="long"? 1 : -1;
    const t2 = logicalToTime(pt.l + 22);
    d.pts=[{t:pt.t,p:pt.p},{t:t2,p:pt.p - sgn*risk},{t:t2,p:pt.p + sgn*risk*2}];
  }
  if(type==="alert"){ const last=state.bars[state.bars.length-1].close; d.dir = pt.p>=last? "up":"down"; d.c=DEF_COLOR.alert; }
  return d;
}
function commit(d){ pushUndo(); drawings.push(d); saveDrawings(); }
function finishCreate(){
  const d = state.pend.d; state.pend=null;
  if(d.type==="text"){ setTimeout(()=>askText("Tulis teks", "", t=>{ if(!t) { requestDraw(); return; } d.text=t; commit(d); select(d.id); }), 320); setToolUI(null); return; }
  commit(d);
  if(d.type==="alert"){ armAlerts(); toast(`Alert dipasang di ${fmtPrice(d.pts[0].p)} (jalan selama halaman terbuka)`); }
  setToolUI(null); select(d.id);
}
ov.addEventListener("pointerdown", e=>{
  e.preventDefault(); try{ ov.setPointerCapture(e.pointerId); }catch(_){}
  const {x,y}=posOf(e);
  if(state.tool){
    let pt=fromXY(x,y); if(!pt) return; pt=snap(pt,x,y);
    if(!state.pend){
      state.pend={d:newDrawing(state.tool,pt), placed:1, first:true, sx:x, sy:y, down:true, dragged:false};
      if(NEED[state.tool]===1){ finishCreate(); return; }
      setHint(state.tool==="channel"? "Geser/ketuk titik kedua" : "Geser atau ketuk titik kedua");
    } else { state.pend.d.pts[state.pend.placed]={t:pt.t,p:pt.p}; state.pend.down=true; state.pend.sx=x; state.pend.sy=y; state.pend.dragged=false; }
    requestDraw(); return;
  }
  const s=selD();
  if(s){ const h=hitHandle(s,x,y); if(h){ state.drag={kind:"handle",h,snap:JSON.stringify(drawings),moved:false}; return; } }
  const hit=hitTest(x,y);
  if(hit){ select(hit.id); const p0=fromXY(x,y); state.drag={kind:"move",d:hit,p0,orig:JSON.parse(JSON.stringify(hit.pts)),snap:JSON.stringify(drawings),moved:false}; return; }
  select(null);
});
ov.addEventListener("pointermove", e=>{
  const {x,y}=posOf(e);
  if(state.pend && state.pend.down){
    let pt=fromXY(x,y); if(!pt) return; pt=snap(pt,x,y);
    if(Math.hypot(x-state.pend.sx,y-state.pend.sy)>8) state.pend.dragged=true;
    state.pend.d.pts[state.pend.placed]={t:pt.t,p:pt.p}; requestDraw(); return;
  }
  const dr=state.drag; if(!dr) return;
  let pt=fromXY(x,y); if(!pt) return;
  if(dr.kind==="handle"){ pt=snap(pt,x,y); dr.h.set(pt); }
  else { const dl=pt.l-dr.p0.l, dp=pt.p-dr.p0.p; dr.d.pts=dr.orig.map(o=>({t: dr.d.type==="hline"||dr.d.type==="alert"? o.t : logicalToTime(timeToLogical(o.t)+dl), p: dr.d.type==="vline"? o.p : o.p+dp})); }
  if(!dr.moved){ dr.moved=true; undoStack.push(dr.snap); }
  requestDraw();
});
function pointerEnd(){
  if(state.pend){
    const p=state.pend; if(!p.down) return; p.down=false;
    if(p.first && !p.dragged){ p.d.pts.length=1; }
    else p.placed++;
    p.first=false; p.dragged=false;
    if(p.placed>=NEED[p.d.type]) finishCreate();
    else if(p.placed===2 && p.d.type==="channel") setHint("Ketuk buat atur lebar channel");
    requestDraw(); return;
  }
  if(state.drag){ const dr=state.drag; state.drag=null; if(dr.moved){ const d=selD(); if(d&&d.type==="alert"){ d.fired=false; const last=state.bars[state.bars.length-1].close; d.dir=d.pts[0].p>=last?"up":"down"; } saveDrawings(); } showSel(); requestDraw(); }
}
ov.addEventListener("pointerup", pointerEnd);
ov.addEventListener("pointercancel", pointerEnd);
let tapStart=null;
mainWrap.addEventListener("pointerdown", e=>{ if(ov.classList.contains("active")||e.target.closest("#toolbar,#selBar")) { tapStart=null; return; } const r=ov.getBoundingClientRect(); tapStart={x:e.clientX-r.left,y:e.clientY-r.top,t:Date.now()}; }, true);
mainWrap.addEventListener("pointerup", e=>{ const s=tapStart; tapStart=null; if(!s||state.tool) return; const r=ov.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top; if(Math.hypot(x-s.x,y-s.y)>10 || Date.now()-s.t>500) return; if(x>chart.timeScale().width()||y>paneH()) return; const hit=hitTest(x,y); if(hit) select(hit.id); }, true);

function select(id){ state.sel=id; setOverlayActive(!!id || !!state.tool); showSel(); requestDraw(); }

// ---------------- toolbar ----------------
const TOOLS = [
  {k:"hline",l:"Garis horizontal (S/R)",svg:'<path d="M3 12h18"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'},
  {k:"ray",l:"Ray horizontal",svg:'<path d="M6 12h15"/><circle cx="6" cy="12" r="2.2" fill="currentColor"/>'},
  {k:"trend",l:"Garis tren",svg:'<path d="M5 19L19 5"/><circle cx="5" cy="19" r="2" fill="currentColor"/><circle cx="19" cy="5" r="2" fill="currentColor"/>'},
  {k:"channel",l:"Channel paralel",svg:'<path d="M3 15L15 5M9 19L21 9"/>'},
  {k:"vline",l:"Garis vertikal",svg:'<path d="M12 3v18"/>'},
  {k:"fib",l:"Fibonacci retracement",svg:'<path d="M3 5h18M3 10h18M3 14h18M3 19h18" opacity=".9"/><path d="M5 19L19 5" stroke-dasharray="2 2"/>'},
  {k:"rect",l:"Kotak / zona",svg:'<rect x="4" y="6" width="16" height="12" rx="1.5"/>'},
  {k:"long",l:"Posisi Long",svg:'<rect x="4" y="4" width="16" height="9" rx="1" fill="rgba(34,197,139,.35)" stroke="#22c58b"/><rect x="4" y="13" width="16" height="6" rx="1" fill="rgba(240,80,110,.35)" stroke="#f0506e"/>'},
  {k:"short",l:"Posisi Short",svg:'<rect x="4" y="4" width="16" height="6" rx="1" fill="rgba(240,80,110,.35)" stroke="#f0506e"/><rect x="4" y="10" width="16" height="9" rx="1" fill="rgba(34,197,139,.35)" stroke="#22c58b"/>'},
  {k:"measure",l:"Ukur harga",svg:'<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3"/>'},
  {k:"text",l:"Teks",svg:'<path d="M5 6h14M12 6v13"/>'},
  {k:"alert",l:"Alert harga",svg:'<path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5z"/><path d="M10 20h4"/>'}
];
const HINT = {hline:"Ketuk harga buat garis S/R",ray:"Ketuk titik awal ray",trend:"Ketuk/geser dari titik 1 ke titik 2",channel:"Geser garis dasar, lalu ketuk lebarnya",vline:"Ketuk waktu buat garis vertikal",fib:"Geser dari swing awal ke swing akhir",rect:"Geser dari sudut ke sudut",long:"Ketuk harga entry",short:"Ketuk harga entry",measure:"Geser dari titik awal ke titik akhir",text:"Ketuk tempat teks",alert:"Ketuk harga alert"};
function buildToolbar(){
  const tb=$("#toolbar");
  $("#tbToggle").innerHTML = icon('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>');
  const html = TOOLS.map(t=>`<button class="tb" data-tool="${t.k}" aria-label="${t.l}">${icon(t.svg)}</button>`).join("")
   + `<div class="sep"></div>`
   + `<button class="tb" id="tbMagnet" aria-label="Magnet">${icon('<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 8h3M15 8h3"/>')}</button>`
   + `<button class="tb" id="tbUndo" aria-label="Undo">${icon('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>')}</button>`
   + `<button class="tb danger" id="tbClear" aria-label="Hapus semua gambar">${icon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')}</button>`;
  tb.insertAdjacentHTML("beforeend", html);
  if(store.get("cx.tb",false)) tb.classList.remove("collapsed");
  $("#tbToggle").addEventListener("click",()=>{ tb.classList.toggle("collapsed"); store.set("cx.tb",!tb.classList.contains("collapsed")); if(tb.classList.contains("collapsed")) setToolUI(null); });
  $$(".tb[data-tool]").forEach(b=>b.addEventListener("click",()=>setToolUI(state.tool===b.dataset.tool? null : b.dataset.tool)));
  $("#tbMagnet").addEventListener("click",()=>toggleMagnet());
  $("#tbUndo").addEventListener("click",undo);
  $("#tbClear").addEventListener("click",clearAll);
  syncMagnet();
}
function toggleMagnet(){ state.magnet=!state.magnet; store.set("cx.magnet",state.magnet); syncMagnet(); toast(state.magnet?"Magnet ON: nempel ke O/H/L/C candle":"Magnet OFF"); }
function syncMagnet(){ const b=$("#tbMagnet"); if(b) b.classList.toggle("on",state.magnet); }
function clearAll(){ if(!drawings.length){ toast("Belum ada gambar di "+cur().name); return; } if(confirm(`Hapus semua ${drawings.length} gambar di ${cur().name}?`)){ pushUndo(); drawings=[]; saveDrawings(); select(null); toast("Semua gambar dihapus (bisa Undo)"); } }
function setToolUI(t){
  state.tool=t; state.pend=null;
  if(t) state.sel=null;
  $$(".tb[data-tool]").forEach(b=>b.classList.toggle("on", b.dataset.tool===t));
  setOverlayActive(!!t || !!state.sel); showSel();
  if(t){ setHint(HINT[t]); } else hideHint();
  requestDraw();
}
function cancelTool(){ if(state.tool||state.pend) setToolUI(null); }

// ---------------- selection bar ----------------
function showSel(){
  const bar=$("#selBar"); const d=selD();
  if(!d || state.tool){ bar.classList.remove("show"); return; }
  const colorable = !["long","short","fib","measure","alert"].includes(d.type);
  let h = colorable? PALETTE.map(c=>`<button class="sw6${(d.c||"").toLowerCase()===c?" on":""}" data-col="${c}" style="background:${c}" aria-label="Warna"></button>`).join("") : "";
  if(["hline","ray","trend","channel","vline","rect"].includes(d.type)) h += `<button class="sb" data-act="w">${d.w||2}px</button>`;
  if(d.type==="trend") h += `<button class="sb${d.ext?" on":""}" data-act="ext" aria-label="Perpanjang">${icon('<path d="M4 18L14 8"/><path d="M14 8l6-6" stroke-dasharray="2 2"/>')}</button>`;
  if(d.type==="text") h += `<button class="sb" data-act="edit">Edit</button>`;
  if(d.type==="long"||d.type==="short"){ const m=posMetrics(d); h += `<span style="font-size:12px;color:var(--muted);padding:0 6px;white-space:nowrap">R:R <b style="color:var(--text)">1:${fmtNum(m.rr,2)}</b></span><button class="sb" data-act="flip">${d.type==="long"?"→ Short":"→ Long"}</button>`; }
  if(d.type==="alert") h += `<span style="font-size:12px;color:var(--muted);padding:0 6px;white-space:nowrap">${d.fired?"Sudah kena":"Aktif"} · ${fmtPrice(d.pts[0].p)}</span>`;
  h += `<button class="sb" data-act="dup" aria-label="Duplikat">${icon('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>')}</button>`;
  h += `<button class="sb del" data-act="del" aria-label="Hapus">${icon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')}</button>`;
  bar.innerHTML=h; bar.classList.add("show");
}
$("#selBar").addEventListener("click",e=>{
  const d=selD(); if(!d) return;
  const c=e.target.closest("[data-col]"); if(c){ pushUndo(); d.c=c.dataset.col; store.set("cx.col."+d.type,d.c); saveDrawings(); showSel(); requestDraw(); return; }
  const a=e.target.closest("[data-act]"); if(!a) return; const act=a.dataset.act;
  if(act==="del"){ pushUndo(); drawings=drawings.filter(x=>x.id!==d.id); saveDrawings(); select(null); toast("Gambar dihapus (bisa Undo)"); return; }
  pushUndo();
  if(act==="w"){ d.w = (d.w||2)>=4? 1 : (d.w||2)+1; }
  if(act==="ext"){ d.ext=!d.ext; }
  if(act==="flip"){ d.type = d.type==="long"?"short":"long"; const e0=d.pts[0].p; d.pts[1].p = 2*e0-d.pts[1].p; d.pts[2].p = 2*e0-d.pts[2].p; }
  if(act==="dup"){ const n=JSON.parse(JSON.stringify(d)); n.id=rid(); const dp=(S().coordinateToPrice(0)-S().coordinateToPrice(30))||0; n.pts=n.pts.map(p=>({t:p.t,p:p.p-dp})); drawings.push(n); saveDrawings(); select(n.id); return; }
  if(act==="edit"){ undoStack.pop(); askText("Edit teks", d.text||"", t=>{ if(t){ pushUndo(); d.text=t; saveDrawings(); requestDraw(); } }); return; }
  saveDrawings(); showSel(); requestDraw();
});

// ---------------- hint / toast ----------------
let toastT=null;
function setHint(m){ const h=$("#hint"); h.textContent=m; h.style.display="block"; clearTimeout(toastT); }
function hideHint(){ $("#hint").style.display="none"; }
function toast(m){ const h=$("#hint"); h.textContent=m; h.style.display="block"; clearTimeout(toastT); toastT=setTimeout(()=>{ if(state.tool) h.textContent=HINT[state.tool]; else h.style.display="none"; },2200); }

// ---------------- text dialog ----------------
let txtCb=null;
function askText(title, val, cb, note=""){ $("#txtTitle").textContent=title; $("#txtInput").value=val; $("#txtNote").textContent=note; txtCb=cb; $("#dlgText").showModal(); setTimeout(()=>$("#txtInput").focus(),50); }
function txtDone(ok){ const cb=txtCb; txtCb=null; $("#dlgText").close(); if(cb) cb(ok? $("#txtInput").value.trim() : ""); }
$("#txtOk").addEventListener("click",()=>txtDone(true));
$("#txtInput").addEventListener("keydown",e=>{ if(e.key==="Enter") txtDone(true); });
$("#dlgText").addEventListener("close",()=>{ if(txtCb){ const cb=txtCb; txtCb=null; cb(""); } });

// ---------------- alerts ----------------
let audioCtx=null;
function armAlerts(){
  try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==="suspended") audioCtx.resume(); }catch(e){}
  try{ if("Notification" in window && Notification.permission==="default") Notification.requestPermission(); }catch(e){}
}
function beep(){ try{ if(!audioCtx) return; const t=audioCtx.currentTime; [0,0.22,0.44].forEach(o=>{ const g=audioCtx.createGain(), osc=audioCtx.createOscillator(); osc.type="sine"; osc.frequency.value=880; g.gain.setValueAtTime(0.0001,t+o); g.gain.exponentialRampToValueAtTime(0.3,t+o+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+o+0.18); osc.connect(g).connect(audioCtx.destination); osc.start(t+o); osc.stop(t+o+0.2); }); }catch(e){} }
function checkAlerts(prev, now){
  let hit=false;
  drawings.forEach(d=>{ if(d.type!=="alert"||d.fired) return; const p=d.pts[0].p;
    if((d.dir==="up" && now>=p && prev<p) || (d.dir==="down" && now<=p && prev>p)){ d.fired=true; hit=true;
      const msg=`${cur().name} ${d.dir==="up"?"naik ke":"turun ke"} ${fmtPrice(p)} (sekarang ${fmtPrice(now)})`;
      toast("Alert: "+msg); beep(); if(navigator.vibrate) try{navigator.vibrate([200,100,200])}catch(e){}
      try{ if("Notification" in window && Notification.permission==="granted") new Notification("Alert harga", {body:msg}); }catch(e){}
    } });
  if(hit){ saveDrawings(); showSel(); requestDraw(); }
}

// ---------------- symbol picker ----------------
let symCat = (()=>{ const s=state.id; if(s.startsWith("fx:")) return "forex"; if(s.startsWith("hl:")){ const f=Object.keys(CAT).find(k=>CAT[k].some(x=>x.id===s)); return f||"saham"; } if(s==="bn:PAXGUSDT") return "komoditas"; return "crypto"; })();
let bnList=null, hlList=null;
async function getBnList(){
  if(bnList) return bnList;
  const c=store.get("cx.bnlist",null); if(c && Date.now()-c.t<86400000){ bnList=c.l; return bnList; }
  for(const host of BINANCE){ try{ const d=await fetchJSON(`${host}/api/v3/ticker/price`,{},9000); bnList=d.map(x=>x.symbol).filter(s=>/USDT$/.test(s)&&s.length>4).sort(); store.set("cx.bnlist",{t:Date.now(),l:bnList}); return bnList; }catch(e){} }
  return null;
}
async function getHlList(){
  if(hlList) return hlList;
  try{ const d=await fetchJSON(HL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"perpDexs"})}); hlList=[]; d.filter(Boolean).forEach(x=>(x.assetToStreamingOiCap||[]).forEach(a=>hlList.push(a[0]))); }catch(e){ hlList=[]; }
  return hlList;
}
function symBtn(id){ const i=info(id); const m=NAMES[id]||{}; const sub = m.d || (i.src==="bn"? "Binance" : i.src==="fx"? "harian" : i.code.split(":")[0]==="xyz"? "Hyperliquid" : "HL · "+i.code.split(":")[0]); return `<button class="sym${id===state.id?" cur":""}" data-sym="${id}">${i.name}<small>${sub}</small></button>`; }
function renderSymGrid(){
  $$("#symTabs .tab").forEach(t=>t.classList.toggle("on",t.dataset.cat===symCat));
  $("#search").placeholder = {crypto:"Cari koin, contoh: DOGE",forex:"Cari, contoh: EUR",saham:"Cari ticker saham AS, contoh: AMD",komoditas:"Cari, contoh: GOLD"}[symCat];
  const q=$("#search").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  let html="";
  if(!q){ html = CAT[symCat].map(x=>x.h? `<div class="gh">${x.h}</div>` : symBtn(x.id)).join(""); }
  else {
    const own = CAT[symCat].filter(x=>x.id && (info(x.id).name.toUpperCase().replace(/[^A-Z0-9]/g,"").includes(q) || x.id.toUpperCase().includes(q) || (x.d||"").toUpperCase().includes(q))).map(x=>x.id);
    let extra=[];
    if(symCat==="crypto" && bnList) extra = bnList.filter(s=>s.startsWith(q)).slice(0,30).map(s=>"bn:"+s);
    if(symCat!=="crypto" && hlList) extra = hlList.filter(s=>s.split(":")[1].startsWith(q)).slice(0,30).map(s=>"hl:"+s);
    const ids=[...new Set(own.concat(extra))];
    html = ids.length? ids.map(symBtn).join("") : `<div class="gh">Nggak ketemu "${q}"</div>`;
    if(symCat==="crypto" && !bnList && !own.length) html = `<button class="sym" data-sym="bn:${q}USDT">${q}/USDT<small>coba buka</small></button>`;
  }
  $("#symGrid").innerHTML=html; $("#catNote").textContent=CAT_NOTE[symCat]; $("#searchErr").textContent="";
}
$("#symBtn").addEventListener("click",()=>{ $("#search").value=""; renderSymGrid(); $("#dlgSym").showModal(); getBnList().then(()=>{ if($("#search").value) renderSymGrid(); }); getHlList(); });
$("#symTabs").addEventListener("click",e=>{ const t=e.target.closest("[data-cat]"); if(!t) return; symCat=t.dataset.cat; renderSymGrid(); });
$("#search").addEventListener("input",renderSymGrid);
$("#symGrid").addEventListener("click", async e=>{
  const b=e.target.closest("[data-sym]"); if(!b) return; const id=b.dataset.sym;
  $("#searchErr").textContent="Memuat…";
  const ok=await load(id, state.tf);
  if(ok && state.id===id) $("#dlgSym").close(); else $("#searchErr").textContent="Data pair ini gagal dimuat. Coba lagi atau pilih pair lain.";
});

// ---------------- indicators dialog ----------------
const IND_UI = [
  {k:"vol",n:"Volume",f:[]},
  {k:"ma1",n:"MA",f:["p"]},{k:"ma2",n:"MA",f:["p"]},
  {k:"ema1",n:"EMA",f:["p"]},{k:"ema2",n:"EMA",f:["p"]},
  {k:"bb",n:"Bollinger",f:["p","k"]},
  {k:"vwap",n:"VWAP",f:[],note:"intraday"},
  {k:"rsi",n:"RSI",f:["p"]},
  {k:"macd",n:"MACD",f:["f","s","g"]},
  {k:"stoch",n:"Stochastic",f:["k","d","sm"]}
];
function renderInd(){
  $("#indList").innerHTML = IND_UI.map(r=>`<div class="ind"><span class="nm"><span class="dot" style="background:${IND_COL[r.k]}"></span>${r.n}${r.note?` <small style="color:var(--muted);margin-left:4px">${r.note}</small>`:""}</span>${r.f.map(f=>`<input type="number" inputmode="decimal" min="1" max="500" step="${f==="k"&&r.k==="bb"?"0.5":"1"}" data-k="${r.k}" data-f="${f}" value="${state.ind[r.k][f]}">`).join("")}<button class="sw${state.ind[r.k].on?" on":""}" data-ind="${r.k}" aria-label="${r.n}"></button></div>`).join("")
   + `<div class="note">Angka = periode. RSI, MACD, Stochastic muncul di panel bawah chart.</div>`;
}
function indChanged(){ store.set("cx.ind2",state.ind); syncPanes(); layout(); computeIndicators(); const r=chart.timeScale().getVisibleLogicalRange(); if(r) PANE_ORDER.forEach(k=>{ if(panes[k]) panes[k].chart.timeScale().setVisibleLogicalRange(r); }); setTimeout(alignScales,60); }
$("#btnInd").addEventListener("click",()=>{ renderInd(); $("#dlgInd").showModal(); });
$("#indList").addEventListener("click",e=>{ const s=e.target.closest("[data-ind]"); if(!s) return; const k=s.dataset.ind; state.ind[k].on=!state.ind[k].on; s.classList.toggle("on",state.ind[k].on); indChanged(); });
$("#indList").addEventListener("change",e=>{ const i=e.target.closest("input[data-k]"); if(!i) return; let v=parseFloat(i.value); if(!isFinite(v)||v<=0){ i.value=state.ind[i.dataset.k][i.dataset.f]; return; } if(i.dataset.f!=="k"||i.dataset.k!=="bb") v=Math.round(v); v=Math.min(v,500); i.value=v; state.ind[i.dataset.k][i.dataset.f]=v; state.ind[i.dataset.k].on=true; renderInd(); indChanged(); });

// ---------------- more menu ----------------
function renderMore(){
  const fs = !!document.fullscreenElement;
  const nA = drawings.filter(d=>d.type==="alert"&&!d.fired).length;
  $("#moreList").innerHTML = [
    `<button class="mi" data-m="fs">${icon(fs?'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>':'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')}${fs?"Keluar layar penuh":"Layar penuh"}</button>`,
    `<button class="mi" data-m="shot">${icon('<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>')}Simpan gambar chart</button>`,
    `<button class="mi" data-m="mag">${icon('<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 8h3M15 8h3"/>')}Magnet O/H/L/C<span class="r">${state.magnet?"ON":"OFF"}</span></button>`,
    `<button class="mi" data-m="alert">${icon('<path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5z"/><path d="M10 20h4"/>')}Alert di harga sekarang<span class="r">${nA} aktif</span></button>`,
    `<button class="mi" data-m="reset">${icon('<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>')}Reset tampilan chart</button>`,
    `<button class="mi danger" data-m="clear">${icon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')}Hapus semua gambar ${cur().short}</button>`
  ].join("");
  $("#moreNote").innerHTML = `Gambar & alert disimpan di browser HP ini aja (beda Chrome/Mises = beda simpanan). Alert cuma bunyi selama halaman ini terbuka.<br>Data: Binance/OKX (crypto), Hyperliquid (saham AS, forex, komoditas), Frankfurter/ECB (kurs harian). Chart: <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noopener">TradingView Lightweight Charts</a> (Apache-2.0). Bukan saran keuangan.`;
}
$("#btnMore").addEventListener("click",()=>{ renderMore(); $("#dlgMore").showModal(); });
$("#moreList").addEventListener("click",e=>{
  const b=e.target.closest("[data-m]"); if(!b) return; const m=b.dataset.m; $("#dlgMore").close();
  if(m==="fs") toggleFS();
  if(m==="shot") screenshot();
  if(m==="mag") toggleMagnet();
  if(m==="clear") clearAll();
  if(m==="reset"){ const n=state.bars.length; chart.timeScale().setVisibleLogicalRange({from:Math.max(0,n-100),to:n+6}); chart.priceScale("right").applyOptions({autoScale:true}); }
  if(m==="alert"){ const last=state.bars[state.bars.length-1].close; askText("Alert harga", String(+last.toFixed(DEC)), t=>{ const p=parseFloat(String(t).replace(/\./g,"").replace(",",".")) ; const p2=parseFloat(t); const val = isFinite(p2)&&String(t).indexOf(",")<0? p2 : p; if(!isFinite(val)||val<=0) return; armAlerts(); const d=newDrawing("alert",{t:state.bars[state.bars.length-1].time,p:val,l:state.bars.length-1}); commit(d); toast(`Alert dipasang di ${fmtPrice(val)}`); requestDraw(); }, "Ketik harga. Bunyi + notifikasi pas harga nyentuh, selama halaman ini terbuka."); }
});
function toggleFS(){ const el=document.documentElement; try{ if(!document.fullscreenElement){ (el.requestFullscreen||el.webkitRequestFullscreen).call(el); } else { (document.exitFullscreen||document.webkitExitFullscreen).call(document); } }catch(e){ toast("Browser ini nggak dukung layar penuh"); } }
document.addEventListener("fullscreenchange",()=>setTimeout(layout,100));

async function screenshot(){
  try{
    cancelTool(); const prevSel=state.sel; state.sel=null; render();
    const shot=chart.takeScreenshot(); const sc=shot.width/(ov.width/(window.devicePixelRatio||1));
    const ps=PANE_ORDER.filter(k=>panes[k]).map(k=>panes[k].chart.takeScreenshot());
    const H=shot.height+ps.reduce((a,c)=>a+c.height,0);
    const cv=document.createElement("canvas"); cv.width=shot.width; cv.height=H; const ctx=cv.getContext("2d");
    ctx.fillStyle="#0b0f17"; ctx.fillRect(0,0,cv.width,H);
    ctx.drawImage(shot,0,0); ctx.drawImage(ov,0,0,shot.width,shot.height);
    let y=shot.height; ps.forEach(p=>{ ctx.drawImage(p,0,y); y+=p.height; });
    ctx.font=`700 ${Math.round(14*sc)}px system-ui,Roboto,sans-serif`; ctx.fillStyle="rgba(230,235,245,.9)"; ctx.textBaseline="top";
    ctx.fillText(`${cur().name} · ${tfObj().l} · ${new Date().toLocaleString("id-ID")}`, 12*sc, (shot.height-chart.timeScale().height()*sc)-22*sc);
    state.sel=prevSel; requestDraw();
    const blob=await new Promise(r=>cv.toBlob(r,"image/png"));
    const name=`chart-${cur().short}-${tfObj().k}-${Date.now()}.png`;
    const file=new File([blob],name,{type:"image/png"});
    if(navigator.canShare && navigator.canShare({files:[file]}) && !isTest){ try{ await navigator.share({files:[file],title:name}); return; }catch(e){ if(e&&e.name==="AbortError") return; } }
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast("Gambar chart disimpan");
    window.__lastShot = {w:cv.width,h:cv.height};
  }catch(e){ toast("Gagal bikin gambar: "+e.message); }
}

// ---------------- dialogs common ----------------
$$("[data-close]").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
$$("dialog").forEach(d=>{ new MutationObserver(()=>{ if(d.open) d._openedAt=Date.now(); }).observe(d,{attributes:true,attributeFilter:["open"]}); d.addEventListener("click",e=>{ if(e.target===d && Date.now()-(d._openedAt||0)>450) d.close(); }); });
document.addEventListener("visibilitychange",()=>{ if(!document.hidden && !state.ws && !state.poll && state.bars.length) startLive(state.loadId); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ cancelTool(); select(null); } if((e.ctrlKey||e.metaKey)&&e.key==="z") undo(); });

// ---------------- init ----------------
buildToolbar(); syncPanes(); renderTfBar(); applyType(false); layout();
window.__cx = {applyBar, checkAlerts, state, chart, S, fromXY, X, Y, timeToLogical, logicalToTime, drawings:()=>drawings, stored:()=>store.get(cur().key,[]), posMetrics, fibPrice, FIB, IV, panes, handles, hitTest, load, screenshot, select};
load(state.id, state.tf);
})();
