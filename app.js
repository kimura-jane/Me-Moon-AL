/* app.js */
(() => {
  "use strict";

  /** ====== 設定 ====== */
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

  // 4カテゴリ × 2シート
  const GROUPS = [
    { key: "charge", label: "チャージ", color: getCSS("--accent1"),
      sheets: { 1: "チャージAL①", 2: "チャージAL②" } },
    { key: "nft", label: "NFTコラボ", color: getCSS("--accent2"),
      sheets: { 1: "NFTコラボAL①", 2: "NFTコラボAL②" } },
    { key: "guild", label: "ギルドミッション", color: getCSS("--accent3"),
      sheets: { 1: "ギルドミッションAL①", 2: "ギルドミッションAL②" } },
    { key: "hello", label: "挨拶タップ", color: getCSS("--accent4"),
      sheets: { 1: "挨拶タップAL①", 2: "挨拶タップAL②" } },
  ];

  /** ====== DOM ====== */
  const $ = (s, r = document) => r.querySelector(s);
  const resultBox  = $("#resultBox");
  const resultList = $("#resultList");
  const catalogBox = $("#catalog");

  /** ====== 初期化 ====== */
  document.addEventListener("DOMContentLoaded", () => {
    renderCatalog();
    $("#searchForm").addEventListener("submit", onSearch);
    $("#blurRefresh").addEventListener("click", loadRandomBlur);
    loadRandomBlur();
  });

  /** ====== 検索 ====== */
  async function onSearch(e) {
    e.preventDefault();
    const raw = $("#slugInput").value || "";
    const slug = normalize(raw);
    if (!slug) {
      resultBox.textContent = "該当なし。slugを確認。";
      resultList.innerHTML = "";
      resultBox.classList.remove("muted");
      return;
    }
    resultBox.textContent = `照会: ${slug}`;
    resultBox.classList.add("muted");
    resultList.innerHTML = "";

    try {
      // 8シートをキャッシュしながら取得
      await warmUpSheets(Object.values(flattenSheets(GROUPS)));

      const cards = [];
      for (const g of GROUPS) {
        const ok1 = hasSlug(g.sheets[1], slug);
        const ok2 = hasSlug(g.sheets[2], slug);
        if (!ok1 && !ok2) continue; // どちらにも無ければ非表示

        cards.push(renderResultItem(g, ok1, ok2));
      }

      if (!cards.length) {
        resultBox.textContent = `照会: ${slug}`;
        resultBox.classList.remove("muted");
        resultList.innerHTML = `<div class="result-box">該当なし。slugを確認。</div>`;
      } else {
        resultBox.textContent = `照会: ${slug}`;
        resultBox.classList.remove("muted");
        resultList.replaceChildren(...cards);
      }
    } catch (err) {
      console.error(err);
      resultBox.textContent = "読み込みでエラー。時間をおいて再試行してください。";
      resultList.innerHTML = "";
    }
  }

  /** ====== カタログ（固定） ====== */
  function renderCatalog() {
    const nodes = GROUPS.map(g => {
      const root = document.createElement("div");
      root.className = "cat";
      root.innerHTML = `
        <div class="cat-head">
          <div class="cat-l">
            <span class="dot" style="background:${g.color}"></span>
            <span class="cat-title">${g.label}</span>
          </div>
          <div class="pills">
            <span class="pill off">AL①</span>
            <span class="pill off">AL②</span>
          </div>
        </div>`;
      return root;
    });
    catalogBox.replaceChildren(...nodes);
  }

  /** ====== 結果アイテム ====== */
  function renderResultItem(group, ok1, ok2) {
    const root = document.createElement("div");
    root.className = "cat";
    root.innerHTML = `
      <div class="cat-head">
        <div class="cat-l">
          <span class="dot" style="background:${group.color}"></span>
          <span class="cat-title">${group.label}</span>
        </div>
        <div class="pills">
          <span class="pill ${ok1 ? "on" : "off"}">AL①</span>
          <span class="pill ${ok2 ? "on" : "off"}">AL②</span>
        </div>
      </div>`;
    return root;
  }

  /** ====== スプレッドシート読込 ====== */
  const sheetCache = new Map(); // sheetName -> Set<slug>

  function sheetUrl(sheetName) {
    // gviz CSV 出力
    return `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }

  async function fetchSheetSet(sheetName) {
    const res = await fetch(sheetUrl(sheetName), { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed: ${sheetName}`);
    const csv = await res.text();
    const set = new Set();
    // 1列目（slug想定）だけ採用
    csv.split(/\r?\n/).forEach((line, i) => {
      if (!line) return;
      const cell = line.split(",")[0].replace(/^"|"$/g, "");
      const v = normalize(cell);
      if (!v) return;
      // 先頭行が「slug」ならスキップ
      if (i === 0 && v === "slug") return;
      set.add(v);
    });
    return set;
  }

  async function warmUpSheets(sheetNames) {
    const tasks = sheetNames
      .filter(n => !sheetCache.has(n))
      .map(async n => sheetCache.set(n, await fetchSheetSet(n)));
    await Promise.all(tasks);
  }

  function hasSlug(sheetName, slug) {
    const set = sheetCache.get(sheetName);
    return !!(set && set.has(slug));
  }

  function flattenSheets(groups) {
    const out = {};
    groups.forEach(g => { out[g.sheets[1]] = 1; out[g.sheets[2]] = 1; });
    return out;
  }

  /** ====== ブレ撮り（ランダム1枚） ====== */
  async function loadRandomBlur() {
    try {
      const res = await fetch("blurs/manifest.json", { cache: "no-store" });
      if (!res.ok) throw new Error("manifest fetch failed");
      const data = await res.json();
      const arr = Array.isArray(data?.images) ? data.images : [];
      const card = $("#blurCard");
      if (!arr.length) {
        card.innerHTML = `<div class="result-box">画像がまだありません。</div>`;
        return;
      }
      const pick = arr[Math.floor(Math.random() * arr.length)];
      const src = `blurs/${pick.file}`;
      card.innerHTML = `
        <div class="imgwrap">
          <img src="${src}" alt="">
          <figcaption class="caption" id="blurCaption">${pick.author} / ${pick.date}</figcaption>
        </div>
      `;
      // 文字ブレ
      $("#blurCaption").addEventListener("click", (ev) => {
        ev.currentTarget.classList.remove("glitch");
        // リスタート
        void ev.currentTarget.offsetWidth;
        ev.currentTarget.classList.add("glitch");
      });
    } catch (e) {
      console.error(e);
      $("#blurCard").innerHTML = `<div class="result-box">manifest.json が見つかりません。</div>`;
    }
  }

  /** ====== ユーティリティ ====== */
  function normalize(s) {
    return String(s || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/＿/g, "_"); // 全角アンダー対応
  }

  function getCSS(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
})();
