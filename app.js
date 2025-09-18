/* ==========================================================
   Me-Moon AL Checker – app.js (full, hard-coded Sheet ID)
   ========================================================== */

/* ==== Google Sheets 設定 ==== */
/* いただいたURL:
   https://docs.google.com/spreadsheets/d/1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU/edit
*/
const SHEET_ID = '1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU';
const gvizCsv = (sheetName) =>
  `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    SHEET_ID
  )}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

/* ==== ALカテゴリ定義 ==== */
const CATEGORIES = [
  {
    key: 'charge',
    label: 'チャージ',
    color: '#ffa31a',
    sheets: { al1: 'チャージAL①', al2: 'チャージAL②' },
  },
  {
    key: 'nft',
    label: 'NFTコラボ',
    color: '#31e28d',
    sheets: { al1: 'NFTコラボAL①', al2: 'NFTコラボAL②' },
  },
  {
    key: 'guild',
    label: 'ギルドミッション',
    color: '#b78cff',
    sheets: { al1: 'ギルドミッションAL①', al2: 'ギルドミッションAL②' },
  },
  {
    key: 'greet',
    label: '挨拶タップ',
    color: '#ff73b8',
    sheets: { al1: '挨拶タップAL①', al2: '挨拶タップAL②' },
  },
];

/* ==== DOM ==== */
const $ = (s) => document.querySelector(s);
const slugInput   = $('#slugInput') || $('input[type="search"]') || $('input');
const searchBtn   = $('#searchBtn') || document.querySelector('button[data-action="search"]');
const resultWrap  = $('#result') || $('#resultArea') || $('.result');
const resultTitle = $('#resultTitle') || $('.result-title');

/* --- ブレ撮りDOM（ゆるいフォールバック付き） --- */
const blurStage   =
  $('#blursStage') || $('#blursOne') || $('#blursGrid') || $('#blurs');
const blurRefreshBtn =
  $('#blursRefresh') ||
  $('#refreshBtn') ||
  $('[data-refresh]') ||
  document.querySelector('#blurs button, #blurs .btn, #blurs [role="button"]');

/* ==== ストア ==== */
const STORE = {}; // { key: { al1:Set, al2:Set } }
let DATA_READY = false;

/* ==== ユーティリティ ==== */
const toHalf = (s) =>
  s.replace(/[\uFF01-\uFF5E]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

const normalizeSlug = (s) =>
  toHalf((s || '').toString())
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ==== CSV 読み込み ==== */
async function fetchCsvToSet(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const txt = await res.text();

  const set = new Set();
  // 1列 or 複数列に対応（全セルを候補にして拾う）
  txt
    .replace(/\r/g, '')
    .split('\n')
    .forEach((line, i) => {
      if (!line) return;
      // CSVざっくり分割（スプレッドシートの単純ケース想定）
      const cells = line.split(',').map((x) => x.replace(/^"+|"+$/g, '').trim());
      cells.forEach((cell) => {
        const v = normalizeSlug(cell);
        if (v && v !== 'slug' && !/^(me-moon|memoon)$/i.test(cell)) set.add(v);
      });
    });

  return set;
}

async function loadAllSheets() {
  const jobs = [];
  CATEGORIES.forEach((cat) => {
    STORE[cat.key] = { al1: new Set(), al2: new Set() };
    jobs.push(
      (async () => {
        try {
          STORE[cat.key].al1 = await fetchCsvToSet(gvizCsv(cat.sheets.al1));
        } catch (e) {
          console.warn('load fail:', cat.sheets.al1, e);
        }
      })()
    );
    jobs.push(
      (async () => {
        try {
          STORE[cat.key].al2 = await fetchCsvToSet(gvizCsv(cat.sheets.al2));
        } catch (e) {
          console.warn('load fail:', cat.sheets.al2, e);
        }
      })()
    );
  });

  await Promise.all(jobs);
  DATA_READY = true;
}

/* ==== 結果レンダリング ==== */
function pill(label, on) {
  return `<span class="pill ${on ? 'on' : ''}">${label}</span>`;
}

function renderResult(slugRaw) {
  const slug = normalizeSlug(slugRaw);
  if (!resultWrap) return;

  let hitAny = false;
  const cards = CATEGORIES.map((cat) => {
    const has1 = STORE[cat.key]?.al1?.has(slug);
    const has2 = STORE[cat.key]?.al2?.has(slug);
    if (has1 || has2) hitAny = true;
    return `
      <div class="res-card">
        <div class="res-head">
          <span class="dot" style="--c:${cat.color}"></span>
          <span class="res-title">${cat.label}</span>
          <div class="res-pills">
            ${pill('AL①', has1)} ${pill('AL②', has2)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  resultTitle && (resultTitle.textContent = `照会: ${slug || '-'}`);
  resultWrap.innerHTML = hitAny
    ? cards
    : `<div class="res-empty">該当なし。slugを確認。</div>`;

  // 少し上にスクロールして隠れないように
  resultWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ==== 検索イベント ==== */
function bindSearch() {
  if (searchBtn) {
    searchBtn.addEventListener('click', async () => {
      if (!DATA_READY) await loadAllSheets();
      renderResult(slugInput?.value || '');
    });
  }
  if (slugInput) {
    slugInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        if (!DATA_READY) await loadAllSheets();
        renderResult(slugInput.value || '');
      }
    });
  }
}

