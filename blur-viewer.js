(()=>{'use strict';
// ページ側の要素ID（違っていたらここだけ直す）
const IMG ='#blurImg';      // 画像 <img>
const CAP ='#blurCap';      // キャプション表示の要素
const BTN ='#btnRefresh';   // 「次のブレ」ボタン

// "YYYY-M-D_name_###.jpg" → "YYYY年M月D日name(###)" に整形
function toJpLabel(file){
  const m = file.match(/(\d{4})-(\d{1,2})-(\d{1,2})_([^_]+)_(\d{3})\.(?:jpe?g|png|webp)$/i);
  if(!m) return file;
  const [, y,M,D,name,idx] = m;
  return `${+y}年${+M}月${+D}日${name}(${idx})`;
}

async function init(){
  const img = document.querySelector(IMG);
  const cap = document.querySelector(CAP);
  const btn = document.querySelector(BTN);
  if(!img || !cap) return; // 対象が無いページでは何もしない

  // manifest.json を読み込み（キャッシュ回避クエリ付き）
  const res = await fetch('./blurs/manifest.json?ts=' + Date.now());
  if(!res.ok) return;
  const man  = await res.json();
  const list = (man.images || []).map(x => typeof x==='string' ? x : x.file).filter(Boolean);

  function show(){
    if(!list.length) return;
    const pick = list[Math.floor(Math.random()*list.length)];
    img.src = './blurs/' + pick;
    cap.textContent = toJpLabel(pick);
  }

  btn?.addEventListener('click', show);
  show();
}

document.addEventListener('DOMContentLoaded', init);
})();
