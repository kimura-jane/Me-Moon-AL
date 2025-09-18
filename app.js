/* app.js — v24 安定版
   - ボタンはタグ不問（button/a/div/role=button/data-action）で反応
   - スプシ(GViz CSV) からAL読込 → 失敗時 data/members.json にフォールバック
   - ブレ撮りは blurs/manifest.json から毎回ランダム1枚表示（重複なし巡回）
*/
(() => {
  "use strict";

  // ====== Config ======
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";
  const SHEETS = [
    { label: "チャージAL①",         sheet: "チャージAL①" },
    { label: "チャージAL②",         sheet: "チャージAL②" },
    { label: "NFTコラボAL①",        sheet: "NFTコラボAL①" },
    { label: "NFTコラボAL②",        sheet: "NFTコラボAL②" },
    { label: "ギルドミッションAL①", sheet: "ギルドミッションAL①" },
    { label: "ギルドミッションAL②", sheet: "ギルドミッションAL②" },
    { label: "挨拶タップAL①",       sheet: "挨拶タップAL①" },
    { label: "挨拶タップAL②",       sheet: "挨拶タップAL②" }
  ];
  const GVIZ = name => `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  const blurManifest = "blurs/manifest.json";

  // ====== Utils ======
  const $ = (s, r = document) => r.querySelector(s);
  const text = (el, s) => { if (el) el.textContent = s; };
  const norm = (s) => (s || "").replace(/\u200B/g,"").normalize("NFKC").trim().toLowerCase().replace(/^@/,"");
  const bust = () => `?t=${Date.now()}`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const statusEl = $("#status");

  function setStatus(msg){ if(!statusEl) return; if(!msg){statusEl.style.display="none";statusEl.textContent="";} else {statusEl.style.display="block";statusEl.textContent=msg;} }

  // ====== CSV Parser ======
  function parseCSV(text){
    if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
    const rows=[]; let i=0,f="",row=[],q=false;
    const pf=()=>{row.push(f);f="";}, pr=()=>{rows.push(row);row=[];};
    while(i<text.length){
      const c=text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i+=2;continue;} q=false;i++;continue;} f+=c;i++;continue;}
      if(c==='"'){q=true;i++;continue;}
      if(c===','){pf();i++;continue;}
      if(c==='\r'){i++;continue;}
      if(c==='\n'){pf();pr();i++;continue;}
      f+=c;i++;
    } pf();pr();
    return rows.filter(r=>r.length && r.join("").trim()!=="");
  }
  function rowsToSlugs(rows){
    if(!rows.length) return [];
    const head = rows[0].map(x=>(x||"").trim().toLowerCase());
    const hasHeader = head.includes("slug");
    const idx = hasHeader ? head.indexOf("slug") : 0;
    const start = hasHeader ? 1 : 0;
    const out=[];
    for(let r=start;r<rows.length;r++){
      const s=(rows[r][idx]||"").trim();
      if(s && s.toLowerCase()!=="slug") out.push(s);
    }
    return out;
  }
  async function fetchCSV(url, retries=2){
    for(let i=0;i<=retries;i++){
      try{
        const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(), 9000 + i*3000);
        const res=await fetch(url+bust(), {cache:"no-store", signal:ctl.signal});
        clearTimeout(t);
        if(!res.ok) throw new Error(res.status);
        return await res.text();
      }catch(e){ if(i===retries) throw e; await sleep(400*(i+1)); }
    }
  }

  // ====== AL Data (Sheets -> bySlug) ======
  const bySlug = new Map();
  async function loadFromSheets(){
    bySlug.clear();
    let okCount=0, fail=[];
    for(let i=0;i<SHEETS.length;i++){
      const s=SHEETS[i];
      setStatus(`同期中… ${i+1}/${SHEETS.length} 「${s.label}」`);
      try{
        const csv = await fetchCSV(GVIZ(s.sheet));
        rowsToSlugs(parseCSV(csv)).forEach(sl=>{ const k=norm(sl); if(!k) return; const cur=bySlug.get(k)||new Set(); cur.add(s.label); bySlug.set(k,cur); });
        okCount++;
      }catch(e){ fail.push(s.label); }
    }
    setStatus(fail.length ? `読込失敗: ${fail.join(", ")}（共有設定/シート名）` : "");
    if(!fail.length && okCount>0) return true;
    return okCount>0;
  }
  async function loadFromMembersJSON(){
    try{
      const r = await fetch(`data/members.json${bust()}`, {cache:"no-store"});
      if(!r.ok) throw new Error(r.status);
      const j = await r.json();
      const arr = Array.isArray(j?.members) ? j.members : [];
      bySlug.clear();
      arr.forEach(m=>{
        const k=norm(m.slug);
        const als = Array.isArray(m.als)?m.als:[];
        if(!k) return;
        const s = new Set(als);
        bySlug.set(k, s);
      });
      setStatus("");
      return bySlug.size>0;
    }catch(e){
      return false;
    }
  }

  function lookup(sl){ const set = bySlug.get(norm(sl)) || new Set(); return Array.from(set); }

  // ====== Render (カテゴリ縦 / 同カテゴリ横) ======
  function catFromTitle(title){
    if(title.startsWith("チャージ")) return "charge";
    if(title.startsWith("NFT")) return "nft";
    if(title.startsWith("ギルド")) return "guild";
    return "greet";
  }
  const TITLE_ORDER = ["チャージ","NFTコラボ","ギルドミッション","挨拶タップ"];
  function groupLabels(labels){
    const map=new Map(); // title -> {cat, chips:Set(AL①/AL②)}
    for(const l of labels){
      const m=l.match(/^(.*?)(AL[①②])$/);
      if(!m) continue;
      const title=m[1], chip=m[2];
      const e=map.get(title)||{cat:catFromTitle(title),chips:new Set()};
      e.chips.add(chip); map.set(title,e);
    }
    return map;
  }
  function renderGroups(slug, labels){
    const box=$("#resultBox"); const chipsC=$("#resultChips"); const head=$("#resultSlug");
    if(head) text(head, slug||"");
    if(!box) return;
    chipsC.innerHTML="";
    const groups=groupLabels(labels);
    const titles=TITLE_ORDER.filter(t=>groups.has(t));
    if(!titles.length){
      const div=document.createElement("div"); div.className="chip"; div.textContent="該当なし。slugを確認。"; chipsC.appendChild(div);
    }else{
      titles.forEach(t=>{
        const {cat,chips}=groups.get(t);
        const row=document.createElement("div"); row.className="group";
        const head=document.createElement("div"); head.className="group-head";
        head.innerHTML=`<span class="i ${cat}"></span><span class="group-title">${t}</span>`;
        const chipsDiv=document.createElement("div"); chipsDiv.className="chips";
        Array.from(chips).sort().forEach(c=>{ const s=document.createElement("span"); s.className="chip"; s.textContent=c; chipsDiv.appendChild(s); });
        row.append(head, chipsDiv);
        chipsC.appendChild(row);
      });
    }
    box.hidden=false;
  }

  // ====== Blur (1枚ランダム / 重複なし巡回) ======
  const SessionKey = "blur_pool_v1";
  let blurList = [];
  function shuffle(a){ const x=a.slice(); for(let i=x.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [x[i],x[j]]=[x[j],x[i]]; } return x; }
  function drawOne(){
    if(!blurList.length) return null;
    let pool;
    try{ pool = JSON.parse(sessionStorage.getItem(SessionKey)||"[]"); }catch{ pool=[]; }
    if(!Array.isArray(pool) || pool.some(i=>i>=blurList.length) || pool.length===0){
      pool = [...Array(blurList.length).keys()];
      pool = shuffle(pool);
    }
    const idx = pool.pop(); sessionStorage.setItem(SessionKey, JSON.stringify(pool));
    return blurList[idx];
  }
  async function loadBlurs(){
    try{
      const r = await fetch(`${blurManifest}${bust()}`, {cache:"no-store"});
      if(!r.ok) throw new Error(r.status);
      const j = await r.json();
      const list = Array.isArray(j) ? j : Array.isArray(j.images) ? j.images : [];
      blurList = list.filter(x=>x && x.file).map(x=>({file:String(x.file), author:x.author||"", date:x.date||""}));
      const m=$("#blurMsg"); if(m) m.hidden = true;
    }catch(e){
      blurList=[]; const m=$("#blurMsg"); if(m){ m.hidden=false; m.textContent="manifest.json が見つからない / 読み込めない"; }
    }
  }
  function renderOneBlur(){
    const wrap=$("#blurGrid"); if(!wrap) return;
    wrap.innerHTML="";
    const it = drawOne(); if(!it) return;
    const fig=document.createElement("figure"); fig.className="blur-card";
    const img=new Image(); img.loading="lazy"; img.decoding="async"; img.src=`blurs/${it.file}`; img.alt=[it.author,it.date].filter(Boolean).join(" / ");
    const cap=document.createElement("figcaption"); cap.className="blur-cap"; cap.textContent=[it.author,it.date].filter(Boolean).join(" / ");
    fig.append(img,cap); wrap.appendChild(fig);
  }

  // ====== Actions ======
  function doSearch(){
    const input=$("#slugInput") || $("input[type='search']") || $("input");
    const q = input && input.value ? input.value : "";
    if(!q){ renderGroups("", []); return; }
    const arr = lookup(q);
    renderGroups(q, arr);
    const u=new URL(location.href); u.searchParams.set("q", q); history.replaceState(null,"",u.toString());
  }
  function doRefresh(){ renderOneBlur(); }

  // ====== Binding（ボタン種別フリー + iOS/touch対応） ======
  function bind(){
    // 明示ID
    [["#searchBtn", doSearch], ["#refreshBtn", doRefresh], ["#refreshBtn2", doRefresh]].forEach(([sel,fn])=>{
      const el=$(sel); if(!el) return;
      ["click","touchend"].forEach(ev=>el.addEventListener(ev, e=>{ e.preventDefault(); fn(); }, {passive:false}));
    });
    // data-action / 何のタグでも拾う
    let lock=false;
    const handle = (e)=>{
      const el = e.target.closest("[data-action],button,a,.btn,[role='button']");
      if(!el) return;
      const act=(el.dataset.action || el.getAttribute("aria-label") || el.textContent || "").replace(/\s/g,"");
      if(/検索|Search/i.test(act)){ e.preventDefault(); if(lock) return; lock=true; doSearch(); setTimeout(()=>lock=false,0); }
      else if(/更新|Refresh|再読み込み/i.test(act)){ e.preventDefault(); if(lock) return; lock=true; doRefresh(); setTimeout(()=>lock=false,0); }
    };
    document.addEventListener("click", handle);
    document.addEventListener("touchend", handle, {passive:false});

    // Enterで検索
    document.addEventListener("keydown", (e)=>{ if(e.key==="Enter" && document.activeElement?.tagName==="INPUT"){ e.preventDefault(); doSearch(); } });
  }

  // ====== Boot ======
  window.addEventListener("DOMContentLoaded", async ()=>{
    bind();
    // まずスプシ、ダメなら members.json
    const ok = await loadFromSheets();
    if(!ok) await loadFromMembersJSON();
    await loadBlurs();
    // 初期表示
    renderOneBlur();
    const init=new URL(location.href).searchParams.get("q");
    if(init){ const input=$("#slugInput"); if(input) input.value=init; doSearch(); }
  });
})();
