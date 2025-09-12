"use strict";

/* ========= CONFIG（てめーのスプシ） ========= */
// 同じファイルID（変えるな）
const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

// シート名と表示ラベル（完全一致させろ）
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
// 表示順
const ORDER = SHEETS.map(s => s.label);

// gviz CSV（iPhoneでもOK。「ウェブに公開」不要。ただし一般アクセス＝閲覧者）
const urlFor = (sheetName) =>
  `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
/* ========================================== */

const bySlug = new Map();

function norm(s){
  return (s||"").normalize("NFKC").trim().toLowerCase().replace(/^@/,"");
}

// ヘッダ無しでも1行目をデータにするCSVパーサ（slugだけ使う）
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length === 0) return [];

  const firstCols = lines[0].split(",").map(s => s.trim());
  const lower = firstCols.map(s => s.toLowerCase());
  // 1行目に "slug" があればヘッダと判定して2行目から読む。無ければ1行目から読む。
  let startRow = lower.includes("slug") ? 1 : 0;
  let slugIdx  = lower.includes("slug") ? lower.indexOf("slug") : 0;

  const rows = [];
  for (let i = startRow; i < lines.length; i++){
    const cols = lines[i].split(",");
    const slug = (cols[slugIdx]||"").trim();
    if (slug && slug.toLowerCase() !== "slug") rows.push({ slug });
  }
  return rows;
}

function add(slug, label){
  const k = norm(slug);
  if (!k) return;
  const cur = bySlug.get(k) || new Set();
  cur.add(label);
  bySlug.set(k, cur);
}

async function fetchSheet(label, sheet){
  const u = urlFor(sheet) + "&_t=" + Date.now();
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(`${label} 読込失敗 HTTP ${r.status}`);
  const text = await r.text();
  parseCSV(text).forEach(row => add(row.slug, label));
}

async function loadAll(){
  const statusEl = document.getElementById("status");
  const errs = [];
  // 連続実行（Google側の同時接続を避ける）
  for (const s of SHEETS){
    try { await fetchSheet(s.label, s.sheet); }
    catch(e){ console.error(e); errs.push(s.label); }
  }
  if (errs.length && statusEl){
    statusEl.textContent = `読込失敗: ${errs.join(", ")}（共有設定とシート名を確認）`;
    statusEl.style.display = "block";
  }
}

function lookup(q){
  const set = bySlug.get(norm(q)) || new Set();
  return ORDER.filter(label => set.has(label));
}

function getCat(l){
  if (l.startsWith("チャージ")) return "charge";
  if (l.startsWith("企画"))     return "plan";
  if (l.startsWith("NFT"))      return "nft";
  return "greet";
}
function tag(l){ return `<span class="tag"><span class="i ${getCat(l)}"></span>${l}</span>`; }

function ensureOut(){
  return document.getElementById("out") || (() => {
    const d = document.createElement("div");
    d.id = "out";
    d.className = "result";
    (document.querySelector(".card") || document.body).appendChild(d);
    return d;
  })();
}
function show(q, arr){
  const out = ensureOut();
  out.innerHTML =
    `<div><strong>照会:</strong> <code>${q}</code></div>` +
    (arr.length
      ? `<div class="tags">${arr.map(tag).join("")}</div>`
      : `<div class="tags"><span class="tag">該当なし。slugを確認。</span></div>`);
  out.style.display = "block";
}

function go(){
  const inp = document.getElementById("q");
  const q = (inp ? inp.value : "").trim();
  if (!q) return;
  show(q, lookup(q));
  const u = new URL(location.href);
  u.searchParams.set("q", q);
  history.replaceState(null, "", u.toString());
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadAll();

  const btn = document.getElementById("go");
  if (btn) btn.addEventListener("click", go);

  const inp = document.getElementById("q");
  if (inp) {
    inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    inp.setAttribute("autocapitalize","none");
    inp.setAttribute("autocorrect","off");
    inp.setAttribute("spellcheck","false");
  }

  const init = new URL(location.href).searchParams.get("q");
  if (init && inp) { inp.value = init; go(); }
});
