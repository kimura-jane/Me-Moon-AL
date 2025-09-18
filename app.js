/* app.js — v30 (AL照会 安定化版) */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDF5-aN-oLg_-wyqEpMSdcvcU";
  const CATS = [
    { key: "charge", label: "チャージ", s1: "チャージAL①", s2: "チャージAL②" },
    { key: "nft",    label: "NFTコラボ", s1: "NFTコラボAL①", s2: "NFTコラボAL②" },
    { key: "guild",  label: "ギルドミッション", s1: "ギルドミッションAL①", s2: "ギルドミッションAL②" },
    { key: "greet",  label: "挨拶タップ", s1: "挨拶タップAL①", s2: "挨拶タップAL②" },
  ];
  const GAP_MS = 700;              // リクエスト間隔（レート制限回避）
  const TTL_MS = 5 * 60 * 1000;    // メモリキャッシュ 5分

  // ===== DOM =====
  const $  = s => document.querySelector(s);
  const input    = $("#slugInput");
  const btn      = $("#searchBtn");
  const statusEl = $("#resultStatus");

  // ===== Utils =====
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s ?? "").normalize("NFKC").trim().toLowerCase();

  // メモリキャッシュ
  const mem = new Map(); // sheetName -> {t, set:Set<string>}

  async function fetchCsvSet(sheetName, attempt = 1) {
    const now = Date.now();
    const hit = mem.get(sheetName);
    if (hit && now - hit.t < TTL_MS) return hit.set;

    const url =
      `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq` +
      `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}` +
      `&tq=${encodeURIComponent('select A where A is not null label A ""')}`;

    try {
      // キャッシュを積極利用（同じシートはブラウザから返る）
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();

      // 1列目だけを集合化
      const set = new Set(
        text.split(/\r?\n/).map(r => r.replace(/^"|"$/g, "").split(",")[0])
            .filter(Boolean).map(norm)
      );
      mem.set(sheetName, { t: now, set });
      return set;
    } catch (e) {
      if (attempt < 3) {
        await sleep(400 * Math.pow(2, attempt - 1)); // 0.4s,0.8s
        return fetchCsvSet(sheetName, attempt + 1);
      }
      // 最後まで失敗したら空集合（全滅でなければ前回状態を維持できる）
      return new Set();
    }
  }

  async function loadAll() {
    const out = {};
    for (const c of CATS) {
      out[c.s1] = await fetchCsvSet(c.s1);
      await sleep(GAP_MS);
      out[c.s2] = await fetchCsvSet(c.s2);
      await sleep(GAP_MS);
    }
    return out;
  }

  function setBadge(catKey, which, on) {
    const id = which === 1 ? `#al1-${catKey}` : `#al2-${catKey}`;
    const el = $(id);
    if (!el) return;
    el.classList.toggle("on", !!on);
    el.classList.toggle("off", !on);
    el.ariaPressed = on ? "true" : "false";
    el.textContent = (which === 1 ? "AL①" : "AL②") + (on ? " ✓" : " —");
  }

  function clearBadges() {
    CATS.forEach(c => { setBadge(c.key, 1, false); setBadge(c.key, 2, false); });
  }

  async function doSearch() {
    const raw = input.value;
    const slug = norm(raw);
    if (!slug) { statusEl.textContent = "未検索です。"; clearBadges(); return; }

    // 連打防止
    if (btn) btn.disabled = true;
    statusEl.textContent = "照会中…";

    try {
      const sets = await loadAll();

      let any = false;
      for (const c of CATS) {
        const h1 = sets[c.s1].has(slug);
        const h2 = sets[c.s2].has(slug);
        setBadge(c.key, 1, h1);
        setBadge(c.key, 2, h2);
        if (h1 || h2) any = true;
      }
      statusEl.textContent = any ? raw : "該当なし。slugを確認。";
    } catch {
      // ここには基本来ない（fetchCsvSetで握り潰して空集合返すため）
      statusEl.textContent = "取得エラー。時間をおいて再実行してください。";
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  btn?.addEventListener("click", (e) => { e.preventDefault(); if (!btn.disabled) doSearch(); });
  input?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !btn.disabled) doSearch(); });

  // 初期化
  clearBadges();

  // ===== ブレ撮り関係は触らない =====
})();
