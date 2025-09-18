/* app.js — JSONP & 初期表示 + “当たり”は光る */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
  const SHEETS = [
    { g: "チャージ", i: 0, n: "チャージAL①" },
    { g: "チャージ", i: 1, n: "チャージAL②" },
    { g: "NFTコラボ", i: 0, n: "NFTコラボAL①" },
    { g: "NFTコラボ", i: 1, n: "NFTコラボAL②" },
    { g: "ギルドミッション", i: 0, n: "ギルドミッションAL①" },
    { g: "ギルドミッション", i: 1, n: "ギルドミッションAL②" },
    { g: "挨拶タップ", i: 0, n: "挨拶タップAL①" },
    { g: "挨拶タップ", i: 1, n: "挨拶タップAL②" },
  ];
  const CACHE_TTL = 1000 * 60 * 3; // 3分

  // ===== DOM =====
  const $ = (s, r = document) => r.querySelector(s);
  const form = $("#searchForm") || document;
  const input = $("#slugInput") || $("input[name='slug']") || $("input");
  const btn   = $("#searchBtn") || $("button[type='submit']") || $("button");
  const box   = $("#resultWrap") || $("#results") || $("#resultList");
  const title = $("#resultTitle") || $("[data-role='result-title']");
  const msgEl = $("#resultMsg") || $("[data-role='result-msg']");

  // ===== utils =====
  const norm = (s) =>
    String(s || "").normalize("NFKC").trim().toLowerCase().replace(/^@/, "");

  const jsonpURL = (sheet, cb) =>
    `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq` +
    `?tqx=out:json;responseHandler:${cb}` +
    `&sheet=${encodeURIComponent(sheet)}&tq=${encodeURIComponent("select A")}`;

  function jsonp(sheet, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const cb = `__cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const s = document.createElement("script");
      let done = false;
      const clean = () => { s.remove(); try { delete window[cb]; } catch {} };
      const to = setTimeout(() => { if (!done){ done=true; clean(); reject(new Error("timeout")); }}, timeout);

      window[cb] = (data) => {
        if (done) return;
        done = true; clearTimeout(to); clean();
        try {
          const rows = data?.table?.rows || [];
          const set = new Set();
          rows.forEach(r => {
            const c = r?.c?.[0];
            const v = (c?.v ?? c?.f ?? "").toString();
            const n = norm(v);
            if (n) set.add(n);
          });
          resolve(set);
        } catch (e) { reject(e); }
      };
      s.src = jsonpURL(sheet, cb);
      s.onerror = () => { if (!done){ done=true; clearTimeout(to); clean(); reject(new Error("script error")); } };
      document.head.appendChild(s);
    });
  }

  const cache = new Map(); // name -> {t,set}
  async function loadSet(name) {
    const c = cache.get(name);
    const now = Date.now();
    if (c && now - c.t < CACHE_TTL) return c.set;

    let err, delay = 250;
    for (let i = 0; i < 4; i++) {
      try {
        const set = await jsonp(name);
        cache.set(name, { t: now, set });
        return set;
      } catch (e) {
        err = e;
        await new Promise(r => setTimeout(r, delay)); delay *= 2;
      }
    }
    throw err || new Error("load failed");
  }

  const dot = (g) =>
    g === "チャージ" ? "c-orange" :
    g === "NFTコラボ" ? "c-green"  :
    g === "ギルドミッション" ? "c-purple" :
    g === "挨拶タップ" ? "c-pink" : "c-gray";

  function renderBlank() {
    if (!box) return;
    const groups = [...new Set(SHEETS.map(s => s.g))];
    box.innerHTML = groups.map(g => `
      <div class="al-card">
        <div class="al-head"><span class="al-dot ${dot(g)}"></span><span class="al-ttl">${g}</span></div>
        <div class="al-pills">
          <span class="al-pill off">AL①</span>
          <span class="al-pill off">AL②</span>
        </div>
      </div>
    `).join("");
    if (msgEl) { msgEl.textContent = ""; msgEl.style.display = "none"; }
    if (title) title.textContent = "";
  }

  function render(slug, map) {
    if (!box) return;
    if (title) title.textContent = slug || "";
    if (msgEl) { msgEl.textContent = ""; msgEl.style.display = "none"; }

    box.innerHTML = [...map.entries()].map(([g, pair]) => {
      const [a1, a2] = pair;
      return `
        <div class="al-card">
          <div class="al-head"><span class="al-dot ${dot(g)}"></span><span class="al-ttl">${g}</span></div>
          <div class="al-pills">
            <span class="al-pill ${a1 ? "on" : "off"}">AL①${a1 ? "✓" : ""}</span>
            <span class="al-pill ${a2 ? "on" : "off"}">AL②${a2 ? "✓" : ""}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function showErr(t){ if(msgEl){ msgEl.textContent=t; msgEl.style.display=""; } }
  function busy(b){ if(btn){ btn.disabled=b; btn.classList.toggle("is-busy", b); } }

  // ===== search =====
  let running = false;
  async function run() {
    if (running) return;
    const slug = norm(input?.value);
    if (!slug) return; // 入力なしでも初期カードは出してある
    running = true; busy(true); showErr("");

    // group -> [false,false]
    const map = new Map();
    SHEETS.forEach(s => { if(!map.has(s.g)) map.set(s.g, [false,false]); });

    let ok = 0;
    try {
      for (const s of SHEETS) {
        try {
          const set = await loadSet(s.n);
          ok++;
          const pair = map.get(s.g);
          pair[s.i] = set.has(slug);
        } catch (e) {
          console.warn("sheet fail:", s.n, e.message||e);
        }
      }
      if (ok === 0) { showErr("取得エラー。時間をおいて再実行してください。"); return; }
      render(slug, map);
    } catch {
      showErr("取得エラー。時間をおいて再実行してください。");
    } finally {
      busy(false); running = false;
    }
  }

  // 初期表示（カード出しておく）
  renderBlank();

  if (form instanceof HTMLFormElement) {
    form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
  } else if (btn) {
    btn.addEventListener("click", (e) => { e.preventDefault(); run(); });
  }
})();
