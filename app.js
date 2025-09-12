"use strict";

/* ====== CONFIG（てめーのスプシ設定）====== */
// スプレッドシートのファイルID（同じやつ）
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

// 表示順は固定
const ORDER = SHEETS.map(s => s.label);

// CSVの取り方（iPhoneで「ウェブに公開」を使わない版）
const urlFor = (sheetName) =>
  `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

/* ====== 内部 ====== */
const bySlug = new Map();

const statusEl = document.getElementById("status") || (() => {
  const d = document.createElement("div");
  d.id = "status";
  d.style.cssText = "margin-top:8px;color:#fca5a5;font-size:12px;display:none";
  (document.querySelector(".card") || document.body).prepend(d);
  return d;
})();

function norm(s){ return (s||"").normalize("NFKC").trim().toLowerCase().replace(/^@/,""); }

// CSV超簡易パーサ（slugしか使わない想定。カンマ入りは非対応でOK）
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if(lines.length === 0) return [];
  const hdr = lines[0].split(",").map(h => h.trim().toLowerCase());
  const slugIdx = hdr.findIndex(h => h === "slug");
  // 列名がない/一列だけの運用に備えて0列目をslugとみなす
  const idx = slugIdx >= 0 ? slugIdx : 0;
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(",");
    const slug = (cols[idx]||"").trim();
    if(slug) rows.push({ slug });
  }
  return rows;
}

function add(slug,label){
  const k = norm(slug);
  if(!k) return;
  const cur = bySlug.get(k) || new Set();
  cur.add(label);
  bySlug.set(k, cur);
}

async function fetchSheet(label, sheet){
  const u = urlFor(sheet);
  const r = await fetch(u + "&_t=" + Date.now(), { cache: "no-store" });
  if(!r.ok){
    throw new Error(`${label} 読込失敗 HTTP ${r.status}`);
  }
  const text = await r.text();
  const rows = parseCSV(text);
  rows.forEach(r => add(r.slug, label));
}

async function loadAll(){
  // 共有設定：一般アクセス「リンクを知っている全員・閲覧者」にしとけ
  await Promise.all(SHEETS.map(s => fetchSheet(s.label, s.sheet)));
}

function lookup(q){
  const set = bySlug.get(norm(q)) || new Set();
  return ORDER.filter(l => set.has(l));
}

function getCat(l){
  if(l.startsWith("チャージ")) return "charge";
  if(l.startsWith("企画"))     return "plan";
  if(l.startsWith("NFT"))      return "nft";
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
  if(!q) return;
  show(q, lookup(q));
  const u = new URL(location.href); u.searchParams.set("q", q); history.replaceState(null, "", u.toString());
}

document.addEventListener("DOMContentLoaded", async () => {
  try{
    await loadAll();
  }catch(e){
    statusEl.textContent = "読込失敗：共有設定（閲覧者）とシート名を見直せ";
    statusEl.style.display = "block";
    console.error(e);
  }
  const btn = document.getElementById("go"); if (btn) btn.addEventListener("click", go);
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
