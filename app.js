/* app.js — v26 */
(() => {
  "use strict";

  // ========= Config =========
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

  // カテゴリごとのシート名
  const CATEGORIES = [
    { key: "charge", label: "チャージ", color: "#ffa01c", sheets: ["チャージAL①", "チャージAL②"] },
    { key: "nft",    label: "NFTコラボ", color: "#2dd38d", sheets: ["NFTコラボAL①", "NFTコラボAL②"] },
    { key: "guild",  label: "ギルドミッション", color: "#b689ff", sheets: ["ギルドミッションAL①", "ギルドミッションAL②"] },
    { key: "greet",  label: "挨拶タップ", color: "#ff80b3", sheets: ["挨拶タップAL①", "挨拶タップAL②"] },
  ];

  // ========= State =========
  // { "シート名": Set<slug> }
  const DB = Object.create(null);
  let READY = false;

  // ========= Utils =========
  const $ = (sel) => document.querySelector(sel);

  const normalize = (s) => (s || "")
    .toString()
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/^@/, ""); // 先頭 @ を落とす

  // CSV -> Set（1列目の値だけ使う）
  function csvToSet(csv) {
    const set = new Set();
    if (!csv) return set;
    // すごく単純な CSV（1列）前提。余計な空白や空行は無視。
    csv.split(/\r?\n/).forEach(line => {
      const v = normalize(line.split(",")[0]);
      if (v) set.add(v);
    });
    return set;
  }

  function fetchSheetSet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    return fetch(url, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(csvToSet)
      .catch(err => {
        console.warn(`シート取得失敗: ${sheetName}`, err);
        return new Set(); // 失敗時は空集合（= 全て該当なし）
      });
  }

  // すべてのシートを読み込み
  async function preloadAll() {
    const tasks = [];
    for (const cat of CATEGORIES) {
      for (const sn of cat.sheets) {
        tasks.push(
          fetchSheetSet(sn).then(set => { DB[sn] = set; })
        );
      }
    }
    await Promise.all(tasks);
    READY = true;
  }

  // ========= Rendering =========
  function chipHtml(ok, label) {
    const cls = ok ? "chip ok" : "chip ng";
    const txt = ok ? label : `${label}`;
    // “対象/該当なし” など文字を足したいならここで
    return `<span class="${cls}">${label}</span>`;
  }

  function renderResult(slug) {
    const box = $("#resultBox");
    if (!slug) {
      box.className = "result-card muted";
      box.innerHTML = "未検索です。";
      return;
    }
    if (!READY) {
      box.className = "result-card muted";
      box.textContent = "データを読み込み中…";
      return;
    }

    const rows = CATEGORIES.map(cat => {
      const [al1, al2] = cat.sheets;
      const ok1 = DB[al1]?.has(slug) === true; // ← 見つからなければ false
      const ok2 = DB[al2]?.has(slug) === true;
      return `
        <div class="item">
          <div class="left">
            <span class="dot" style="background:${cat.color}"></span>
            <div class="title">${cat.label}</div>
          </div>
          <div class="chips">
            ${chipHtml(ok1, "AL①")}
            ${chipHtml(ok2, "AL②")}
          </div>
        </div>`;
    }).join("");

    box.className = "result-card";
    box.innerHTML = `
      <div class="muted" style="margin:2px 4px 8px">照会: <span>${slug}</span></div>
      ${rows}
    `;
  }

  function renderCatalog() {
    const wrap = $("#catalog");
    wrap.innerHTML = CATEGORIES.map(cat => `
      <div class="item">
        <div class="left">
          <span class="dot" style="background:${cat.color}"></span>
          <div class="title">${cat.label}</div>
        </div>
        <div class="chips">
          <span class="chip">AL①</span>
          <span class="chip">AL②</span>
        </div>
      </div>
    `).join("");
  }

  // ========= Gallery (みんなのブレ撮り) =========
  async function loadRandomBlur() {
    const host = "./blurs";
    const manifestUrl = `${host}/manifest.json`;
    const area = $("#gallery");
    try {
      const res = await fetch(manifestUrl, { cache:"no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data.images) ? data.images : [];
      if (!list.length) throw new Error("images が空");

      const pick = list[Math.floor(Math.random() * list.length)];
      const src = `${host}/${pick.file}`;
      const author = pick.author || "unknown";
      const date = pick.date || "";

      area.innerHTML = `
        <figure class="blur-card">
          <img src="${src}" alt="" id="blurImg">
          <figcaption id="blurCaption" title="タップで文字ブレ">${author} / ${date}</figcaption>
        </figure>
      `;

      const cap = $("#blurCaption");
      cap.addEventListener("click", () => {
        cap.classList.toggle("caption-blur");
      }, { once:false });

    } catch (e) {
      console.warn(e);
      area.innerHTML = `<div class="muted">manifest.json が見つからない。</div>`;
    }
  }

  // ========= Wire up =========
  function bind() {
    const input = $("#slug");
    const btn = $("#searchBtn");
    const doSearch = () => renderResult(normalize(input.value));

    btn.addEventListener("click", doSearch);
    input.addEventListener("keydown", (e)=>{ if(e.key==="Enter") doSearch(); });

    $("#galleryRefresh").addEventListener("click", loadRandomBlur);
  }

  // ========= Start =========
  renderCatalog();
  bind();
  preloadAll().then(() => {
    // 初回、「未検索」状態を維持。必要ならここで既定値を照会。
  });
  loadRandomBlur();
})();
