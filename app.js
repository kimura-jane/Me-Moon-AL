/* app.js — v29 (JSだけ差し替え) */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
  const CATS = [
    { key: "charge", label: "チャージ", s1: "チャージAL①", s2: "チャージAL②" },
    { key: "nft",    label: "NFTコラボ", s1: "NFTコラボAL①", s2: "NFTコラボAL②" },
    { key: "guild",  label: "ギルドミッション", s1: "ギルドミッションAL①", s2: "ギルドミッションAL②" },
    { key: "greet",  label: "挨拶タップ", s1: "挨拶タップAL①", s2: "挨拶タップAL②" },
  ];

  // ===== DOM pickers =====
  const pick = (...sels) => sels.map(s => document.querySelector(s)).find(Boolean);
  const els = {
    slug:    pick("#slug", "#slugInput", "input[type='search']", "input[type='text']"),
    btn:     pick("#searchBtn", "#btnSearch", "#search", "button[type='submit']"),
    userBox: pick("#resultUser", "#who", "#result .user", ".result-user"),
    msgBox:  pick("#resultMsg", "#msg", "#result .msg", ".result-msg"),
    blurImg: pick("#blurImg", "#randomBlurImg", "#blursImg"),
    blurCap: pick("#blurCap", "#blurCaption"),
    blurBtn: pick("#blurRefresh", "#btnRefresh", "#refreshBlur")
  };

  // ===== helpers =====
  const norm = (s) => (s || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/@/g, "")
    .replace(/[^\w-]/g, "");

  async function fetchSet(sheet) {
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`sheet ${sheet}: ${res.status}`);
    const csv = await res.text();
    const lines = csv.replace(/\uFEFF/g, "").split(/\r?\n/);
    const set = new Set();
    for (const line of lines) {
      const cell = (line.split(",")[0] || "").replace(/^"|"$/g, "");
      const v = norm(cell);
      if (v) set.add(v);         // 先頭行も含め全行をデータとして採用
    }
    return set;
  }

  // === 既存HTMLに合わせてバッジ要素を探す（見つからなければ自動生成） ===
  const badgeCache = new Map(); // key: "charge-1" など
  function findCardByTitle(label) {
    const all = Array.from(document.querySelectorAll("section,article,div,li"));
    return all.find(el => {
      const t = el.querySelector("h1,h2,h3,h4,.title,.heading");
      return t && t.textContent.replace(/\s/g,"").includes(label.replace(/\s/g,""));
    }) || null;
  }
  function findBadge(label, which) {
    const cacheKey = `${label}-${which}`;
    if (badgeCache.has(cacheKey)) return badgeCache.get(cacheKey);

    const card = findCardByTitle(label);
    let el = null;
    if (card) {
      // 既存ボタンをテキストで特定（AL①/AL②）
      const candidates = card.querySelectorAll("button,a,span,div");
      el = Array.from(candidates).find(x => /AL[①1]$/.test(x.textContent.trim())) || null;
      if (which === 2) {
        const list = Array.from(candidates).filter(x => /AL/.test(x.textContent));
        el = list.reverse().find(x => /AL[②2]$/.test(x.textContent.trim())) || el;
      }
    }
    // なければカードを作って自前で表示
    if (!el) {
      const host = card || document.body;
      const wrap = document.createElement("div");
      wrap.className = "al-auto-card";
      const h = document.createElement("h3");
      h.textContent = label;
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `AL${which===1?"①":"②"}`;
      b.style.margin = "6px";
      b.style.padding = "10px 16px";
      wrap.append(h, b);
      host.appendChild(wrap);
      el = b;
    }
    // 共通スタイル（JSだけで見分けやすく）
    el.style.transition = "all .18s ease";
    el.style.borderRadius = "999px";
    el.style.border = "1px solid rgba(255,255,255,.18)";
    el.style.padding = "8px 14px";
    el.style.fontWeight = "700";

    badgeCache.set(cacheKey, el);
    return el;
  }
  function setState(labelKey, which, has) {
    const label = CATS.find(c => c.key === labelKey)?.label;
    if (!label) return;
    const el = findBadge(label, which);
    if (!el) return;
    const base = `AL${which===1?"①":"②"}`;
    el.textContent = `${base} ${has ? "✓" : "—"}`;
    el.ariaPressed = has ? "true" : "false";
    // 目で分かる差（CSSなしで適用）
    if (has) {
      el.style.opacity = "1";
      el.style.background = "rgba(0,255,170,.14)";
      el.style.borderColor = "rgba(0,255,170,.6)";
      el.style.color = "white";
      el.style.boxShadow = "0 0 0 2px rgba(0,255,170,.25) inset";
    } else {
      el.style.opacity = ".35";
      el.style.background = "transparent";
      el.style.borderColor = "rgba(255,255,255,.18)";
      el.style.color = "rgba(255,255,255,.70)";
      el.style.boxShadow = "none";
    }
  }

  // ===== Search =====
  async function doSearch() {
    const raw = (els.slug && els.slug.value) || "";
    const slug = norm(raw);
    if (els.userBox) els.userBox.textContent = raw || "";
    if (els.msgBox)  els.msgBox.textContent  = slug ? "検索中…" : "未検索です。";
    if (!slug) return;

    try {
      const [ch1,nf1,gd1,gr1,ch2,nf2,gd2,gr2] = await Promise.all([
        fetchSet("チャージAL①"),
        fetchSet("NFTコラボAL①"),
        fetchSet("ギルドミッションAL①"),
        fetchSet("挨拶タップAL①"),
        fetchSet("チャージAL②"),
        fetchSet("NFTコラボAL②"),
        fetchSet("ギルドミッションAL②"),
        fetchSet("挨拶タップAL②"),
      ]);
      const hits = {
        charge1: ch1.has(slug),  charge2: ch2.has(slug),
        nft1:    nf1.has(slug),  nft2:    nf2.has(slug),
        guild1:  gd1.has(slug),  guild2:  gd2.has(slug),
        greet1:  gr1.has(slug),  greet2:  gr2.has(slug),
      };

      setState("charge",1,hits.charge1);
      setState("charge",2,hits.charge2);
      setState("nft",1,hits.nft1);
      setState("nft",2,hits.nft2);
      setState("guild",1,hits.guild1);
      setState("guild",2,hits.guild2);
      setState("greet",1,hits.greet1);
      setState("greet",2,hits.greet2);

      const any = Object.values(hits).some(Boolean);
      if (els.msgBox) els.msgBox.textContent = any ? "" : "該当なし。slugを確認。";
    } catch (err) {
      console.error(err);
      if (els.msgBox) els.msgBox.textContent = "読み込み失敗。時間を置いて再試行。";
    }
  }

  // ===== Blur (ランダム1枚) =====
  function trySetImage(img, candidates, capText) {
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) {
        img.removeAttribute("src");
        return;
      }
      const src = candidates[i++] + `?v=${Date.now()}`; // cache bust
      img.onerror = tryNext;
      img.src = src;
    };
    if (capText && els.blurCap) els.blurCap.textContent = capText;
    tryNext();
  }

  async function loadBlur() {
    if (!els.blurImg) return;
    const tryManifests = ["blurs/manifest.json", "manifest.json"];
    let manifest = null;

    for (const path of tryManifests) {
      try {
        const r = await fetch(path, { cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json();
        if (j && Array.isArray(j.images) && j.images.length) { manifest = j; break; }
      } catch (e) { /* next */ }
    }
    if (!manifest) { if (els.blurCap) els.blurCap.textContent = "画像リストなし"; return; }

    const arr = manifest.images;
    const rv = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const pick = arr[Math.floor(rv * arr.length)];
    const file = (pick && pick.file) || "";
    const base = file.includes("/") ? file : `blurs/${file}`;
    const cand = [base];

    // 拡張子不一致に備えたフォールバック
    if (!/\.(jpg|jpeg|png|webp)$/i.test(base)) {
      ["jpg","jpeg","png","webp"].forEach(ext => cand.push(`${base}.${ext}`));
    }
    trySetImage(els.blurImg, cand, `${pick.author} / ${pick.date}`.trim());
  }

  // ===== bind =====
  if (els.btn) els.btn.addEventListener("click", e => { e.preventDefault(); doSearch(); });
  if (els.slug) els.slug.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doSearch(); }});
  if (els.blurBtn) els.blurBtn.addEventListener("click", e => { e.preventDefault(); loadBlur(); });

  // init
  loadBlur();
})();
