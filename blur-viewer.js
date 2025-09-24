/* /blur-viewer.js を全置換 */
(() => {
  'use strict';

  const UI = {
    img: document.querySelector('#blur-img'),
    cap: document.querySelector('#blur-cap'),
    btn: document.querySelector('#btn-next-blur')
  };
  if (!UI.img || !UI.cap || !UI.btn) return;

  const shuffle = (a) => { for (let i=a.length-1; i>0; i--) {
    const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]];
  } return a; };

  async function loadList(){
    const res = await fetch('./blurs/manifest.json', { cache:'no-store' });
    const man = await res.json();
    const files = (man.images||[])
      .map(o => String(o.file).trim())
      .filter(Boolean)
      .map(f => `./blurs/${f}`);

    // 404 を事前に弾く（コンソールに missing: を出す）
    const ok = [];
    await Promise.all(files.map(u => new Promise((resolve)=>{
      const im = new Image();
      im.onload = () => { ok.push(u); resolve(); };
      im.onerror = () => { console.warn('missing:', u); resolve(); };
      im.src = u;
    })));
    return shuffle(ok);
  }

  let order = [], idx = 0;
  const show = (i) => {
    if (!order.length) return;
    idx = (i + order.length) % order.length;
    const url = order[idx];
    UI.img.src = `${url}?t=${Date.now()}`;      // キャッシュ破り
    const name = url.split('/').pop();
    UI.cap.textContent = name.replace(/\.(jpe?g|png|webp)$/i,'');
  };

  loadList().then(list => {
    order = list;
    if (!order.length){ UI.cap.textContent = '画像が見つかりません'; return; }
    show(0);
    UI.btn.addEventListener('click', () => show(idx + 1));
  });
})();
