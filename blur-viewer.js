(()=>{'use strict';

// ==== 設定：IDが違う場合はここだけ合わせてね ====
const SEL = {
  img: '#blurImg',
  cap: '#blurCap',
  btn: '#btnRefresh'
};

// "YYYY-M-D_name_###(.ext|/)" → "YYYY年M月D日name(###)"
function toJpLabel(str){
  if(!str) return null;
  const s = String(str).split('/').pop(); // 末尾のファイル部分だけ
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})_([^_\/]+)_(\d{3})(?:\.[a-z0-9]+)?\/?$/i);
  if(!m) return null;
  const [, y, M, D, name, idx] = m;
  return `${+y}年${+M}月${+D}日${name}(${idx})`;
}

function formatNow(){
  try{
    const img = document.querySelector(SEL.img);
    const cap = document.querySelector(SEL.cap);
    if(!img || !cap) return;
    // 画像src → ダメなら現在のキャプション文字列から
    const label =
      toJpLabel(img.getAttribute('src')) ||
      toJpLabel(cap.textContent?.trim());
    if(label) cap.textContent = label;
  }catch(_e){ /* 何があっても他の処理を止めない */ }
}

function init(){
  const img = document.querySelector(SEL.img);
  const cap = document.querySelector(SEL.cap);

  // 初期表示を整形
  formatNow();

  // キャプションが他スクリプトで書き戻されても即整形
  if(cap){
    new MutationObserver(formatNow)
      .observe(cap, {childList:true, characterData:true, subtree:true});
  }

  // 画像srcが変わったら整形
  if(img){
    new MutationObserver(formatNow)
      .observe(img, {attributes:true, attributeFilter:['src']});
  }

  // 「次のブレ」クリック後、既存ハンドラのあとで整形（フォールバック）
  document.querySelector(SEL.btn)
    ?.addEventListener('click', ()=> setTimeout(formatNow,0), false);
}

document.addEventListener('DOMContentLoaded', init);
})();