/* ==== ブレ撮り（1枚ランダム） ==== */
const MANIFEST_PATH = 'blurs/manifest.json';
let manifestCache = null;
let lastIndex = -1;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadManifest() {
  if (manifestCache) return manifestCache;
  const res = await fetch(MANIFEST_PATH, { cache: 'no-store' });
  if (!res.ok) throw new Error('manifest.json not found');
  manifestCache = await res.json(); // {updated, images:[{file,author,date}]}
  return manifestCache;
}

function pickRandom(arr) {
  if (!arr?.length) return null;
  let i = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && i === lastIndex) {
    i = (i + 1) % arr.length; // 直前と被らないように
  }
  lastIndex = i;
  return arr[i];
}

function renderBlurOne(item) {
  if (!blurStage || !item) return;
  // ステージを確保（figureで差し替え）
  blurStage.innerHTML = `
    <figure class="blur-card">
      <img src="blurs/${encodeURIComponent(item.file)}" alt="blur" loading="lazy" />
      <figcaption class="blur-caption">
        <span class="cap cap-name">${item.author || '-'}</span>
        <span class="cap cap-date">${item.date || ''}</span>
      </figcaption>
    </figure>
  `;
}

async function refreshBlur() {
  try {
    const mf = await loadManifest();
    const items = shuffleInPlace([...mf.images]);
    const pick = pickRandom(items);
    renderBlurOne(pick);
  } catch (e) {
    console.warn(e);
    if (blurStage) {
      blurStage.innerHTML =
        `<div class="res-empty">manifest.json が見つからない。</div>`;
    }
  }
}

function bindBlurRefresh() {
  if (blurRefreshBtn) {
    blurRefreshBtn.addEventListener('click', refreshBlur);
  }
}

/* ==== 起動 ==== */
document.addEventListener('DOMContentLoaded', async () => {
  bindSearch();
  bindBlurRefresh();

  // 先に軽く非同期ロード（初回検索を速く）
  loadAllSheets().catch(console.warn);

  // ブレ撮りは自動で1枚出す
  refreshBlur().catch(console.warn);
});

/* ==== ちょいCSSヘルパ（JS側で必要最小限差し込み） ==== */
(function injectHelpers() {
  const css = `
  .res-card{background:linear-gradient(180deg,#0c1424aa,#0b1220aa);
    border:1px solid #1f2a44; border-radius:18px; padding:14px 16px; margin:10px 0;}
  .res-head{display:flex; align-items:center; gap:10px;}
  .res-title{font-weight:700; letter-spacing:.04em;}
  .dot{width:12px;height:12px;border-radius:50%;display:inline-block;background:var(--c,#888)}
  .res-pills{margin-left:auto; display:flex; gap:8px;}
  .pill{font-size:12px; padding:6px 10px; border-radius:999px;
    border:1px solid #3a4c7a; opacity:.6}
  .pill.on{opacity:1; border-color:#9cc7ff; box-shadow:0 0 0 1px #7fb0ff33 inset}
  .res-empty{opacity:.8; font-size:14px; padding:10px 2px}
  .blur-card{position:relative; margin:16px auto 8px; width:min(92vw,640px);}
  .blur-card img{width:100%; height:auto; display:block; border-radius:20px;
    border:1px solid #1f2a44; box-shadow:0 10px 30px #0006}
  .blur-caption{position:absolute; left:12px; bottom:12px;
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    background:#0b1220a6; color:#fff; border:1px solid #2a385d;
    border-radius:12px; padding:6px 10px; display:flex; gap:10px; font-size:12px}
  .cap-name{font-weight:700; opacity:.95}
  .cap-date{opacity:.85}
  `;
  const tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
})();
