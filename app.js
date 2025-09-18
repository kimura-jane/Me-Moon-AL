/* app.js – v31: auto-run search on load */
(() => {
  "use strict";

  // ===== DOM helpers =====
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // できるだけ既存のID/属性に合わせて柔軟に取る
  const el = {
    input  : $('#slug, #slugInput, #q, [data-role="slug"]'),
    search : $('#search, #btnSearch, #doSearch, [data-role="search"]'),
    resultBox: $('#resultBox, #result, [data-role="result"]')
  };

  // ====== 既存の検索関数があるなら使う ======
  // 以前の実装名に合わせて探す（あるものを使う）
  const existingSearch =
    window.runSearch || window.doSearch || window.handleSearch || null;

  // ====== 正規化（既存の関数が無い時だけ使うダミー） ======
  // 既に照会ロジックがある前提。ここは触らない。
  async function fallbackSearch(slug) {
    // もし既存の runSearch などが無い場合でも落ちないようにするだけ。
    // 実際の照会は既存関数に任せたいので、ここは何もしない。
    console.warn('既存の検索関数が見つからないため、fallbackSearchが呼ばれました。');
    return;
  }

  // ====== 自動照会まわり ======
  const LS_KEY = 'mm_last_slug';
  let autoRan = false;

  // URL / LocalStorage から値を復元
  function restoreSlug() {
    if (!el.input) return '';
    const params = new URLSearchParams(location.search);
    const fromUrl = (params.get('slug') || '').trim();

    // 入力欄が空なら URL > LocalStorage の順で復元
    if (!el.input.value || !el.input.value.trim()) {
      if (fromUrl) {
        el.input.value = fromUrl;
      } else {
        const last = (localStorage.getItem(LS_KEY) || '').trim();
        if (last) el.input.value = last;
      }
    }
    return el.input.value.trim();
  }

  // 「ブラウザの自動補完が遅れて入る」Safari 対策：pageshow/DOMContentLoaded 後に少し待って実行
  function scheduleAutoRun() {
    if (autoRan) return;
    // 2段階でリトライ（autofill遅延に強くする）
    setTimeout(tryAutoRun, 180);
    setTimeout(tryAutoRun, 500);
  }

  function tryAutoRun() {
    if (autoRan || !el.input) return;
    const v = restoreSlug();
    if (!v) return;

    autoRan = true;
    // 連打やレート制限対策で少し間を空ける
    setTimeout(() => {
      if (existingSearch) {
        existingSearch(v);
      } else if (el.search) {
        // 既存のクリックハンドラに流す
        el.search.click();
      } else {
        // それも無い時の最終手段
        fallbackSearch(v);
      }
    }, 120);
  }

  // ====== 手動検索の保存フック ======
  function hookSearchButton() {
    if (!el.search || !el.input) return;
    // 既存の click を壊さないため、先にフックだけ
    el.search.addEventListener('click', () => {
      const v = (el.input.value || '').trim();
      if (v) {
        try { localStorage.setItem(LS_KEY, v); } catch {}
      }
    }, { capture: true });
  }

  // ====== 起動 ======
  function init() {
    hookSearchButton();
    restoreSlug();

    // 直近の「照会エラー」表示で画面が汚れないよう、初期化時に一旦クリア（既存UIを壊さない範囲）
    const err = $('.result-error, [data-role="result-error"]');
    if (err) err.textContent = '';

    scheduleAutoRun();
  }

  // ページ遷移復帰でも発火（iOS Safari対策）
  window.addEventListener('pageshow', init, { once: false });
  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
