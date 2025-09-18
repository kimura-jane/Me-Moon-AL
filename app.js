/* app.js — v27 (AL判定のみ安定化) */
(() => {
  "use strict";

  // ====== Config ======
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDF5-aN-oLg_-wyqEpMSdcvcU";
  const CATS = [
    { key: "charge", label: "チャージ",  s1: "チャージAL①",     s2: "チャージAL②"     },
    { key: "nft",    label: "NFTコラボ", s1: "NFTコラボAL①",    s2: "NFTコラボAL②"    },
    { key: "guild",  label: "ギルドミッション", s1: "ギルドミッションAL①", s2: "ギルドミッションAL②" },
    { key: "greet",  label: "挨拶タップ", s1: "挨拶タップAL①",   s2: "挨拶タップAL②"   },
  ];

  // ====== DOM ======
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const input = $("#slugInput");
  const btn   = $("#searchBtn");
  const statusEl = $("#resultStatus");

  // ====== Utils ======
  const normalize = (s) =>
    (s ?? "")
      .normalize("NFKC")
      .trim()
      .toLowerCase();

  // メモリキャッシュ（5分）
  const cache = new Map();
  const TTL_MS = 5 * 60 * 1000;

  async function fetchSheetAsSet(sheetName, attempt = 1) {
    const now = Date.now();
    const c = cache.get(sheetName);
    if (c && now - c.t < TTL_MS) return c.set;

    const url =
      `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq` +
      `?tqx=out:csv&headers=0&sheet=${encodeURIComponent(sheetName)}`;

    try {
      const res = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const csv = await res.text();

      // 1列目だけを見る（空行除去）
      const set = new Set(
        csv.split(/\r?\n/).map(r => r.replace(/^"|"$/g, "").split(",")[0])
           .filter(v => v && v.length)
           .map(normalize)
      );

      cache.set(sheetName, { t: now, set });
      return set;

    } catch (e) {
      // バックオフ再試行（最大3回）
      if (attempt < 3) {
        const wait = 400 * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, wait));
        return fetchSheetAsSet(sheetName, attempt + 1);
      }
      throw e;
    }
  }

  // 直列で全シート取得（バースト抑制）
  async function loadAllSets() {
    const result = {};
    for (const cat of CATS) {
      result[cat.s1] = await fetchSheetAsSet(cat.s1);
      result[cat.s2] = await fetchSheetAsSet(cat.s2);
    }
    return result;
  }

  function setBadge(catKey, which, on) {
    const id = which === 1 ? `#al1-${catKey}` : `#al2-${catKey}`;
    const el = $(id);
    if (!el) return;
    el.classList.toggle("on", !!on);
    el.classList.toggle("off", !on);
    el.ariaPressed = on ? "true" : "false";
    // 表示テキストは既存の「AL①/AL②」を保ちつつ印を付ける
    const base = which === 1 ? "AL①" : "AL②";
    el.textContent = on ? `${base} ✓` : `${base} —`;
  }

  function clearAllBadges() {
    CATS.forEach(c => {
      setBadge(c.key, 1, false);
      setBadge(c.key, 2, false);
    });
  }

  async function onSearch() {
    const raw = input.value;
    const slug = normalize(raw);
    if (!slug) {
      statusEl.textContent = "未検索です。";
      clearAllBadges();
      return;
    }

    // 二重発火防止
    btn.disabled = true;
    btn.classList.add("loading");
    statusEl.textContent = "照会中…";

    try {
      const sets = await loadAllSets(); // 直列＋再試行済み

      // 判定
      let anyHit = false;
      for (const cat of CATS) {
        const has1 = sets[cat.s1].has(slug);
        const has2 = sets[cat.s2].has(slug);
        setBadge(cat.key, 1, has1);
        setBadge(cat.key, 2, has2);
        if (has1 || has2) anyHit = true;
      }

      statusEl.textContent = anyHit ? raw : "該当なし。slugを確認。";

    } catch (e) {
      // 取得エラー表示（カードは前回状態を維持）
      statusEl.textContent = "取得エラー。時間をおいて再実行してください。";
    } finally {
      btn.disabled = false;
      btn.classList.remove("loading");
    }
  }

  // ====== Wire ======
  btn?.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (btn.disabled) return;
    onSearch();
  });

  // Enterキーで検索
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !btn.disabled) onSearch();
  });

  // 初期状態はバッジをオフ表示に統一
  clearAllBadges();

  // ====== ブレ撮り（既存をそのまま使用） ======
  // ここは触らない。既存の initBlur() 等があればそのまま別ファイル/同ファイルで動作させてOK。
})();
