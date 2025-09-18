/* app.js — 安定版（直列フェッチ＋バックオフ＋連打ガード＋軽いキャッシュ） */
(() => {
  "use strict";

  // ====== Config ======
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
  // 1カテゴリにつき AL①/AL② を用意（順番は表示順）
  const SHEETS = [
    { group: "チャージ", idx: 0, sheet: "チャージAL①" },
    { group: "チャージ", idx: 1, sheet: "チャージAL②" },
    { group: "NFTコラボ", idx: 0, sheet: "NFTコラボAL①" },
    { group: "NFTコラボ", idx: 1, sheet: "NFTコラボAL②" },
    { group: "ギルドミッション", idx: 0, sheet: "ギルドミッションAL①" },
    { group: "ギルドミッション", idx: 1, sheet: "ギルドミッションAL②" },
    { group: "挨拶タップ", idx: 0, sheet: "挨拶タップAL①" },
    { group: "挨拶タップ", idx: 1, sheet: "挨拶タップAL②" },
  ];
  const CACHE_TTL_MS = 1000 * 60 * 3; // 3分

  // ====== DOM refs（存在しない時は安全にスキップ） ======
  const $ = (s, r = document) => r.querySelector(s);
  const form = $("#searchForm") || document;
  const input = $("#slugInput") || $("input[name='slug']") || $("input");
  const searchBtn =
    $("#searchBtn") ||
    (form instanceof HTMLFormElement
      ? form.querySelector("button[type='submit']")
      : $("button[data-role='search-btn']"));
  const resultWrap = $("#resultWrap") || $("#resultList") || $("#results");
  const resultTitle = $("#resultTitle") || $("[data-role='result-title']");
  const resultMsg = $("#resultMsg") || $("[data-role='result-msg']");

  // ====== utils ======
  const norm = (s) =>
    String(s || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/^@/, ""); // 先頭@除去

  const sheetURL = (name) =>
    `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      name
    )}`;

  // シンプルCSV → 先頭カラムだけ読む（1列想定）
  const csvToSet = (csvText) => {
    const set = new Set();
    csvText
      .split(/\r?\n/)
      .map((l) => l.replace(/^\uFEFF/, "")) // BOM除去
      .map((l) => l.replace(/^"|"$/g, "")) // 行全体の両端"
      .map((l) => l.split(",")[0]) // 先頭セル
      .forEach((v) => {
        const n = norm(v);
        if (n) set.add(n);
      });
    return set;
  };

  // 直列フェッチ＋指数バックオフ
  async function fetchWithBackoff(url, maxTry = 4) {
    let delay = 300;
    let lastErr;
    for (let i = 0; i < maxTry; i++) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) return await res.text();
        if (res.status !== 429 && res.status !== 503) {
          throw new Error(`HTTP ${res.status}`);
        }
        lastErr = new Error(`Rate limited ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
      await new Promise((r) =>
        setTimeout(r, delay + Math.floor(Math.random() * 150))
      );
      delay *= 2;
    }
    throw lastErr || new Error("fetch failed");
  }

  // セッション内キャッシュ
  const cache = new Map(); // sheetName => {t:number, set:Set}
  async function loadSheetSet(name) {
    const c = cache.get(name);
    const now = Date.now();
    if (c && now - c.t < CACHE_TTL_MS) return c.set;
    const text = await fetchWithBackoff(sheetURL(name));
    const set = csvToSet(text);
    cache.set(name, { t: now, set });
    return set;
  }

  // ====== render ======
  function setBusy(b) {
    if (searchBtn) {
      searchBtn.disabled = b;
      searchBtn.classList.toggle("is-busy", b);
    }
  }

  function showMsg(text) {
    if (resultMsg) {
      resultMsg.textContent = text || "";
      resultMsg.style.display = text ? "" : "none";
    }
  }

  function renderResults(slug, map) {
    // map: group => [hasAL1, hasAL2]
    if (resultTitle) resultTitle.textContent = slug;
    showMsg(""); // クリア

    if (!resultWrap) return;

    const blocks = [];
    for (const [group, pair] of map) {
      const [a1, a2] = pair;
      blocks.push(`
        <div class="al-card">
          <div class="al-head">
            <span class="al-dot ${dotClass(group)}"></span>
            <span class="al-ttl">${group}</span>
          </div>
          <div class="al-pills">
            <span class="al-pill ${a1 ? "on" : "off"}">AL①${a1 ? "✓" : ""}</span>
            <span class="al-pill ${a2 ? "on" : "off"}">AL②${a2 ? "✓" : ""}</span>
          </div>
        </div>
      `);
    }
    resultWrap.innerHTML = blocks.join("\n");
  }

  function dotClass(group) {
    switch (group) {
      case "チャージ":
        return "c-orange";
      case "NFTコラボ":
        return "c-green";
      case "ギルドミッション":
        return "c-purple";
      case "挨拶タップ":
        return "c-pink";
      default:
        return "c-gray";
    }
  }

  // ====== search main ======
  let running = false; // 二重起動ガード
  async function runSearch() {
    if (running) return;
    const raw = input ? input.value : "";
    const slug = norm(raw);
    if (!slug) {
      showMsg("slug を入力してください。");
      return;
    }

    running = true;
    setBusy(true);
    showMsg(""); // 一旦消す

    const groups = new Map();
    // 初期値 false
    for (const s of SHEETS) {
      if (!groups.has(s.group)) groups.set(s.group, [false, false]);
    }

    let anyLoaded = false;

    try {
      // 直列で順に読む（レート制限回避）
      for (const s of SHEETS) {
        try {
          const set = await loadSheetSet(s.sheet);
          anyLoaded = true;
          const has = set.has(slug);
          const pair = groups.get(s.group);
          pair[s.idx] = has;
        } catch (e) {
          console.warn("[sheet error]", s.sheet, e);
          // 失敗しても他は続行（部分成功で描画）
        }
      }

      if (!anyLoaded) {
        showMsg("取得エラー。時間をおいて再実行してください。");
        return;
      }

      renderResults(slug, groups);
    } catch (e) {
      console.error(e);
      showMsg("取得エラー。時間をおいて再実行してください。");
    } finally {
      setBusy(false);
      running = false;
    }
  }

  // ====== events ======
  if (form instanceof HTMLFormElement) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      runSearch();
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", (e) => {
      // form submit と二重にならないように
      if (!(form instanceof HTMLFormElement)) {
        e.preventDefault();
        runSearch();
      }
    });
  }

  // ====== 初期状態（表示だけ用意） ======
  if (resultWrap && !resultWrap.children.length) {
    // プレースホルダー描画（空カード）
    const groups = new Map();
    for (const s of SHEETS) {
      if (!groups.has(s.group)) groups.set(s.group, [false, false]);
    }
    renderResults("", groups);
  }
})();
