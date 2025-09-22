(() => {
  'use strict';

  // ====== Google Sheets ======
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
  const GVIZ = id => `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&headers=1&sheet=`;

  // シート名（列Aに slug）
  const SHEETS = {
    charge: { s1: "チャージAL①", s2: "チャージAL②" },
    nft:    { s1: "NFTコラボAL①", s2: "NFTコラボAL②" },
    guild:  { s1: "ギルドミッションAL①", s2: "ギルドミッションAL②" },
    greet:  { s1: "挨拶タップAL①", s2: "挨拶タップAL②" }
  };

  // ====== 触るDOM（ALエリアのみ）======
  const UI = {
    input:  document.getElementById('slugInput')  || document.querySelector('input[name="slug"]'),
    btn:    document.getElementById('searchBtn')  || document.querySelector('button[data-role="search"]'),
    status: document.getElementById('statusSlug') || document.querySelector('[data-role="statusSlug"]'),
    err:    document.getElementById('alError')    || document.querySelector('[data-role="alError"]'),
    pills: {
      charge1: q('#pill-charge-1','[data-pill="charge-1"]'),
      charge2: q('#pill-charge-2','[data-pill="charge-2"]'),
      nft1:    q('#pill-nft-1','[data-pill="nft-1"]'),
      nft2:    q('#pill-nft-2','[data-pill="nft-2"]'),
      guild1:  q('#pill-guild-1','[data-pill="guild-1"]'),
      guild2:  q('#pill-guild-2','[data-pill="guild-2"]'),
      greet1:  q('#pill-greet-1','[data-pill="greet-1"]'),
      greet2:  q('#pill-greet-2','[data-pill="greet-2"]')
    }
  };
  function q(a,b){ return document.querySelector(a) || document.querySelector(b); }

  // ==== 起動（ブレ撮りには触れない）====
  document.addEventListener('DOMContentLoaded', () => {
    setAll(false);
    UI.btn?.addEventListener('click', run);
    UI.input?.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  });

  // === utils ===
  const norm = s => (s ? String(s).trim().replace(/\u3000/g,'').replace(/\s+/g,'').replace(/_/g,'-').toLowerCase() : '');
  function parseGViz(txt){ return JSON.parse(txt.replace(/^[^{]+/, '').replace(/;?\s*$/, '')); }

  function fetchSet(sheet){
    const url = GVIZ(FILE_ID) + encodeURIComponent(sheet) + '&tq=' + encodeURIComponent('select A');
    return fetch(url, {cache:'no-store'})
      .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
      .then(t => {
        const obj = parseGViz(t);
        const rows = obj.table?.rows || [];
        const set = Object.create(null);
        for (const row of rows){
          const v = row?.c?.[0]?.v;
          const n = norm(v);
          if(n) set[n] = true;
        }
        return set; // {slug:true,...}
      });
  }
// === AL価格 ===
const PRICE_MAP = {
  '#pill-charge-1': '¥3,000',
  '#pill-charge-2': '¥2,000',
  '#pill-nft-1'  : '¥3,000',
  '#pill-nft-2'  : '¥2,000',
  '#pill-guild-1': '¥3,000',
  '#pill-guild-2': '¥2,000',
  '#pill-greet-1': '¥5,000',
  '#pill-greet-2': '¥3,000'
};

// DOM準備後にボタンへ価格をセット
document.addEventListener('DOMContentLoaded', () => {
  for (const [sel, price] of Object.entries(PRICE_MAP)) {
    const el = document.querySelector(sel);
    if (el) el.dataset.price = price;
  }
});
  function setPill(el, on){
  if(!el) return;

  // 見た目状態
  el.classList.remove('is-on','is-off');
  el.classList.add(on ? 'is-on' : 'is-off');

  // ベース文字列を取得し、末尾の (数字) を除去
  const baseRaw = el.getAttribute('data-label') || el.textContent || '';
  const base    = baseRaw.replace(/\s*\(\d+\)\s*$/, '');

  // 表示を一旦テキストで作成（○/×は維持）
  el.textContent = `${base} ${on ? '○' : '×'}`;

  // data-count 起因の疑似要素を無効化
  el.removeAttribute('data-count');

  // 価格を付与（既存の .price は除去してから付け直し）
  el.querySelector('.price')?.remove();
  const price = el.dataset.price;
  if (price){
    const sp = document.createElement('span');
    sp.className = 'price';
    sp.textContent = price;
    el.appendChild(sp);
  }

  el.setAttribute('aria-pressed', on ? 'true' : 'false');
}
  function setAll(on){
    setPill(UI.pills.charge1,on); setPill(UI.pills.charge2,on);
    setPill(UI.pills.nft1,on);    setPill(UI.pills.nft2,on);
    setPill(UI.pills.guild1,on);  setPill(UI.pills.guild2,on);
    setPill(UI.pills.greet1,on);  setPill(UI.pills.greet2,on);
    if(UI.err){ UI.err.textContent=''; UI.err.classList.remove('show'); }
  }
  function showError(msg){ if(UI.err){ UI.err.textContent = msg; UI.err.classList.add('show'); } }

  function run(){
    setAll(false);
    const slug = norm(UI.input?.value || '');
    if(UI.status) UI.status.textContent = slug || '—';
    if(!slug) return;

    Promise.all([
      fetchSet(SHEETS.charge.s1), fetchSet(SHEETS.charge.s2),
      fetchSet(SHEETS.nft.s1),    fetchSet(SHEETS.nft.s2),
      fetchSet(SHEETS.guild.s1),  fetchSet(SHEETS.guild.s2),
      fetchSet(SHEETS.greet.s1),  fetchSet(SHEETS.greet.s2)
    ]).then(a => {
      setPill(UI.pills.charge1, !!a[0][slug]);
      setPill(UI.pills.charge2, !!a[1][slug]);
      setPill(UI.pills.nft1,    !!a[2][slug]);
      setPill(UI.pills.nft2,    !!a[3][slug]);
      setPill(UI.pills.guild1,  !!a[4][slug]);
      setPill(UI.pills.guild2,  !!a[5][slug]);
      setPill(UI.pills.greet1,  !!a[6][slug]);
      setPill(UI.pills.greet2,  !!a[7][slug]);
    }).catch(e => {
      console.error(e);
      showError('取得エラー。時間をおいて再実行してください。');
    });
  }
})
// === 価格 ===
const PRICE_MAP = {
  charge: { al1: '¥3,000', al2: '¥2,000' },
  nft:    { al1: '¥3,000', al2: '¥2,000' },
  guild:  { al1: '¥3,000', al2: '¥2,000' },
  greet:  { al1: '¥5,000', al2: '¥3,000' }
};

// 価格を各ピルへ差し込み
function applyPrices(){
  for (const [key, set] of Object.entries(PRICE_MAP)){
    const card = document.querySelector(`.card[data-key="${key}"]`);
    if(!card) continue;
    for (const [type, price] of Object.entries(set)){
      const pill = card.querySelector(`.pill[data-type="${type}"]`);
      if(!pill) continue;
      let el = pill.querySelector('.price');
      if(!el){
        el = document.createElement('span');
        el.className = 'price';
        const label = pill.querySelector('.label');
        (label?.nextSibling)
          ? pill.insertBefore(el, label.nextSibling)
          : pill.appendChild(el);
      }
      el.textContent = price;
    }
  }
}

// 初期化時に価格をセット
document.addEventListener('DOMContentLoaded', applyPrices);

// （1）を出さないように setPill も調整ない
}
function setPill(cardKey, type, count){
  const card = document.querySelector(`.card[data-key="${cardKey}"]`);
  const pill = card?.querySelector(`.pill[data-type="${type}"]`);
  if(!pill) return;

  pill.classList.remove('on','off');

  const markEl  = pill.querySelector('.mark');
  const countEl = pill.querySelector('.count');

  if(count > 0){
    pill.classList.add('on');
    if (markEl)  markEl.textContent = '○';
  }else{
    pill.classList.add('off');
    if (markEl)  markEl.textContent = '×';
  }

  // (1) は出さない
  if (countEl) countEl.textContent = '';
}
// === 価格表 ===
const PRICE_MAP = {
  charge: { al1: '¥3,000', al2: '¥2,000' },
  nft:    { al1: '¥3,000', al2: '¥2,000' },
  guild:  { al1: '¥3,000', al2: '¥2,000' },
  greet:  { al1: '¥5,000', al2: '¥3,000' },
};

// DOM準備後に各ALボタンへ価格をセット（.price が無ければ作る）
document.addEventListener('DOMContentLoaded', () => {
  for (const [cardKey, types] of Object.entries(PRICE_MAP)) {
    for (const [type, price] of Object.entries(types)) {
      const pill = document.querySelector(`.card[data-key="${cardKey}"] .pill[data-type="${type}"]`);
      if (!pill) continue;
      let slot = pill.querySelector('.price');
      if (!slot) {
        slot = document.createElement('span');
        slot.className = 'price';
        pill.appendChild(slot);
      }
      slot.textContent = price;
    }
  }
});
