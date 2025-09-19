/* /assets/js/blurs.js
   ブレ撮り専用。既存コードには一切干渉しない安全設計。
*/
(() => {
  'use strict';

  // DOM が無いページでも落ちないように安全チェック
  function $(sel){ return document.querySelector(sel); }

  const UI = {
    img: $('#blur-img'),
    cap: $('#blur-cap'),
    btn: $('#btn-next-blur')
  };
  if(!UI.img || !UI.cap || !UI.btn){
    // このページにブレ撮りUIが無いなら何もしない
    return;
  }

  const CONF = {
    manifestUrl: './blurs/manifest.json',
    baseDir: './blurs/'
  };

  let pool = [];
  let index = 0;

  // ＝＝＝ Utils ＝＝＝
  // 例：2025-09-06_masa_001.jpeg → 「2025年9月6日 masa (001)」
  function prettyCaptionFromFilename(filename){
    // 拡張子を除去
    const base = filename.replace(/\.[^.]+$/, '');

    // 期待フォーマット: YYYY-MM-DD_name_###  （nameにハイフン/アンダースコアOK）
    const m = base.match(/^(\d{4})-(\d{1,2})-(\d{1,2})_([^_]+)_(\d{3,})$/);
    if(!m){
      // 想定外でも壊さず素のファイル名を返す
      return base;
    }
    const [, y, mo, d, nameRaw, seq] = m;

    // 名前はそのまま（u-masaki 等はそのまま表示）にするが、
    // 「_」はスペースに見えるように軽く整形（必要なければ削ってOK）
    const name = nameRaw.replace(/_/g, ' ');

    // ゼロ詰めされていない月日のままでもOK。日本語年月日に整形。
    const ymdd = `${Number(y)}年${Number(mo)}月${Number(d)}日`;

    return `${ymdd} ${name} (${seq})`;
  }

  // キャプションは manifest の label があれば優先、なければファイル名から生成
  function buildCaption(entry){
    if(entry && typeof entry.label === 'string' && entry.label.trim()){
      return entry.label.trim();
    }
    return prettyCaptionFromFilename(entry.file || '');
  }

  // 配列シャッフル（Fisher–Yates）
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 画像を1枚表示
  function show(i){
    const item = pool[i];
    if(!item) return;
    // 先にキャプション
    UI.cap.textContent = buildCaption(item);
    // 画像差し替え（読み込み中のチラつき対策で一旦空→セット）
    UI.img.removeAttribute('src');
    UI.img.alt = item.file;
    UI.img.src = CONF.baseDir + item.file;
  }

  // 次のブレ（末尾まで来たら再シャッフル）
  function next(){
    if(pool.length === 0) return;
    index = (index + 1) % pool.length;
    if(index === 0) shuffle(pool);
    show(index);
  }

  // マニフェスト取得（GitHub Pages キャッシュを避ける）
  async function loadManifest(){
    const res = await fetch(CONF.manifestUrl, { cache: 'no-store' });
    if(!res.ok) throw new Error('manifest fetch failed');
    const man = await res.json();
    const list = Array.isArray(man.images) ? man.images : [];

    // 型ゆるめでも安全に吸収
    pool = list
      .map(x => (typeof x === 'string' ? { file:x } : x))
      .filter(x => x && typeof x.file === 'string' && x.file.trim());

    if(pool.length === 0) throw new Error('no images in manifest');

    shuffle(pool);
    index = 0;
    show(0);
  }

  // クリックで切り替え
  UI.btn.addEventListener('click', next);

  // 初期化
  loadManifest().catch(err => {
    console.error(err);
    UI.cap.textContent = '画像を読み込めませんでした';
  });
})();
