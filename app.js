/* ===== Me-Moon AL Checker (DEBUG build) =====
   - シートID固定（あなたのID）
   - 失敗時フェイルセーフ
   - ブレ撮りは blurs/manifest.json → /manifest.json の順に探す
   - DEBUG=true で詳細ログ
*/
(() => {
  const DEBUG = false;
  const log = (...a)=>{ if(DEBUG) console.log('[AL]', ...a); };

  const SHEET_ID = '1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU';

  const CATEGORIES = [
    { name:'チャージ', color:'var(--ok)', sheets:['チャージAL①','チャージAL②'] },
    { name:'NFTコラボ', color:'var(--nft)', sheets:['NFTコラボAL①','NFTコラボAL②'] },
    { name:'ギルドミッション', color:'var(--guild)', sheets:['ギルドミッションAL①','ギルドミッションAL②'] },
    { name:'挨拶タップ', color:'var(--hello)', sheets:['挨拶タップAL①','挨拶タップAL②'] },
  ];

  const $ = s => document.querySelector(s);
  const slugInput = $('#slugInput');
  const searchBtn = $('#searchBtn');
  const resultBody = $('#resultBody');
  const qSpan = $('#q');
  const alList = $('#alList');
  const bureImg = $('#bureImg');
  const bureCap = $('#bureCaption');
  const refreshBlurBtn = $('#refreshBlurBtn');

  function renderAlList(){
    alList.innerHTML = '';
    for(const cat of CATEGORIES){
      const el = document.createElement('div');
      el.className = 'alCard';
      el.innerHTML = `
        <div class="alHead">
          <span class="dot" style="background:${cat.color}"></span>
          <div class="alName">${cat.name}</div>
        </div>
        <div class="alChips">
          <div class="oval">AL①</div>
          <div class="oval">AL②</div>
        </div>`;
      alList.appendChild(el);
    }
  }
  renderAlList();

  // -------- Google Sheets (GViz) ----------
  const cache = new Map(); // sheetName -> Set
  async function fetchSheet(sheetName){
    if(cache.has(sheetName)) return cache.get(sheetName);
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=0&sheet=${encodeURIComponent(sheetName)}&range=A:A`;
    log('fetchSheet:', sheetName, url);
    try{
      const res = await fetch(url, {cache:'no-store'});
      const txt = await res.text();
      // GViz は前置き付き JS なので JSON 部分だけ抜く
      const json = JSON.parse(txt.replace(/^[^{]+/,'').replace(/;?\s*$/,''));
      const rows = (json.table?.rows)||[];
      const set = new Set();
      for(const r of rows){
        const v = (r?.c?.[0]?.v ?? '').toString().trim();
        if(v) set.add(v);
      }
      cache.set(sheetName, set);
      log('sheet ok:', sheetName, set.size);
      return set;
    }catch(e){
      console.warn('sheet fail:', sheetName, e);
      const empty = new Set();
      cache.set(sheetName, empty);
      return empty;
    }
  }
  // 体感向上のためプリフェッチ
  Promise.all(CATEGORIES.flatMap(c => c.sheets.map(fetchSheet))).catch(()=>{});

  // -------- 検索 ----------
  async function onSearch(){
    const slug = (slugInput.value||'').trim();
    qSpan.textContent = slug || '-';
    if(!slug){
      resultBody.innerHTML = `<div class="muted">slugを入力してください。</div>`;
      return;
    }
    const hits = [];
    for(const cat of CATEGORIES){
      const [s1, s2] = await Promise.all(cat.sheets.map(fetchSheet));
      const in1 = s1.has(slug);
      const in2 = s2.has(slug);
      if(in1 || in2) hits.push({cat,in1,in2});
    }
    if(hits.length===0){
      resultBody.innerHTML = `<div class="muted">該当なし。slugを確認。</div>`;
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'chips';
    for(const h of hits){
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `
        <span class="dot" style="background:${h.cat.color}"></span>
        <span>${h.cat.name}</span>
        ${h.in1? `<span class="oval" style="margin-left:6px">AL①</span>`:''}
        ${h.in2? `<span class="oval">AL②</span>`:''}`;
      wrap.appendChild(chip);
    }
    resultBody.innerHTML = '';
    resultBody.appendChild(wrap);
  }

  // -------- ブレ撮り（ランダム1枚） ----------
  const MANIFEST_PATHS = ['blurs/manifest.json','manifest.json']; // 両方探す
  async function loadManifest(){
    for(const p of MANIFEST_PATHS){
      try{
        const res = await fetch(`${p}?ts=${Date.now()}`, {cache:'no-store'});
        if(res.ok){
          const m = await res.json();
          if(Array.isArray(m.images) && m.images.length){
            log('manifest ok:', p, m.images.length);
            return m;
          }
        }
      }catch(e){
        log('manifest fail:', p, e);
      }
    }
    throw new Error('manifest not found');
  }
  async function pickRandomBlur(){
    try{
      const man = await loadManifest();
      const arr = man.images;
      const i = Math.floor(Math.random()*arr.length);
      const it = arr[i];
      const file = it.file || '';
      const a = it.author || (file.split('_')[2]||'');
      const d = it.date || '';
      const base = file.startsWith('blurs/') ? '' : 'blurs/';
      bureImg.src = `${base}${file}`;
      bureImg.alt = `${a} / ${d}`;
      bureCap.textContent = `${a} / ${d}`;
    }catch(e){
      console.warn(e);
      bureImg.removeAttribute('src');
      bureImg.alt = '';
      bureCap.textContent = 'manifest.json が見つからない。';
    }
  }
  function glitchOnce(el){
    el.classList.remove('glitch'); void el.offsetWidth; el.classList.add('glitch');
  }

  // -------- イベント --------
  searchBtn.addEventListener('click', onSearch);
  slugInput.addEventListener('keydown', e=>{ if(e.key==='Enter') onSearch(); });
  refreshBlurBtn.addEventListener('click', pickRandomBlur);
  bureCap.addEventListener('click', ()=>glitchOnce(bureCap));

  // 初期表示
  pickRandomBlur();

  // 手動テスト用
  window.__ALDEBUG__ = { onSearch, pickRandomBlur, fetchSheet };
})();
