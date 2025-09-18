"use strict";

/* ========= CONFIG ========= */
const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
const SHEETS = [
  { label: "チャージAL①",         sheet: "チャージAL①" },
  { label: "チャージAL②",         sheet: "チャージAL②" },
  { label: "NFTコラボAL①",        sheet: "NFTコラボAL①" },
  { label: "NFTコラボAL②",        sheet: "NFTコラボAL②" },
  { label: "ギルドミッションAL①", sheet: "ギルドミッションAL①" },
  { label: "ギルドミッションAL②", sheet: "ギルドミッションAL②" },
  { label: "挨拶タップAL①",       sheet: "挨拶タップAL①" },
  { label: "挨拶タップAL②",       sheet: "挨拶タップAL②" }
];
const ORDER = SHEETS.map(s => s.label);
const GVIZ = (name) =>
  `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
const DEBUG = new URL(location.href).searchParams.get("debug") === "1";
/* ========================= */

const bySlug = new Map();
let LOADED = false;
let pendingQuery = null;

const $ = (q)=>document.querySelector(q);
const statusEl = $("#status") || (()=>{const d=document.createElement("div");d.id="status";d.style.cssText="margin-top:8px;color:#fca5a5;font-size:12px;";($(".card")||document.body).prepend(d);return d;})();

function norm(s){
  return (s||"").replace(/\u200B/g,"").normalize("NFKC").trim().toLowerCase().replace(/^@/,"");
}

/* ===== CSVパーサ ===== */
function parseCSV(text){
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows=[]; let i=0, field="", row=[], inQ=false;
  const pushF=()=>{row.push(field);field="";}; const pushR=()=>{rows.push(row);row=[];};
  while(i<text.length){
    const c=text[i];
    if(inQ){ if(c==='"'){ if(text[i+1]==='"'){field+='"';i+=2;continue;} inQ=false;i++;continue; }
             field+=c;i++;continue; }
    if(c==='"'){inQ=true;i++;continue;}
    if(c===','){pushF();i++;continue;}
    if(c==='\r'){i++;continue;}
    if(c==='\n'){pushF();pushR();i++;continue;}
    field+=c;i++;
  }
  pushF();pushR();
  return rows.filter(r=>r.length && r.join("").trim()!=="");
}
function rowsToSlugs(rows){
  if(rows.length===0) return [];
  const first = rows[0].map(s=>(s||"").trim());
  const lower = first.map(s=>s.toLowerCase());
  const hasHeader = lower.includes("slug");
  const idx = hasHeader ? lower.indexOf("slug") : 0;
  const start = hasHeader ? 1 : 0;
  const out=[];
  for(let r=start;r<rows.length;r++){
    const slug=(rows[r][idx]||"").trim();
    if(slug && slug.toLowerCase()!=="slug") out.push(slug);
  }
  return out;
}
function add(slug,label){
  const k=norm(slug); if(!k) return;
  const cur=bySlug.get(k)||new Set(); cur.add(label); bySlug.set(k,cur);
}

/* ===== fetch（タイムアウト＋再試行） ===== */
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function fetchWithTimeout(url, ms){
  const ctl = new AbortController(); const t=setTimeout(()=>ctl.abort(), ms);
  try{ return await fetch(url, {cache:"no-store", signal:ctl.signal}); } finally{ clearTimeout(t); }
}
async function retryFetch(url, timeouts=[6000,8000,10000]){
  let lastErr;
  for(let i=0;i<timeouts.length;i++){
    try{
      const res = await fetchWithTimeout(url, timeouts[i]);
      if(!res.ok){ if(res.status>=500||res.status===429||res.status===403) throw new Error("HTTP "+res.status); return res; }
      return res;
    }catch(e){ lastErr=e; await sleep(400*(i+1)); }
  }
  throw lastErr;
}

/* ===== 読み込み ===== */
async function fetchSheet(label, sheet){
  const url = GVIZ(sheet) + "&_t=" + Date.now();
  const r = await retryFetch(url);
  if(!r.ok) throw new Error(`${label} 読込失敗 HTTP ${r.status}`);
  const text = await r.text();
  rowsToSlugs(parseCSV(text)).forEach(s=>add(s,label));
}
async function loadAll(){
  const failed=[];
  for(let i=0;i<SHEETS.length;i++){
    const s=SHEETS[i];
    statusEl.textContent = `同期中… ${i+1}/${SHEETS.length} 「${s.label}」`;
    try{ await fetchSheet(s.label, s.sheet); } catch(e){ console.error(e); failed.push(s.label); }
  }
  LOADED = true;
  if(failed.length){ statusEl.textContent = `読込失敗: ${failed.join(", ")}（共有設定とシート名を確認）`; }
  else { statusEl.textContent=""; statusEl.style.display="none"; }
  if(pendingQuery){ const q=pendingQuery; pendingQuery=null; show(q, lookup(q)); }

  if(DEBUG){
    const box=document.createElement("div"); box.className="result"; box.style.marginTop="12px";
    const counts=SHEETS.map(s=>{let c=0; bySlug.forEach(set=>{ if(set.has(s.label)) c++; }); return `${s.label}: ${c}件`;}).join("\n");
    box.innerHTML=`<strong>DEBUG</strong><pre>${counts}</pre>`;
    ($(".card")||document.body).appendChild(box);
  }
}

/* ===== 検索・表示（カテゴリごとに横配置） ===== */
function catFromTitle(title){
  if(title.startsWith("チャージ")) return "charge";
  if(title.startsWith("NFT")) return "nft";
  if(title.startsWith("ギルド")) return "guild";
  return "greet";
}
function lookup(q){
  const set = bySlug.get(norm(q)) || new Set();
  return ORDER.filter(l=>set.has(l));
}
const TITLE_ORDER = ["チャージ","NFTコラボ","ギルドミッション","挨拶タップ"];

function groupLabels(labels){
  // ラベル例: 「チャージAL①」
  const map = new Map(); // title -> {cat, chips:Set("AL①",…)}
  for(const l of labels){
    const m = l.match(/^(.*?)(AL[①②])$/); // タイトル と AL①/AL②
    if(!m) continue;
    const title = m[1];
    const chip  = m[2];
    const entry = map.get(title) || { cat: catFromTitle(title), chips: new Set() };
    entry.chips.add(chip);
    map.set(title, entry);
  }
  return map;
}
function renderGroups(q, labels){
  const groups = groupLabels(labels);
  const orderedTitles = TITLE_ORDER.filter(t=>groups.has(t));
  if(orderedTitles.length===0){
    return `<div><strong>照会:</strong> <code>${q}</code></div>
            <div class="groups"><div class="chip">該当なし。slugを確認。</div></div>`;
  }
  const html = orderedTitles.map(t=>{
    const {cat, chips} = groups.get(t);
    const chipsHtml = Array.from(chips).sort().map(c=>`<span class="chip">${c}</span>`).join("");
    return `<div class="group">
              <div class="group-head"><span class="i ${cat}"></span><span class="group-title">${t}</span></div>
              <div class="chips">${chipsHtml}</div>
            </div>`;
  }).join("");
  return `<div><strong>照会:</strong> <code>${q}</code></div><div class="groups">${html}</div>`;
}
function ensureOut(){
  return $("#out") || (()=>{const d=document.createElement("div");d.id="out";d.className="result";($(".card")||document.body).appendChild(d);return d;})();
}
function show(q, arr){
  const out=ensureOut();
  out.innerHTML = renderGroups(q, arr);
  out.style.display="block";
}
function go(){
  const inp=$("#q"); const q=(inp?inp.value:"").trim(); if(!q) return;
  if(!LOADED){ pendingQuery=q; statusEl.textContent="同期中… 完了後に検索を自動実行する"; statusEl.style.display="block"; return; }
  show(q, lookup(q));
  const u=new URL(location.href); u.searchParams.set("q", q); history.replaceState(null,"",u.toString());
}

/* ===== 起動 ===== */
document.addEventListener("DOMContentLoaded", async ()=>{
  $("#go")?.addEventListener("click", go);
  const inp=$("#q");
  if(inp){
    inp.addEventListener("keydown", e=>{ if(e.key==="Enter") go(); });
    inp.setAttribute("autocapitalize","none");
    inp.setAttribute("autocorrect","off");
    inp.setAttribute("spellcheck","false");
  }
  await loadAll();
  const init=new URL(location.href).searchParams.get("q");
  if(init && inp){ inp.value=init; go(); }
});
