/* app.js — gviz JSONP 版（CORS回避） */
(() => {
  "use strict";

  // ====== Config ======
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
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

  // ====== DOM ======
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
      .replace(/^@/, "");

  const jsonpURL = (sheet, cbName) =>
    `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq` +
    `?tqx=out:json;responseHandler:${cbName}` +
    `&sheet=${encodeURIComponent(sheet)}` +
    `&tq=${encodeURIComponent("select A")}`;

  function jsonpFetch(sheet, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const cb = `__gviz_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = jsonpURL(sheet, cb);
      const script = document.createElement("script");
      let done = false;
      const cleanup = () => {
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[cb]; } catch (_) { window[cb] = undefined; }
      };
      const timer = setTimeout(() => {
        if (done) return;
        done = true; cleanup();
        reject(new Error("timeout"));
      }, timeoutMs);

      window[cb] = (data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        try {
          const rows = (data && data.table && data.table.rows) || [];
          const set = new Set();
          for (const r of rows) {
            const cell = r && r.c && r.c[0];
            const v = (cell && (cell.v ?? cell.f)) ?? "";
            const n = norm(v);
            if (n) set.add(n);
          }
          resolve(set);
        } catch (e) {
          reject(e);
        }
      };

      script.src = url;
      script.onerror = () => {
        if (done) return;
        done = true; clearTimeout(timer); cleanup();
        reject(new Error("script error"));
      };
      document.head.appendChild(script);
    });
  }

  // キャッシュ
  const cache = new Map(); // sheetName => {t,set}
  async function loadSheetSet(name) {
    const c = cache.get(name);
    const now = Date.now();
    if (c && now - c.t < CACHE_TTL_MS) return c.set;

    // リトライ（指数バックオフ）
    let delay = 300, lastErr;
    for (let i = 0; i < 4; i++) {
      try {
        const set = await jsonpFetch(name);
        cache.set(name, { t: now, set });
        return set;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, delay + Math.random() * 150));
        delay *= 2;
      }
    }
    throw lastErr || new Error("load failed");
  }

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
  function dotClass(group) {
    switch (group) {
      case "チャージ": return "c-orange";
      case "NFTコラボ": return "c-green";
      case "ギルドミッション": return "c-purple";
      case "挨拶タップ": return "c-pink";
      default: return "c-gray";
    }
  }
  function renderResults(slug, map) {
    if (resultTitle) resultTitle.textContent = slug || "";
    showMsg("");
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
    resultWrap.innerHTML = blocks.join("");
  }

  // ====== search ======
  let running = false;
  async function runSearch() {
    if (running) return;
    const slug = norm(input ? input.value : "");
    if (!slug) { showMsg("slug を入力してください。"); return; }

    running = true; setBusy(true); showMsg("");

    const groups = new Map();
    for (const s of SHEETS) if (!groups.has(s.group)) groups.set(s.group, [false, false]);

    let success = 0;
    try {
      // 直列で読み込み（レート制限回避）
      for (const s of SHEETS) {
        try {
          const set = await loadSheetSet(s.sheet);
          success++;
          const pair = groups.get(s.group);
          pair[s.idx] = set.has(slug);
        } catch (e) {
          console.warn("[sheet load failed]", s.sheet, e.message || e);
        }
      }
      if (success === 0) {
        showMsg("取得エラー。時間をおいて再実行してください。");
        return;
      }
      renderResults(slug, groups);
    } catch (e) {
      showMsg("取得エラー。時間をおいて再実行してください。");
    } finally {
      setBusy(false); running = false;
    }
  }

  if (form instanceof HTMLFormElement) {
    form.addEventListener("submit", (e) => { e.preventDefault(); runSearch(); });
  }
  if (searchBtn && !(form instanceof HTMLFormElement)) {
    searchBtn.addEventListener("click", (e) => { e.preventDefault(); runSearch(); });
  }

  // 初期の空カード
  if (resultWrap && !resultWrap.children.length) {
    const groups = new Map();
    for (const s of SHEETS) if (!groups.has(s.group)) groups.set(s.group, [false, false]);
    renderResults("", groups);
  }
})();
