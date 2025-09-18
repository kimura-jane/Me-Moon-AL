/* app.js — fix buttons & exact slug match via Sheets */
(() => {
  "use strict";

  /*** ===== Config ===== ***/
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

  // 表示するカテゴリ（順番固定）
  const CATS = [
    { key: "チャージ", sheets: ["チャージAL①", "チャージAL②"], dot: "🟠" },
    { key: "NFTコラボ", sheets: ["NFTコラボAL①", "NFTコラボAL②"], dot: "🟢" },
    { key: "ギルドミッション", sheets: ["ギルドミッションAL①", "ギルドミッションAL②"], dot: "🟣" },
    { key: "挨拶タップ", sheets: ["挨拶タップAL①", "挨拶タップAL②"], dot: "🩷" },
  ];

  /*** ===== DOM helper ===== ***/
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // どんな HTML でもボタンを拾える総当りセレクタ
  const SEARCH_BTN_SEL =
    "#searchBtn, #btnSearch, #search, button[data-action='search'], .js-search, .search-btn, button[type='submit']";
  const INPUT_SEL =
    "#slugInput, #slug, input[name='slug'], .slug-input, .js-slug, input[type='text']";

  // スラグの正規化（表/全角・ダッシュ類も吸収）
  const norm = (s) =>
    (s || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[‐-‒–—―ー−]/g, "-") // 各種ダッシュ→半角ハイフン
      .replace(/\s+/g, "");

  // Sheets CSV を 1 列(A列)だけ読む
  async function fetchSet(sheetName) {
    const url =
      `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq` +
      `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&range=A:A`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${sheetName} fetch ${res.status}`);
    const text = await res.text();

    // 1 行目は見出しとしてスキップ、空は捨てる
    const set = new Set(
      text
        .split(/\r?\n/)
        .slice(1)
        .map((v) => norm(v))
        .filter(Boolean)
    );
    return set;
  }

  // 1 カテゴリ分の判定（AL①/AL② の2枚）
  async function checkCategory(slugNorm, cat) {
    const [a1, a2] = await Promise.all([fetchSet(cat.sheets[0]), fetchSet(cat.sheets[1])]);
    return {
      key: cat.key,
      dot: cat.dot,
      has: [a1.has(slugNorm), a2.has(slugNorm)],
    };
  }

  // すべてのカテゴリを並列で判定
  async function checkAll(slugRaw) {
    const s = norm(slugRaw);
    if (!s) return null;
    const results = await Promise.all(CATS.map((c) => checkCategory(s, c)));
    return { slugDisp: slugRaw.trim(), results };
  }

  // 結果描画（既存 HTML に依存せず、結果枠 #resultArea に丸ごと差し込む）
  function renderResult(payload) {
    const box =
      $("#resultArea") ||
      $("#result") ||
      $(".js-result") ||
      // なければ自動生成して「照会結果」セクションの最初に置く
      (() => {
        const sec = document.createElement("section");
        sec.id = "resultArea";
        const anchor =
          $("section.results") || $("section") || $("main") || document.body;
        anchor.insertAdjacentElement("afterbegin", sec);
        return sec;
      })();

    if (!payload) {
      box.innerHTML = `<div class="card"><div class="muted">未検索です。</div></div>`;
      return;
    }

    const rows = payload.results
      .map((r) => {
        const badge = (ok, label) =>
          `<div class="pill ${ok ? "on" : ""}" aria-pressed="${ok}">
             <span>${label}</span>${ok ? "<b>✓</b>" : ""}
           </div>`;
        return `
          <div class="card cat">
            <div class="cat-head">
              <span class="dot">${r.dot}</span>
              <h3>${r.key}</h3>
            </div>
            <div class="pills">
              ${badge(r.has[0], "AL①")}
              ${badge(r.has[1], "AL②")}
            </div>
          </div>`;
      })
      .join("");

    box.innerHTML = `
      <div class="card headline">
        <div class="muted">照会: <b>${escapeHtml(payload.slugDisp)}</b></div>
      </div>
      ${rows}
    `;
  }

  // 影響範囲が小さい素朴なエスケープ
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ボタン & Enter キーで検索を走らせる
  function bindSearch() {
    const btn =
      $(SEARCH_BTN_SEL) ||
      // 最後の保険: 一番大きいボタンを拾う
      $$("button").sort((a, b) => b.offsetWidth - a.offsetWidth)[0];

    const input = $(INPUT_SEL) || $$("input")[0];

    if (!btn || !input) return; // HTML になかった場合は静かに終了

    const run = async () => {
      try {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        renderResult(null); // 「未検索です。」の消去
        const data = await checkAll(input.value);
        renderResult(data);
      } catch (e) {
        console.error(e);
        alert("検索でエラーが発生しました。通信状況とスプシ公開設定を確認してください。");
      } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
      }
    };

    // click / touchend / Enter
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      run();
    });
    btn.addEventListener("touchend", (e) => {
      e.preventDefault();
      e.stopPropagation();
      run();
    }, { passive: false });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        run();
      }
    });
  }

  // 初期化（JS エラーで止まらないように丁寧に）
  function init() {
    try {
      bindSearch();
      // 初期状態
      renderResult(null);
    } catch (e) {
      console.error("init error:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
