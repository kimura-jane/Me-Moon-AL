/* ===== ブレ撮り：1枚ランダム表示（重複回避付き） ===== */
(() => {
  const BLUR_DIR = 'blurs';
  const MANIFEST_PATH = `${BLUR_DIR}/manifest.json`;
  const POOL_KEY = 'blur_pool_v1';
  const BUTTON_IDS = ['blurRefresh', 'refreshBlursBtn', 'refreshBlur', 'refreshBtn']; // 手元のIDが違えばここに追加
  let manifestCache = null;

  async function loadManifest() {
    if (manifestCache) return manifestCache;
    const res = await fetch(MANIFEST_PATH, { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest.json を読み込めませんでした');
    manifestCache = await res.json();
    return manifestCache;
  }

  // セッション内で重複しないようにシャッフル済みプールから1件取り出す
  function nextIndex(n) {
    let pool;
    try { pool = JSON.parse(sessionStorage.getItem(POOL_KEY) || '[]'); } catch { pool = []; }
    if (!Array.isArray(pool) || pool.length === 0 || pool.some(i => i >= n)) {
      // 新しくシャッフル
      pool = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) {
        const rand = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [pool[i], pool[rand]] = [pool[rand], pool[i]];
      }
    }
    const idx = pool.pop();
    sessionStorage.setItem(POOL_KEY, JSON.stringify(pool));
    return idx;
  }

  function renderOne(item) {
    const wrap = document.getElementById('blurGrid');
    if (!wrap) return;
    wrap.innerHTML = ''; // 1枚だけにする

    const fig = document.createElement('figure');
    fig.className = 'blur-card';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = `${item.author} – ${item.date}`;
    img.src = `${BLUR_DIR}/${item.file}`;
    fig.appendChild(img);

    const cap = document.createElement('figcaption');
    cap.className = 'blur-cap';
    cap.textContent = `${item.author} – ${item.date}`;
    fig.appendChild(cap);

    wrap.appendChild(fig);
  }

  async function showRandomBlur() {
    const wrap = document.getElementById('blurGrid');
    try {
      const data = await loadManifest();
      const list = Array.isArray(data.images) ? data.images : [];
      if (!list.length) {
        if (wrap) wrap.innerHTML = `<div class="note">画像がありません。</div>`;
        return;
      }
      const idx = nextIndex(list.length);
      renderOne(list[idx]);
    } catch (e) {
      if (wrap) wrap.innerHTML = `<div class="note">読み込み失敗：${e.message}</div>`;
    }
  }

  // 初期化：読み込み時 & 更新ボタン
  document.addEventListener('DOMContentLoaded', showRandomBlur);
  BUTTON_IDS.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', showRandomBlur);
  });
})();
