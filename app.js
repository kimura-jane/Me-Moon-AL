/* app.js – v26 */
(() => {
  "use strict";

  // ====== Config ============================================================
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

  // 表示順・色
  const SHEETS = [
    { label: "チャージ",       a1: "チャージAL①", a2: "チャージAL②", color: "#ffa31a" },
    { label: "NFTコラボ",      a1: "NFTコラボAL①", a2: "NFTコラボAL②", color: "#46e2a4" },
    { label: "ギルドミッション", a1: "ギルドミッションAL①", a2: "ギルドミッションAL②", color: "#c79cff" },
    { label: "挨拶タップ",     a1: "挨拶タップAL①", a2: "挨拶タップAL②", color: "#ff83b7" }
  ];

  // ====== DOM ===============================================================
  const $ = (q) => document.querySelector(q);
  const slugInput = $("#slug");
  const searchBtn = $("#searchBtn");
  const resultMsg = $("#resultMsg");
  const cardsWrap = $("#cards");
  const blurBox = $("#blurBox");
  const blurRefreshBtn = $("#blurRefreshBtn");

  // ====== Utils =============================================================
  const normalizeSlug = (s) =>
    (s || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/^\s*@/, "")     // 先頭 @ を除去
      .replace(/\s+/g, "_");    // 空白→アンダースコア

  const csvUrl = (sheetName) =>
    `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const csvToList = (csvText) => {
    // 1列運用前提。ヘッダー行は無視。空白は落とす。
    return csvText
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(",")[0]?.replace(/^"|"$/g, ""))
      .filter(Boolean)
      .map((s) => normalizeSlug(s));
  };

  const fetchList = async (sheetName) => {
    const res = await fetch(csvUrl(sheetName), { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch fail: ${sheetName}`);
    const text = await res.text();
    return csvToList(text);
  };

  // ====== Render ============================================================
  const clearResult = () => {
    cardsWrap.innerHTML = "";
    cardsWrap.classList.add("hidden");
  };

  const renderCards = (rows, targetSlug) => {
    clearResult();
    if (!rows.length) {
      resultMsg.textContent = "該当なし。slugを確認。";
      return;
    }
    resultMsg.textContent = `照会: ${targetSlug}`;
    cardsWrap.classList.remove("hidden");

    const frag = document.createDocumentFragment();

    for (const row of rows) {
      const card = document.createElement("div");
      card.className = "card";

      const top = document.createElement("div");
      top.className = "row";

      const dot = document.createElement("div");
      dot.className = "dot";
      dot.style.background = row.color;

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = row.label;

      const chips = document.createElement("div");
      chips.className = "chips";

      const chip1 = document.createElement("div");
      chip1.className = "chip " + (row.ok1 ? "ok" : "ng");
      chip1.textContent = "AL①";

      const chip2 = document.createElement("div");
      chip2.className = "chip " + (row.ok2 ? "ok" : "ng");
      chip2.textContent = "AL②";

      chips.append(chip1, chip2);
      top.append(dot, title, chips);
      card.append(top);
      frag.append(card);
    }
    cardsWrap.append(frag);
  };

  // ====== Search ============================================================
  const doSearch = async () => {
    const want = normalizeSlug(slugInput.value);
    if (!want) {
      resultMsg.textContent = "slugを入力してください。";
      clearResult();
      return;
    }
    resultMsg.textContent = "検索中…";
    clearResult();

    try {
      // 8枚並列取得
      const [s1a, s1b, s2a, s2b, s3a, s3b, s4a, s4b] = await Promise.all([
        fetchList(SHEETS[0].a1), fetchList(SHEETS[0].a2),
        fetchList(SHEETS[1].a1), fetchList(SHEETS[1].a2),
        fetchList(SHEETS[2].a1), fetchList(SHEETS[2].a2),
        fetchList(SHEETS[3].a1), fetchList(SHEETS[3].a2)
      ]);

      const rows = [
        { label: SHEETS[0].label, color: SHEETS[0].color, ok1: s1a.includes(want), ok2: s1b.includes(want) },
        { label: SHEETS[1].label, color: SHEETS[1].color, ok1: s2a.includes(want), ok2: s2b.includes(want) },
        { label: SHEETS[2].label, color: SHEETS[2].color, ok1: s3a.includes(want), ok2: s3b.includes(want) },
        { label: SHEETS[3].label, color: SHEETS[3].color, ok1: s4a.includes(want), ok2: s4b.includes(want) }
      ];

      // すべて false のときもカードは出す（どこも該当なしが分かるように）
      renderCards(rows, want);
    } catch (e) {
      console.error(e);
      resultMsg.textContent = "取得エラー。共有設定 or シート名を確認。";
      clearResult();
    }
  };

  // ====== Blur photo =======================================================
  const blurManifestUrls = ["/blurs/manifest.json", "/manifest.json"];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const loadBlurOnce = async () => {
    blurBox.classList.add("hidden");
    blurBox.innerHTML = "";

    let manifest = null;
    let lastError = null;

    for (const url of blurManifestUrls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`fetch fail ${url}`);
        manifest = await res.json();
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!manifest) {
      console.error(lastError);
      return;
    }

    const list = (manifest.images || []).filter(Boolean);
    if (!list.length) return;

    const item = pick(list); // 1枚だけ
    const img = new Image();
    img.src = (item.file?.startsWith("/") ? item.file : `/blurs/${item.file}`);
    img.alt = "";
    img.decoding = "async";
    img.loading = "eager";

    const box = document.createElement("div");
    box.className = "shot-box";
    box.append(img);

    const cap = document.createElement("div");
    cap.className = "cap";
    cap.textContent = `${item.author} / ${item.date}`;
    cap.addEventListener("click", () => cap.classList.toggle("motion-blur"));
    box.append(cap);

    blurBox.append(box);
    blurBox.classList.remove("hidden");
  };

  // ====== Events ===========================================================
  const attachClick = (el, fn) => {
    el.addEventListener("click", fn, { passive: true });
    el.addEventListener("touchend", fn, { passive: true });
  };

  attachClick(searchBtn, doSearch);
  attachClick(blurRefreshBtn, loadBlurOnce);

  // iOSのフォームでEnter送信
  slugInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch();
    }
  });

  // 初期化：ページ読み込み時に1枚だけブレ撮り表示
  window.addEventListener("DOMContentLoaded", loadBlurOnce);
})();
