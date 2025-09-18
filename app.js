/* ===== Me-Moon AL Checker =====
   1) GoogleスプシからALメンバーを取得（失敗時は空で継続）
   2) 検索で所属カテゴリを表示
   3) /blurs/manifest.json から毎回ランダムで1枚表示（更新で再抽選）
*/
(() => {
  // ▼ スプシID（あなたがくれたもの）
  const SHEET_ID = '1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU';

  // ▼ カテゴリと対応シート名
  const CATEGORIES = [
    { name:'チャージ', color:'var(--ok)', sheets:['チャージAL①','チャージAL②'] },
    { name:'NFTコラボ', color:'var(--nft)', sheets:['NFTコラボAL①','NFTコラボAL②'] },
    { name:'ギルドミッション', color:'var(--guild)', sheets:['ギルドミッションAL①','ギルドミッションAL②'] },
    { name:'挨拶タップ', color:'var(--hello)', sheets:['挨拶タップAL①','挨拶タップAL②'] },
  ];

  // DOM
  const $ = sel => document.querySelector(sel);
  const slugInput = $('#slugInput');
  const searchBtn = $('#searchBtn');
  const resultPanel = $('#resultPanel');
  const resultBody = $('#resultBody');
  const qSpan = $('#q');
  const alList = $('#alList');
  const bureImg = $('#bureImg');
  const bureCap = $('#bureCaption');
  const refreshBlurBtn = $('#refreshBlurBtn');

  // =====  UI：ALの種類カード =====
  function renderAlList(){
    alList.innerHTML = '';
    for(const cat of CATEGORIES){
      const card = document.createElement('div');
      card.className = 'alCard';
      card.innerHTML = `
        <div class="alHead">
          <span class="dot" style="background:${cat.color}"></span>
          <div class="alName">${cat.name}</div>
        </div>
        <div class="alChips">
          <div class="oval">AL①</div>
          <div class="oval">AL②</div>
        </div>`;
      alList.appendChild(card);
    }
  }
  renderAlList();

  // =====  データ取得（Google Sheets GViz） =====
  // 公開されていない場合は fetch が失敗するので、その時は空Setで続行
  const sheetCache = new Map(); // sheetName -> Set(slugs)
  async function fetchSheet(sheetName){
    if(sheetCache.has(sheetName)) return sheetCache.get(sheetName);
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=0&sheet=${encodeURIComponent(sheetName)}&range=A:A`;
    try{
      const res = await fetch(url, {cache:'no-store'});
      const text = await res.text();
      // GViz 形式をJSON抽出
      const json = JSON.parse(text.replace(/^[^\{]+/, '').replace(/;?$/,''));
      const rows = (json.table.rows||[]);
      const set = new Set();
      for(const r of rows){
        if(!r || !r.c || !r.c[0]) continue;
        const v = (r.c[0].v ?? '').toString().trim();
        if(v) set.add(v);
      }
      sheetCache.set(sheetName, set);
      return set;
    }catch(e){
      // 失敗時は空
      const empty = new Set();
      sheetCache.set(sheetName, empty);
      return empty;
    }
  }

  // すべてのシートを事前ウォーム（初回体感改善 & 失敗してもUIは生きる）
  async function warmUp(){
    await Promise.all(CATEGORIES.flatMap(c => c.sheets.map(fetchSheet))).catch(()=>{});
  }
  warmUp();

  // ===== 検索処理 =====
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
      if(in1 || in2){
        hits.push({cat,in1,in2});
      }
    }

    if(hits.length === 0){
      resultBody.innerHTML = `<div class="muted">該当なし。slugを確認。</div>`;
      return;
    }

    // ヒット表示（チップ）
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

  // ===== ブレ撮り：manifest.json からランダム1枚 =====
  const BLUR_BASE = 'blurs/';
  async function pickRandomBlur(){
    try{
      const res = await fetch(`${BLUR_BASE}manifest.json?ts=${Date.now()}`, {cache:'no-store'});
      if(!res.ok) throw new Error('manifest not found');
      const man = await res.json();
      const arr = Array.isArray(man.images) ? man.images : [];
      if(arr.length === 0) throw new Error('empty');
      const i = Math.floor(Math.random()*arr.length);
      const item = arr[i];
      const file = item.file || '';
      const author = item.author || (file.split('_')[2]||'');
      const date = item.date || '';
      bureImg.src = `${BLUR_BASE}${file}`;
      bureImg.alt = `${author} / ${date}`;
      bureCap.textContent = `${author} / ${date}`;
    }catch(e){
      bureImg.removeAttribute('src');
      bureImg.alt = '';
      bureCap.textContent = 'manifest.json が見つからない。';
    }
  }

  // 文字ブレ（キャプションをタップ）
  function glitchOnce(el){
    el.classList.remove('glitch');
    // reflow to restart animation
    void el.offsetWidth;
    el.classList.add('glitch');
  }

  // ===== イベント =====
  searchBtn.addEventListener('click', onSearch);
  slugInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') onSearch(); });
  refreshBlurBtn.addEventListener('click', pickRandomBlur);
  bureCap.addEventListener('click', ()=>glitchOnce(bureCap));

  // 初期表示
  pickRandomBlur();
})();
