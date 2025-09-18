/* app.js — v2: ボタン種別フリー＆iOS対応、検索/更新が確実に反応 */
(() => {
  "use strict";

  // ------- helpers -------
  const $ = (s, r = document) => r.querySelector(s);
  const text = (el, s) => { if (el) el.textContent = s; };
  const norm = (s) => (s || "").trim().toLowerCase().replace(/^@/, "");
  const bust = () => `?t=${Date.now()}`;

  // ------- state -------
  const S = { members: [], blurs: [], pool: [] };

  // ------- shuffle & draw one without repetition -------
  const shuffle = (a) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };
  const draw = () => {
    if (!S.blurs.length) return null;
    if (!S.pool.length) S.pool = shuffle(S.blurs);
    return S.pool.shift();
  };

  // ------- data loaders -------
  async function loadMembers() {
    try {
      const r = await fetch(`data/members.json${bust()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      S.members = Array.isArray(j?.members) ? j.members : [];
    } catch (e) {
      console.warn("members.json load fail:", e);
      S.members = [];
    }
  }
  async function loadManifest() {
    try {
      const r = await fetch(`blurs/manifest.json${bust()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const list = Array.isArray(j) ? j : Array.isArray(j.images) ? j.images : [];
      S.blurs = list.filter(x => x && x.file).map(x => ({
        file: String(x.file),
        author: x.author || "",
        date: x.date || ""
      }));
      S.pool = [];
      const err = $("#blurError") || $("#blurMsg");
      if (err) err.remove();
    } catch (e) {
      console.warn("manifest.json load fail:", e);
      S.blurs = []; S.pool = [];
      const msg = $("#blurError") || $("#blurMsg");
      if (msg) { msg.hidden = false; text(msg, "manifest.json が見つからない / 読み込めない"); }
    }
  }

  // ------- renderers -------
  function lookup(slugRaw) {
    const s = norm(slugRaw);
    if (!s) return null;
    const hit = S.members.find(m => norm(m.slug) === s);
    return hit ? { slug: s, als: Array.isArray(hit.als) ? hit.als : [] } : { slug: s, als: [] };
  }
  function renderResult(hit) {
    const box  = $("#resultBox") || $("#result") || $(".result");
    const head = $("#resultSlug") || $(".result-slug");
    const list = $("#resultChips") || $("#chips") || $(".chips");
    if (head) text(head, hit ? hit.slug : "");
    if (!box) return;

    if (!list) {
      text(box, hit && hit.als.length ? `${hit.slug}: ${hit.als.join(" / ")}` : "該当なし。slugを確認。");
      return;
    }
    list.innerHTML = "";
    if (!hit || hit.als.length === 0) {
      const chip = document.createElement("div");
      chip.className = "chip chip--muted";
      chip.textContent = "該当なし。slugを確認。";
      list.appendChild(chip);
    } else {
      hit.als.forEach(n => {
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.textContent = n;
        list.appendChild(chip);
      });
    }
    box.hidden = false;
  }
  function renderOneBlur() {
    const wrap = $("#blurGrid") || $("#blurs") || $("#gallery");
    if (!wrap) return;
    wrap.innerHTML = "";
    const item = draw();
    if (!item) return;
    const fig = document.createElement("figure");
    fig.className = "blur-card";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = `blurs/${item.file}`;
    img.alt = [item.author, item.date].filter(Boolean).join(" / ");

    const cap = document.createElement("figcaption");
    cap.className = "blur-cap";
    cap.textContent = [item.author, item.date].filter(Boolean).join(" / ");

    fig.append(img, cap);
    wrap.appendChild(fig);
  }

  // ------- events (defensive binding for any kind of button) -------
  function triggerSearch() {
    const input = $("#slugInput") || $("#q") || $("#slug") || $("input[type='search']") || $("input");
    renderResult(lookup(input && input.value));
  }
  function triggerRefresh() {
    renderOneBlur();
  }

  function bind() {
    // 直接IDにバインド（あれば）
    const sb = $("#searchBtn"); const rb = $("#refreshBtn");
    [sb, rb].forEach((el, i) => {
      if (!el) return;
      const fn = i === 0 ? triggerSearch : triggerRefresh;
      ["click","touchend"].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); fn(); }, { passive: false }));
    });

    // デリゲーション：a, button, .btn, role=button など全部拾う
    let lock = false;                          // touchend/click重複防止
    const handle = (e) => {
      const el = e.target.closest("[data-action],button,a,.btn,[role='button']");
      if (!el) return;
      let key = el.dataset.action || el.getAttribute("aria-label") || el.textContent || "";
      key = key.replace(/\s/g, "");
      if (/^(検索|Search)$/i.test(key) || key.includes("検索")) {
        e.preventDefault(); if (lock) return; lock = true; triggerSearch(); setTimeout(()=>lock=false,0);
      } else if (/^(更新|Refresh|再読み込み)$/i.test(key) || key.includes("更新")) {
        e.preventDefault(); if (lock) return; lock = true; triggerRefresh(); setTimeout(()=>lock=false,0);
      }
    };
    document.addEventListener("click", handle);
    document.addEventListener("touchend", handle, { passive: false });

    // Enterで検索
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement && document.activeElement.tagName === "INPUT") {
        e.preventDefault(); triggerSearch();
      }
    });
  }

  // ------- boot -------
  window.addEventListener("DOMContentLoaded", async () => {
    bind();
    await Promise.all([loadMembers(), loadManifest()]);
    renderOneBlur();       // 初期表示は1枚だけ
  });
})();
