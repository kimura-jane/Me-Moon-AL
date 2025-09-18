/* app.js — v27 */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
  const CATS = [
    { key: "charge", label: "チャージ", sheets: ["チャージAL①", "チャージAL②"] },
    { key: "nft",    label: "NFTコラボ", sheets: ["NFTコラボAL①", "NFTコラボAL②"] },
    { key: "guild",  label: "ギルドミッション", sheets: ["ギルドミッションAL①", "ギルドミッションAL②"] },
    { key: "greet",  label: "挨拶タップ", sheets: ["挨拶タップAL①", "挨拶タップAL②"] },
  ];

  // ===== DOM helpers =====
  const pick = (...sels) => sels.map(s => document.querySelector(s)).find(Boolean);
  const els = {
    slug:  pick("#slug", "#slugInput", "#s"),
    btn:   pick("#searchBtn", "#btnSearch", "#search"),
    user:  pick("#resultUser", "#who", "#result .user"),
    msg:   pick("#resultMsg", "#msg", "#result .msg"),
    list:  pick("#alList", "#al-list", "#alCards"),
    blurImg: pick("#blurImg", "#blursImg", "#randomBlurImg"),
    blurCap: pick("#blurCap", "#blurCaption"),
    blurBtn: pick("#blurRefresh", "#btnRefresh", "#refreshBlur")
  };

  // ===== Utils =====
  const norm = (s) => (s || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")     // 空白除去
    .replace(/@/g, "")       // @除去
    .replace(/[^\w-]/g, ""); // 英数_-

  async function fetchSet(sheet) {
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`sheet ${sheet}: ${res.status}`);
    const csv = await res.text();
    const lines = csv.replace(/\uFEFF/g, "").split(/\r?\n/);

    // 1列目をすべてデータとして採用（先頭行も含む）
    const set = new Set();
    for (const line of lines) {
      const cell = (line.split(",")[0] || "").replace(/^"|"$/g, "").trim();
      const v = norm(cell);
      if (v) set.add(v);
    }
    return set;
  }

  function ensureUI() {
    if (!els.list) return;
    const already = els.list.querySelector("[data-key]");
    if (already) return;
    // 必要ならJS側でカードを構築
    els.list.innerHTML = "";
    for (const c of CATS) {
      const sec = document.createElement("section");
      sec.className = "al-card";
      const h = document.createElement("h3");
      h.textContent = c.label;
      sec.appendChild(h);
      const box = document.createElement("div");
      box.className = "al-badges";
      for (let i = 1; i <= 2; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "al-badge off";
        b.dataset.key = `${c.key}-${i}`;
        b.dataset.label = `AL${i === 1 ? "①" : "②"}`;
        b.textContent = `${b.dataset.label} —`;
        box.appendChild(b);
      }
      sec.appendChild(box);
      els.list.appendChild(sec);
    }
  }

  function setState(key, has) {
    const el = document.querySelector(`[data-key="${key}"]`);
    if (!el) return;
    el.classList.toggle("on", !!has);
    el.classList.toggle("off", !has);
    el.setAttribute("aria-pressed", has ? "true" : "false");
    el.textContent = `${el.dataset.label} ${has ? "✓" : "—"}`;
  }

  async function doSearch() {
    if (!els.slug) return;
    const raw = els.slug.value || "";
    const slug = norm(raw);
    if (els.user) els.user.textContent = raw || "—";

    // リセット
    for (const c of CATS) {
      setState(`${c.key}-1`, false);
      setState(`${c.key}-2`, false);
    }
    if (els.msg) els.msg.textContent = slug ? "検索中…" : "未検索です。";
    if (!slug) return;

    try {
      const [
        ch1, nf1, gd1, gr1,
        ch2, nf2, gd2, gr2
      ] = await Promise.all([
        fetchSet("チャージAL①"),
        fetchSet("NFTコラボAL①"),
        fetchSet("ギルドミッションAL①"),
        fetchSet("挨拶タップAL①"),
        fetchSet("チャージAL②"),
        fetchSet("NFTコラボAL②"),
        fetchSet("ギルドミッションAL②"),
        fetchSet("挨拶タップAL②"),
      ]);

      const map = {
        "charge-1": ch1.has(slug),
        "nft-1":    nf1.has(slug),
        "guild-1":  gd1.has(slug),
        "greet-1":  gr1.has(slug),
        "charge-2": ch2.has(slug),
        "nft-2":    nf2.has(slug),
        "guild-2":  gd2.has(slug),
        "greet-2":  gr2.has(slug),
      };

      let any = false;
      for (const k in map) { setState(k, map[k]); if (map[k]) any = true; }
      if (els.msg) els.msg.textContent = any ? "" : "該当なし。slugを確認。";
    } catch (e) {
      console.error(e);
      if (els.msg) els.msg.textContent = "読み込み失敗。時間を置いて再試行。";
    }
  }

  async function loadBlur() {
    if (!els.blurImg || !els.blurCap) return;
    try {
      const r = await fetch("blurs/manifest.json", { cache: "no-store" });
      if (!r.ok) throw new Error("manifest not found");
      const data = await r.json();
      const arr = Array.isArray(data.images) ? data.images : [];
      if (!arr.length) throw new Error("empty images");
      // cryptoベースのランダム
      const rv = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
      const pick = arr[Math.floor(rv * arr.length)];
      const src = `blurs/${pick.file}`; // 拡張子はmanifestの記載をそのまま使う
      els.blurImg.src = src;
      els.blurImg.alt = pick.alt || "";
      els.blurCap.textContent = `${pick.author} / ${pick.date}`;
    } catch (e) {
      console.error(e);
      els.blurImg.removeAttribute("src");
      els.blurCap.textContent = "画像を読み込めませんでした";
    }
  }

  // ===== Bind =====
  ensureUI();
  if (els.btn) els.btn.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });
  if (els.slug) els.slug.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); doSearch(); }
  });
  if (els.blurBtn) els.blurBtn.addEventListener("click", (e) => { e.preventDefault(); loadBlur(); });

  // 初期化
  loadBlur();
})();
