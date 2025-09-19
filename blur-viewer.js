(()=>{'use strict';
// あなたの要素ID（必要ならここだけ合わせてね）
const IMG ='#blurImg';
const CAP ='#blurCap';
const BTN ='#btnRefresh';

// "YYYY-M-D_name_###.ext" → "YYYY年M月D日name(###)"
function toJpLabelFromFilename(s){
  if(!s) return null;
  const f = String(s).split('/').pop(); // 末尾ファイル名だけ
  const m = f.match(/(\d{4})-(\d{1,2})-(\d{1,2})_([^_]+)_(\d{3})\.(?:jpe?g|png|webp)$/i);
  if(!m) return null;
  const [, y, M, D, name, idx] = m;
  return `${+y}年${+M}月${+D}日${name}(${idx})`;
}

function formatNow(){
  const img = document.querySelector(IMG);
  const cap = document.querySelector(CAP);
  if(!img || !cap) return;

  // 画像のsrcから優先してパース、ダメなら現在のテキストから
  let label = toJpLabelFromFilename(img.src) || toJpLabelFromFilename(cap.textContent?.trim());
  if(label) cap.textContent = label;
}

function init(){
  const img = document.querySelector(IMG);
  const cap = document.querySelector(CAP);
  if(!img || !cap) return;

  // 初期表示を整形
  formatNow();

  // 1) キャプションが他スクリプトで書き換わったら即整形
  new MutationObserver(formatNow)
    .observe(cap, {childList:true, characterData:true, subtree:true});

  // 2) 画像srcが変わったら整形
  new MutationObserver(formatNow)
    .observe(img, {attributes:true, attributeFilter:['src']});

  // 3) クリック時のフォールバック（既存ハンドラの後に実行）
  document.querySelector(BTN)?.addEventListener('click', () => {
    setTimeout(formatNow, 0);
  }, false);
}

document.addEventListener('DOMContentLoaded', init);
})();
