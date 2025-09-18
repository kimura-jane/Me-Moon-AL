/* app.js — 安定版（Safari対応・防御的バインド） */
(() => {
  "use strict";

  // ---------- 小物 ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const text = (el, s) => { if (el) el.textContent = s; };
  const show = (el) => { if (el) el.hidden = false; };
  const hide = (el) => { if (el) el.hidden = true; };
  const norm = (s) => (s || "").trim().toLowerCase().replace(/^@/, "");

  // ---------- 状態 ----------
  const STATE = {
    members: null,                // data/members.json をロード
    blurPool: [],                 // ランダム巡回プール
    blurList: [],                 // manifest.json から読み込んだ配列
    cacheBust: () => `?t=${Date.now()}`
  };

  // ---------- ランダム（重複なし巡回） ----------
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const nextBlur = () => {
    if (STATE.blurPool.length === 0) STATE.blurPool = shuffle(STATE.blurList);
    return STATE.blurPool.shift();
  };

  // ---------- みんなのブレ撮り ----------
  async function loadManifest() {
    try {
      const res = await fetch(`blurs/manifest.json${STATE.cacheBust()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data
                : Array.isArray(data.images) ? data.images
                : [];
      // 正常化
      STATE.blurList = list
        .filter(x => x && x.file)
        .map(x => ({
          file: String(x.file),
          author: x.author || "",
          date: x.date || ""
        }));
      STATE.blurPool = [];
    } catch (e) {
      console.warn("manifest.json 読み込み失敗:", e);
      STATE.blurList = [];
      STATE.blurPool = [];
      const msg = $("#blurError") || $("#blurMsg");
      if (msg) {
        msg.classList.add("chip","chip--warn");
        text(msg, "manifest.json が見つからない。/blurs に配置しろ。");
        show(msg);
      }
    }
  }

  function renderOneBlur() {
    const wrap = $("#blurGrid") || $("#blurs") || $("#gallery");
    if (!wrap) return;         // UIがなければスキップ
    wrap.innerHTML = "";       // 1枚だけ表示

    if (STATE.blurList.length === 0) return;

    const item = nextBlur();
    const fig  = document.createElement("figure");
    fig.className = "blur-card";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = (item.author ? `${item.author} – ` : "") + (item.date || "");
    img.src = `blurs/${item.file}`;  // 拡張子は .jpg でも .jpeg でもOK

    const cap = document.createElement("figcaption");
    cap.className = "blur-cap";
    cap.textContent = [item.author, item.date].filter(Boolean).join(" / ");

    fig.appendChild(img);
    fig.appendChild(cap);
    wrap.appendChild(fig);
  }

  // ---------- AL 検索 ----------
  async function loadMembers() {
    try {
      const res = await fetch(`data/members.json${STATE.cacheBust()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      STATE.members = Array.isArray(data?.members) ? data.members : [];
    } catch (e) {
      console.warn("members.json 読み込み失敗:", e);
      STATE.members = []; // 空でも落ちない
    }
  }
  function lookup(slugRaw) {
    const s = norm(slugRaw);
    if (!s) return null;
    const hit = STATE.members.find(m => norm(m.slug) === s);
    return hit ? { slug: s, als: Array.isArray(hit.als) ? hit.als : [] } : { slug: s, als: [] };
  }
  function renderResult(hit) {
    const box  = $("#resultBox") || $("#result") || $(".result");
    const head = $("#resultSlug") || $(".result-slug");
    const list = $("#resultChips") || $("#chips") || $(".chips");

    if (head) text(head, hit ? hit.slug : "");
    if (!box) return;

    if (!list) {
      // 最低限の表示だけ
      text(box, hit && hit.als.length ? `${hit.slug}: ${hit.als.join(" / ")}` : "該当なし。slugを確認。");
      return;
    }

    list.innerHTML = "";
    if (!hit || hit.als.length === 0) {
      const li = document.createElement("div");
      li.className = "chip chip--muted";
      li.textContent = "該当なし。slugを確認。";
      list.appendChild(li);
    } else {
      hit.als.forEach(name => {
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.textContent = name;
        list.appendChild(chip);
      });
    }
    show(box);
  }

  // ---------- イベント（防御的にバインド） ----------
  function bindHandlers() {
    // クリック委譲：ボタンのラベルで判定（IDが変わっても耐える）
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const label = (btn.textContent || "").trim();
      if (label.includes("検索")) {
        e.preventDefault();
        const input = $("#slugInput") || $("#q") || $("#slug") || $("input[type='search']") || $("input");
        renderResult(lookup(input && input.value));
      } else if (label.includes("更新")) {
        e.preventDefault();
        renderOneBlur();
      }
    });

    // Enterで検索（入力にフォーカスがあるとき）
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const active = document.activeElement;
      if (active && active.tagName === "INPUT") {
        e.preventDefault();
        renderResult(lookup(active.value));
      }
    });
  }

  // ---------- 起動 ----------
  window.addEventListener("DOMContentLoaded", async () => {
    bindHandlers();
    await Promise.all([loadMembers(), loadManifest()]);
    renderOneBlur(); // 初回1枚
  });
})();
