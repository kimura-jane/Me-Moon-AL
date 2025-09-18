/* app.js — AL照会のみ。ブレ撮りの挙動は触らない */
(() => {
  "use strict";

  // ====== Config ======
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDF5-aN-oLg_-wyqEpMSdcvcU"; // ←あなたのスプシID
  // それぞれのシート名は実在する名前に合わせる
  const GROUPS = [
    { key: "charge", title: "チャージ", sheets: [{ n: 1, name: "チャージAL①" }, { n: 2, name: "チャージAL②" }] },
    { key: "nft",    title: "NFTコラボ", sheets: [{ n: 1, name: "NFTコラボAL①" }, { n: 2, name: "NFTコラボAL②" }] },
    { key: "guild",  title: "ギルドミッション", sheets: [{ n: 1, name: "ギルドミッションAL①" }, { n: 2, name: "ギルドミッションAL②" }] },
    { key: "hello",  title: "挨拶タップ", sheets: [{ n: 1, name: "挨拶タップAL①" }, { n: 2, name: "挨拶タップAL②" }] },
  ];

  // ====== DOM ======
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const form = $("#search-form");
  const input = $("#slug-input");
  const echo = $("#query-echo");
  const err = $("#error-msg");
  const list = $("#al-list");

  // 初期状態（未検索スタイル）
  function resetUI() {
    echo.textContent = "未検索です。";
    err.hidden = true;
    $$(".pill", list).forEach(p => {
      p.classList.remove("is-on","is-off");
      // 初期の薄い表示
      p.style.opacity = ".45";
    });
  }
  resetUI();

  // ====== Utils ======
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // slug 標準化：大文字小文字/全角/空白/区切り記号の揺れを吸収
  function normalize(s) {
    if (!s) return "";
    const base = s.toString().normalize("NFKC").trim().toLowerCase();
    // 比較候補を数種類返す
    const a = base.replace(/\s+/g, "");
    const b = a.replace(/_/g, "-");
    const c = a.replace(/-/g, "_");
    return [a,b,c]; // 例: "me-moon", "me_moon"
  }

  // Google Sheets CSV を Set で取得
  async function fetchSet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
    const res = await fetch(url, { cache:"no-store" });
    if (!res.ok) throw new Error(`${sheetName} ${res.status}`);
    const text = await res.text();

    const set = new Set();
    text.split(/\r?\n/).forEach((line, i) => {
      // 1列目に slug（ヘッダ行も含む想定）
      const cell = (line.split(",")[0] || "").replace(/^["']|["']$/g,"");
      if (i === 0) return; // ヘッダ飛ばし
      const cand = normalize(cell);
      cand.forEach(v => v && set.add(v));
    });
    return set;
  }

  // 1グループ（AL①/②）の両シートを読む
  async function readGroup(group) {
    const result = { key: group.key, has1:false, has2:false };
    try {
      // レート制限避けに少し間隔
      const [s1, s2] = await Promise.all([
        fetchSet(group.sheets[0].name),
        (async () => { await sleep(120); return fetchSet(group.sheets[1].name); })(),
      ]);
      result.s1 = s1; result.s2 = s2;
    } catch (e) {
      throw e;
    }
    return result;
  }

  // UI 反映
  function applyUI(groupKey, ok1, ok2) {
    const card = $(`.card[data-key="${groupKey}"]`, list);
    if (!card) return;
    const pill1 = $(`.pill[data-kind="1"]`, card);
    const pill2 = $(`.pill[data-kind="2"]`, card);
    // 一旦リセット
    [pill1,pill2].forEach(p => p.classList.remove("is-on","is-off"));
    // ON/OFF 付与
    pill1.classList.add(ok1 ? "is-on" : "is-off");
    pill2.classList.add(ok2 ? "is-on" : "is-off");
    // 初期薄さ解除
    [pill1,pill2].forEach(p => p.style.opacity = "");
  }

  // ====== Search flow ======
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    const q = input.value;
    const variants = normalize(q);
    if (!variants[0]) {
      resetUI();
      return;
    }

    // 表示まわり初期化
    echo.textContent = `照会: ${q}`;
    err.hidden = true;
    // いったん薄表示解除
    $$(".pill", list).forEach(p => p.style.opacity = "");

    try {
      // すべてのグループのシートを取得
      const data = [];
      for (const g of GROUPS) {
        // 連打でスロットリングを避けるため順次取得
        const r = await readGroup(g);
        data.push(r);
        await sleep(120);
      }

      // 照合 & 反映
      data.forEach(d => {
        const hit1 = variants.some(v => d.s1.has(v));
        const hit2 = variants.some(v => d.s2.has(v));
        applyUI(d.key, hit1, hit2);
      });

    } catch (e) {
      console.error(e);
      err.hidden = false;
      // エラー時はボタン/見た目はそのまま（前回の結果を消したくない場合）
    }
  });

})();
