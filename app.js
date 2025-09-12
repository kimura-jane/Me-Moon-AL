"use strict";

/* ========= CONFIG ========= */
// スプシのファイルID（そのまま）
const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

// シート名と表示ラベル（完全一致）
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
/* ========================= */

const bySlug = new Map();
const DEBUG = new URL(location.href).searchParams.get("debug") === "1";
let LOADED = false;

function norm(s){ return (s||"").normalize("NFKC").trim().toLowerCase().replace(/^@/,""); }

/* ===== CSVパーサ（引用符/カンマ対応、1列OK） ===== */
function parseCSV(text){
  const rows = [];
  let i=0, field="", row=[], inQ=false;
  const pushF=()=>{row.push(field);field="";};
  const pushR=()=>{rows.push(row);row=[];};
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c===`"`){
        if(text[i+1]==='"'){field+='"';i+=2;continue;}
        inQ=false;i++;continue;
      }
      field+=c;i++;continue;
    }else{
      if(c===`"`){inQ=true;i++;continue;}
      if(c===`,'){pushF();i++;continue;}
      if(c===`\r`){i++;continue;}
      if(c===`\n`){pushF();pushR();i++;continue;}
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
  let start = lower.includes("slug") ? 1 : 0;
  let idx   = lower.includes("slug") ? lower.indexOf("slug") : 0;
  const out=[];
  for(let r=start;r<rows.length;r++){
    const slug = (rows[r][idx]||"").trim();
    if(slug && slug.toLowerCase()!=="slug") out.push(slug);
  }
  return out;
}
/* =========================================== */

function add(slug,label){
  const k = norm(slug);
  if(!k) return;
  const cur = bySlug.get(k) || new Set();
  cur.add(label);
  bySlug.set(k, cur);
}

const sleep = (ms)=>new Promise(res=>setTimeout(res,ms));
async function retryFetch(url, tries=[400,800,1600]){
  let lastErr;
  for(let i=0;i<=tries.length;i++){
    try{
      const res = await fetch(url, {cache:"no-store"});
      if(res.ok) return res;
      // 429/5xx は再試行
      if(res.status>=500 || res.status===429 || res.status===403) throw new Error("HTTP "+res.status);
      return res; // 4xx他は即返す
    }catch(e){
      lastErr=e;
      if(i<tries.length) await sleep(tries[i]);
    }
  }
  throw lastErr;
}

async function fetchSheet(label, sheet){
  const url = GVIZ(sheet) + "&_t=" + Date.now();
  const r = await retryFetch(url);
  if(!r.ok) throw new Error(`${label} 読込失敗 HTTP ${r.status}`);
  const text = await r.text();
  rowsToSlugs(parseCSV(text)).forEach(s=>add(s,label));
}

async function loadAll(){
  const statusEl = document.getElementById("status");
  const btn = document.getElementById("go");
  const inp = document.getElementById("q");
  if(btn) btn.disabled = true;
  if(inp) inp.disabled = true;

  const failed=[];
  for(let i=0;i<SHEETS.length;i++){
    const s=SHEETS[i];
    try{
      if(statusEl){
        statusEl.style.display="block";
        statusEl.textContent=`同期中… ${i+1}/${SHEETS.length} 「${s.label}」`;
      }
      await fetchSheet(s.label, s.sheet);
    }catch(e){
      console.error(e);
      failed.push(s.label);
    }
  }
  LOADED=true;
  if(statusEl){
    if(failed.length){
      statusEl.textContent=`読込失敗: ${failed.join(", ")}（共有設定とシート名を確認）`;
      statusEl.style.display="block";
    }else{
      statusEl.style.display="none";
    }
  }
  if(btn) btn.disabled = false;
  if(inp) inp.disabled = false;

  // 入力済みなら自動再検索（ロード完了後の取りこぼし防止）
  if(inp && inp.value.trim()) go();

  // デバッグ出力
  if(DEBUG){
    const box=document.createElement("div");
    box.className="result";
    box.style.marginTop="12px";
    const counts=SHEETS.map(s=>{
      let c=0;
      bySlug.forEach(set=>{ if(set.has(s.label)) c++; });
      return `${s.label}: ${c}件`;
    }).join("\n");
    box.innerHTML=`<strong>DEBUG</strong><pre>${counts}</pre>`;
    (document.querySelector(".card")||document.body).appendChild(box);
  }
}

function lookup(q){
  const set = bySlug.get(norm(q)) || new Set();
  return ORDER.filter(l=>set.has(l));
}
function cat(l){ if(l.startsWith("チャージ"))return"charge"; if(l.startsWith("企画"))return"plan"; if(l.startsWith("NFT"))return"nft"; return"greet"; }
function tag(l){ return `<span class="tag"><span class="i ${cat(l)}"></span>${l}</span>`; }
function ensureOut(){
  return document.getElementById("out") || (()=>{const d=document.createElement("div");d.id="out";d.className="result";(document.querySelector(".card")||document.body).appendChild(d);return d;})();
}
function show(q, arr){
  const out=ensureOut();
  out.innerHTML = `<div><strong>照会:</strong> <code>${q}</code></div>` +
    (arr.length ? `<div class="tags">${arr.map(tag).join("")}</div>`
                : `<div class="tags"><span class="tag">該当なし。slugを確認。</span></div>`);
  out.style.display="block";
}
function go(){
  const inp=document.getElementById("q");
  const q=(inp?inp.value:"").trim();
  if(!q) return;
  show(q, lookup(q));
  const u=new URL(location.href); u.searchParams.set("q", q); history.replaceState(null,"",u.toString());
}

document.addEventListener("DOMContentLoaded", async ()=>{
  // リスナーは先に張るが、ロード完了までボタン/入力を無効化
  const btn=document.getElementById("go");
  if(btn) btn.addEventListener("click", go);
  const inp=document.getElementById("q");
  if(inp){
    inp.addEventListener("keydown", e=>{ if(e.key==="Enter") go(); });
    inp.setAttribute("autocapitalize","none");
    inp.setAttribute("autocorrect","off");
    inp.setAttribute("spellcheck","false");
  }
  await loadAll();
  const init = new URL(location.href).searchParams.get("q");
  if(init && inp){ inp.value=init; go(); }
});
