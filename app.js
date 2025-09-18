/* app.js — v26 */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

  // 表示カードとスプシの対応
  const MAP = [
    { key: "charge", chip1: "chip-charge-1", chip2: "chip-charge-2",
      sheet1: "チャージAL①", sheet2: "チャージAL②" },
    { key: "nft",    chip1: "chip-nft-1",    chip2: "chip-nft-2",
      sheet1: "NFTコラボAL①", sheet2: "NFTコラボAL②" },
    { key: "guild",  chip1: "chip-guild-1",  chip2: "chip-guild-2",
      sheet1: "ギルドミッションAL①", sheet2: "ギルドミッションAL②" },
    { key: "hello",  chip1: "chip-hello-1",  chip2: "chip-hello-2",
      sheet1: "挨拶タップAL①", sheet2: "挨拶タップAL②" },
  ];

  // ===== dom =====
  const $ = (s, r = document) => r.querySelector(s);
  const slugInput = $("#slug");
  const who = $("#who");

  // ===== utils: slug normalizer / matcher =====
  const HYPHENS = /[‐-‒–—―ー−]/g; // 全ハイフン類
  const SPLIT_MULTI = /[,/／|｜\s]+/; // 複数書き対応

  function norm(s) {
    if (!s) return "";
    return String(s)
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/^@+/, "")      // 先頭@除去
      .replace(HYPHENS, "-")   // 全角ハイフン類→-
      .replace(/\s+/g, "");    // 空白除去
  }

  function variants(s) {
    const n = norm(s);
    return new Set([n, n.replace(/_/g, "-"), n.replace(/-/g, "_")]);
  }

  function matchesCell(cell, input) {
    if (!cell) return false;
    const cand = variants(input);
    const parts = String(cell).split(SPLIT_MULTI);
    for (const p of parts) {
      if (cand.has(norm(p))) return true;
    }
    return false;
  }

  // ===== CSV fetcher =====
  async function fetchSheet(slugSheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq` +
      `?tqx=out:csv&sheet=${encodeURIComponent(slugSheetName)}&t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(slugSheetName + " fetch failed");
    const csv = await res.text();
    return parseCSV(csv); // 2次元配列
  }

  // 簡易CSVパーサ（ダブルクオート対応）
  function parseCSV(text) {
    const out = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (q) {
        if (c === '"' && n === '"') { field += '"'; i++; }
        else if (c === '"') { q = false; }
        else { field += c; }
      } else {
        if (c === '"') q = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); out.push(row); row = []; field = ""; }
        else if (c === "\r") { /* skip */ }
        else { field += c; }
      }
    }
    row.push(field); out.push(row);
    return out;
  }

  // ===== AL 判定 =====
  async function judgeAll(slugInputRaw) {
    const inputShown = slugInputRaw || "";
    const slugQ = inputShown;
    who.textContent = slugQ ? `照会: ${slugQ}` : "未検索です。";

    // まず全部OFF表示に戻す
    for (const m of MAP) {
      setOnOff($("#" + m.chip1), false);
      setOnOff($("#" + m.chip2), false);
    }
    if (!slugQ) return;

    // 各シートを取りに行って照合
    const tasks = [];
    for (const m of MAP) {
      tasks.push(
        (async () => {
          const [rows1, rows2] = await Promise.all([fetchSheet(m.sheet1), fetchSheet(m.sheet2)]);
          const hit1 = sheetHas(rows1, slugQ);
          const hit2 = sheetHas(rows2, slugQ);
          setOnOff($("#" + m.chip1), !!hit1);
          setOnOff($("#" + m.chip2), !!hit2);
        })()
      );
    }
    try { await Promise.all(tasks); }
    catch (e) { console.warn(e); }
  }

  function sheetHas(rows, query) {
    if (!rows || !rows.length) return false;
    // 1行目はヘッダ想定。A列（0番）にslug
    for (let i = 1; i < rows.length; i++) {
      if (matchesCell(rows[i][0], query)) return true;
    }
    return false;
  }

  function setOnOff(el, on) {
    if (!el) return;
    el.classList.toggle("on", on);
    el.classList.toggle("off", !on);
  }

  // ===== みんなのブレ撮り =====
  let blurImages = null;

  async function loadBlurManifest(force = false) {
    if (blurImages && !force) return blurImages;
    const url = `blurs/manifest.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("manifest missing");
    const data = await res.json();
    blurImages = Array.isArray(data.images) ? data.images : [];
    return blurImages;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  async function showRandomBlur(forceReload = false) {
    const frame = $("#blurFrame"), img = $("#blurImg"), cap = $("#blurCap"), err = $("#blurErr");
    err.hidden = true;
    frame.hidden = true;

    try {
      const list = await loadBlurManifest(forceReload);
      if (!list.length) throw new Error("no images");
      const it = pickRandom(list);
      const file = typeof it === "string" ? it : it.file;
      const author = (it.author || it.name || it.user || "").toString();
      const date = (it.date || "").toString();
      img.src = `blurs/${file}`;
      img.alt = author ? `${author} ${date}` : file;
      cap.textContent = author || date ? `${author}${author && date ? " / " : ""}${date}` : file;
      cap.classList.remove("active");
      frame.hidden = false;
    } catch (e) {
      console.warn(e);
      err.hidden = false;
    }
  }

  // ===== events =====
  $("#btnSearch").addEventListener("click", () => judgeAll(slugInput.value));
  slugInput.addEventListener("keydown", (e) => { if (e.key === "Enter") judgeAll(slugInput.value); });

  $("#btnRefresh").addEventListener("click", () => showRandomBlur(true));
  $("#blurCap").addEventListener("click", (e) => e.currentTarget.classList.toggle("active"));

  // 初期表示
  showRandomBlur(false);
})();
