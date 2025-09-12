"use strict";

/* ========= CONFIG ========= */
// スプレッドシートのファイルID（そのまま）
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

function norm(s){ return (s||"").normalize("NFKC").trim().toLowerCase().replace(/^@/,""); }

/* --- 厳密CSVパーサ（引用符/カンマ対応、1列でもOK） --- */
function parseCSV(text){
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rows.push(row); row = []; };
  while (i < text.length){
    const c = text[i];
    if (inQuotes){
      if (c === '"'){
        if (text[i+1] === '"'){ field += '"'; i += 2; continue; } // エスケープ
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }else{
      if (c === '"'){ inQuotes = true; i++; continue; }
      if (c === ","){ pushField(); i++; continue; }
      if (c === "\r"){ i++; continue; }
      if (c === "\n"){ pushField(); pushRow(); i++; continue; }
      field += c; i++;
    }
  }
  pushField(); pushRow();
  // 末尾空行の除去
  return rows.filter(r => r.length && r.join("").trim() !== "");
}

/* --- 1行目がヘッダでもデータでもOK。slug列を決めて読む --- */
function rowsToSlugs(rows){
  if (rows.length === 0) return [];
  const first = rows[0].map(s => (s||"").trim());
  let start = 0, idx = 0;
  const lower = first.map(s => s.toLowerCase());
  if (lower.includes("slug")){ idx = lower.indexOf("slug"); start = 1; }
  const out = [];
  for (let r = start; r < rows.length; r++){
    const slug = (rows[r][idx] || "").trim();
    if (slug && slug.toLowerCase() !== "slug") out.push(slug);
  }
  return out;
}

/* --- インデックス作成 --- */
function add(slug, label){
  const k = norm(slug);
  if (!k) return;
  const cur = bySlug.get(k) || new Set();
  cur.add(label);
  bySlug.set(k, cur);
}

async function fetchSheet(label, sheet){
  const url = GVIZ(sheet) + "&_t=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${label} 読込失敗 HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  const slugs = rowsToSlugs(rows);
  slugs.forEach(s => add(s, label));
  return { label, count: slugs.length, sample: slugs.slice(0, 5) };
}

async function loadAll(){
  const statusEl = document.getElementById("status");
  const results = [];
  const failed = [];

  for (const s of SHEETS){ // 直列：Google側の同時接続制限を避ける
    try{
      const info = await fetchSheet(s.label, s.sheet);
      results.push(info);
    }catch(e){
      console.error(e);
      failed.push(s.label);
    }
  }

  if (DEBUG){
    const box = document.createElement("div");
    box.className = "result";
    box.style.marginTop = "12px";
    box.innerHTML = `<strong>DEBUG</strong><br>
      読み込み結果: <pre>${results.map(r => `${r.label}: ${r.count}件 (${r.sample.join(", ")||"-"})`).join("\n")}</pre>
      失敗: ${failed.length ? failed.join(", ") : "なし"}`;
    (document.querySelector(".card")||document.body).appendChild(box);
  }

  if (failed.length && statusEl){
    statusEl.textContent = `読込失敗: ${failed.join(", ")}（共有設定とシート名を確認）`;
    statusEl.style.display = "block";
  }
}

/* --- 検索/表示 --- */
function lookup(q){
  const set = bySlug.get(norm(q)) || new Set();
  return ORDER.filter(l => set.has(l));
}
function cat(l){ if (l.startsWith("チャージ")) return "charge"; if (l.startsWith("企画")) return "plan"; if (l.startsWith("NFT")) return "nft"; return "greet"; }
function tag(l){ return `<span class="tag"><span class="i ${cat(l)}"></span>${l}</span>`; }
function ensureOut(){
  return document.getElementById("out") || (()=>{const d=document.createElement("div");d.id="out";d.className="result";(document.querySelector(".card")||document.body).appendChild(d);return d;})();
}
function show(q, arr){
  const out = ensureOut();
  out.innerHTML = `<div><strong>照会:</strong> <code>${q}</code></div>` +
    (arr.length ? `<div class="tags">${arr.map(tag).join("")}</div>`
                : `<div class="tags"><span class="tag">該当なし。slugを確認。</span></div>`);
  out.style.display = "block";
}
function go(){
  const inp = document.getElementById("q");
  const q = (inp ? inp.value : "").trim();
  if (!q) return;
  show(q, lookup(q));
  const u = new URL(location.href); u.searchParams.set("q", q); history.replaceState(null, "", u.toString());
}

/* --- 起動 --- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadAll();
  const btn = document.getElementById("go"); if (btn) btn.addEventListener("click", go);
  const inp = document.getElementById("q");
  if (inp){
    inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    inp.setAttribute("autocapitalize","none"); inp.setAttribute("autocorrect","off"); inp.setAttribute("spellcheck","false");
  }
  const init = new URL(location.href).searchParams.get("q"); if (init && inp){ inp.value = init; go(); }
});
