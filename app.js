/* app.js – v28 (fetch安定化版) */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDF5-aN-oLg_-wyqEpMSdcvcU";
  const CATS = [
    { key:"charge",  label:"チャージ",        s1:"チャージAL①",        s2:"チャージAL②" },
    { key:"nft",     label:"NFTコラボ",      s1:"NFTコラボAL①",      s2:"NFTコラボAL②" },
    { key:"guild",   label:"ギルドミッション", s1:"ギルドミッションAL①", s2:"ギルドミッションAL②" },
    { key:"greet",   label:"挨拶タップ",      s1:"挨拶タップAL①",      s2:"挨拶タップAL②" },
  ];

  const MAX_RETRY = 4;             // リトライ回数
  const BETWEEN_CALL_MS = 200;     // シート呼び出し間隔

  // ===== helpers =====
  const $ = sel => document.querySelector(sel);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const normalize = s => (s || "")
    .toString()
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/^[\s_@]+|[\s_@]+$/g, "");

  const setState = (text) => { $("#resultStatus").textContent = text; };

  const setBadge = (key, which, state) => {
    // state: "yes" | "no" | "unknown"
    const el = $(`#${key}-${which}`);
    el.classList.remove("yes","no","unknown");
    el.classList.add(state);
    el.querySelector("span").textContent =
      which === 1 ? "AL①" : "AL②";
  };

  const resetBadges = () => {
    CATS.forEach(c => {
      setBadge(c.key, 1, "unknown");
      setBadge(c.key, 2, "unknown");
    });
  };

  // CSV fetch（直列＋バックオフ）
  async function fetchCsv(sheetName, attempt = 1) {
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&_=${Date.now()}`;
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "omit", redirect: "follow", referrerPolicy: "no-referrer" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // 1列想定：各行が slug
      return text
        .split(/\r?\n/)
        .map(r => r.replace(/^\uFEFF/, "").trim())
        .filter(Boolean);
    } catch (e) {
      if (attempt < MAX_RETRY) {
        // 400, 429, 5xx を想定して指数バックオフ
        const wait = Math.min(3200, 600 * Math.pow(2, attempt - 1));
        await sleep(wait);
        return fetchCsv(sheetName, attempt + 1);
      }
      throw e;
    }
  }

  async function existsInSheet(slug, sheetName) {
    // 取得→正規化して一致判定
    const rows = await fetchCsv(sheetName);
    const target = normalize(slug);
    for (const raw of rows) {
      if (normalize(raw) === target) return true;
    }
    return false;
  }

  async function checkAll(slug) {
    // 1カテゴリずつ直列で叩く（GSheetsのスロットリング回避）
    for (const cat of CATS) {
      // AL①
      try {
        const ok1 = await existsInSheet(slug, cat.s1);
        setBadge(cat.key, 1, ok1 ? "yes" : "no");
      } catch {
        setBadge(cat.key, 1, "unknown");
        throw new Error(`fetch failed: ${cat.s1}`);
      }
      await sleep(BETWEEN_CALL_MS);
      // AL②
      try {
        const ok2 = await existsInSheet(slug, cat.s2);
        setBadge(cat.key, 2, ok2 ? "yes" : "no");
      } catch {
        setBadge(cat.key, 2, "unknown");
        throw new Error(`fetch failed: ${cat.s2}`);
      }
      await sleep(BETWEEN_CALL_MS);
    }
  }

  // ===== UI wiring =====
  const form = $("#searchForm");
  const input = $("#slugInput");

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const q = normalize(input.value);
    if (!q) {
      setState("slug を入力してください。");
      return;
    }
    resetBadges();
    setState(`照会: ${q}（取得中…）`);
    form.querySelector("button[type=submit]").disabled = true;

    try {
      await checkAll(q);
      setState(q); // 正常完了
    } catch {
      setState("取得エラー。時間をおいて再実行してください。");
    } finally {
      form.querySelector("button[type=submit]").disabled = false;
    }
  });

  // 初期化
  resetBadges();
})();
