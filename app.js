(() => {
  'use strict';

  // ====== Google Sheets ======
  const FILE_ID = '1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU';
  const GVIZ_URL = sheet =>
    `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}`;

  // シート名
  const SHEETS = {
    charge: { s1: 'チャージAL①', s2: 'チャージAL②' },
    nft:   { s1: 'NFTコラボAL①', s2: 'NFTコラボAL②' },
    guild: { s1: 'ギルドミッションAL①', s2: 'ギルドミッションAL②' },
    greet: { s1: '挨拶タップAL①', s2: '挨拶タップAL②' }
  };

  // 価格
  const PRICE_MAP = {
    charge: { al1: '¥3,000', al2: '¥2,000' },
    nft:    { al1: '¥3,000', al2: '¥2,000' },
    guild:  { al1: '¥3,000', al2: '¥2,000' },
    greet:  { al1: '¥5,000', al2: '¥3,000' }
  };

  // ====== DOM ======
  const UI = {
    input:  document.getElementById('slugInput'),
    btn:    document.getElementById('searchBtn'),
    status: document.getElementById('statusMsg'),
    cards: {
      charge: document.querySelector('.card[data-key="charge"]'),
      nft:    document.querySelector('.card[data-key="nft"]'),
      guild:  document.querySelector('.card[data-key="guild"]'),
      greet:  document.querySelector('.card[data-key="greet"]')
    }
  };

  // ====== helpers ======
  const norm = s => String(s ?? '').trim().toLowerCase();
  const parseGViz = txt => JSON.parse(txt.replace(/^[^{]+/, '').replace(/;?$/, ''));

  async function fetchSet(sheet) {
    const res = await fetch(GVIZ_URL(sheet), { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    const obj = parseGViz(await res.text());
    const rows = obj.table?.rows || [];
    const set = Object.create(null);
    for (const row of rows) {
      const v = row?.c?.[0]?.v;
      const slug = norm(v);
      if (slug) set[slug] = true;
    }
    return set; // {slug:true,...}
  }

  function ensurePriceSlots() {
    for (const [key, card] of Object.entries(UI.cards)) {
      if (!card) continue;
      for (const pill of card.querySelectorAll('.pill')) {
        let slot = pill.querySelector('.price');
        if (!slot) {
          slot = document.createElement('span');
          slot.className = 'price';
          pill.appendChild(slot);
        }
        const type = pill.getAttribute('data-type'); // al1|al2
        slot.textContent = PRICE_MAP[key]?.[type] ?? '';
      }
    }
  }

  function setPill(cardKey, type, on) {
    const card = UI.cards[cardKey];
    if (!card) return;
    const pill = card.querySelector(`.pill[data-type="${type}"]`);
    if (!pill) return;

    pill.classList.remove('on', 'off');
    pill.classList.add(on ? 'on' : 'off');

    const markEl = pill.querySelector('.mark');
    if (markEl) markEl.textContent = on ? '◯' : '×';

    // (1) を完全に消す
    const countEl = pill.querySelector('.count');
    if (countEl) countEl.textContent = '';
    pill.removeAttribute('data-count');               // 擬似要素の(1)対策
if (countEl){ countEl.textContent=''; countEl.style.display='none'; } // DOM側も消す
  }

  function setAllOff() {
    for (const key of Object.keys(UI.cards)) {
      setPill(key, 'al1', false);
      setPill(key, 'al2', false);
    }
  }

  async function run() {
    setAllOff();
    const slug = norm(UI.input?.value || '');
    if (UI.status) UI.status.textContent = slug ? `照会: ${slug}` : '';
    if (!slug) return;

    try {
      const [c1, c2, n1, n2, g1, g2, r1, r2] = await Promise.all([
        fetchSet(SHEETS.charge.s1), fetchSet(SHEETS.charge.s2),
        fetchSet(SHEETS.nft.s1),   fetchSet(SHEETS.nft.s2),
        fetchSet(SHEETS.guild.s1), fetchSet(SHEETS.guild.s2),
        fetchSet(SHEETS.greet.s1), fetchSet(SHEETS.greet.s2)
      ]);

      setPill('charge', 'al1', !!c1[slug]);
      setPill('charge', 'al2', !!c2[slug]);
      setPill('nft',    'al1', !!n1[slug]);
      setPill('nft',    'al2', !!n2[slug]);
      setPill('guild',  'al1', !!g1[slug]);
      setPill('guild',  'al2', !!g2[slug]);
      setPill('greet',  'al1', !!r1[slug]);
      setPill('greet',  'al2', !!r2[slug]);
    } catch (e) {
      console.error(e);
      if (UI.status) UI.status.textContent = 'エラーが発生しました';
    }
  }

  // ====== boot ======
  document.addEventListener('DOMContentLoaded', () => {
    ensurePriceSlots();      // 価格を常時表示
    setAllOff();            // 初期OFF
    UI.btn?.addEventListener('click', run);
    UI.input?.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  });
})();
