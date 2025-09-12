"use strict";

/* ========= CONFIG ========= */
const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
const SHEETS = [
  { label: "チャージ確定",   sheet: "チャージ確定" },
  { label: "チャージ早押し", sheet: "チャージ早押し" },
  { label: "企画確定",       sheet: "企画確定" },
  { label: "企画早押し",     sheet: "企画早押し" },
  { label: "NFT確定",        sheet: "NFT確定" },
  { label: "NFT早押し",      sheet: "NFT早押し" },
  { label: "挨拶確定",       sheet: "挨拶確定" },
  { label: "挨拶早押し②",    sheet: "挨拶早押し②" },
  { label: "挨拶早押し①",    sheet: "挨拶早押し①" }
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
  return (s||"")
    .replace(/\u200B/g,"")               // ゼロ幅スペース除去
    .normalize("NFKC").trim()
    .toLowerCase().replace(/^@/,"");
}

/* ===== CSVパーサ（引用符/カンマ対応） ===== */
function parseCSV(text){
  // BOM除去
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows=[]; let i=0, field="", row=[], inQ=false;
  const pushF=()=>{row.push(field);field="";};
  const pushR=()=>{rows.push(row);row=[];};
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){field+='"';i+=2;continue;} inQ=false;i++;continue; }
      field+=c;i++;continue;
    }else{
      if(c==='"'){inQ=true;i++;continue;}
      if(c===','){pushF();i++;continue;}
      if(c==='\r'){i++;continue;}
      if(c==='\n'){pushF();pushR();i++;continue;}
      field+=c;i++;
    }
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

/* ===== fetch: タイムアウト＋再試行 ===== */
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function fetchWithTimeout(url, timeoutMs){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), timeoutMs);
  try{ return await fetch(url, {cache:"no-store", signal:ctl.signal}); }
  finally{ clearTimeout(t); }
}
async function retryFetch(url, timeouts=[6000,8000,10000]){
  let lastErr;
  for(let i=0;i<timeouts.length;i++){
    try{
      const res = await fetchWithTimeout(url, timeouts[i]);
      if(!res.ok){
        // 429/5xx/403 は再試行、それ以外はそのまま返す
        if(res.status>=500 || res.status===429 || res.status===403) throw new Error("HTTP "+res.status);
        return res;
      }
      return res;
    }catch(e){
      lastErr = e;
      await sleep(400*(i+1));
    }
  }
  throw lastErr;
}

/* ===== 1タブずつ読み込み（安定化） ===== */
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
    try{ await fetchSheet(s.label, s.sheet); }
    catch(e){ console.error(e); failed.push(s.label); }
  }
  LOADED = true;
  if(failed.length){
    statusEl.textContent = `読込失敗: ${failed.join(", ")}（共有設定とシート名を確認）`;
  }else{
    statusEl.textContent = "";
    statusEl.style.display = "none";
  }
  // 読込完了後、未処理の検索を自動再実行
  if(pendingQuery) { const q=pendingQuery; pendingQuery=null; show(q, lookup(q)); }
  if(DEBUG){
    const box=document.createElement("div"); box.className="result"; box.style.marginTop="12px";
    const counts=SHEETS.map(s=>{let c=0; bySlug.forEach(set=>{ if(set.has(s.label)) c++; }); return `${s.label}: ${c}件`;}).join("\n");
    box.innerHTML=`<strong>DEBUG</strong><pre>${counts}</pre>`;
    ($(".card")||document.body).appendChild(box);
  }
}

/* ===== 検索・表示 ===== */
function lookup(q){
  const set = bySlug.get(norm(q)) || new Set();
  return ORDER.filter(l=>set.has(l));
}
function cat(l){ if(l.startsWith("チャージ"))return"charge"; if(l.startsWith("企画"))return"plan"; if(l.startsWith("NFT"))return"nft"; return"greet"; }
function tag(l){ return `<span class="tag"><span class="i ${cat(l)}"></span>${l}</span>`; }
function ensureOut(){
  return $("#out") || (()=>{const d=document.createElement("div");d.id="out";d.className="result";($(".card")||document.body).appendChild(d);return d;})();
}
function show(q, arr){
  const out=ensureOut();
  out.innerHTML = `<div><strong>照会:</strong> <code>${q}</code></div>` +
    (arr.length ? `<div class="tags">${arr.map(tag).join("")}</div>`
                : `<div class="tags"><span class="tag">該当なし。slugを確認。</span></div>`);
  out.style.display="block";
}
function go(){
  const inp=$("#q"); const q=(inp?inp.value:"").trim(); if(!q) return;
  if(!LOADED){ // ロード前に検索したら完了後に自動再実行
    pendingQuery = q;
    statusEl.textContent = "同期中… 完了後に検索を自動実行する";
    statusEl.style.display = "block";
    return;
  }
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
