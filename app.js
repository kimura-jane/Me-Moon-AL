/* app.js – v27 (robust search binding + header-safe match) */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

  const MAP = {
    charge: ["チャージAL①","チャージAL②"],
    nft:    ["NFTコラボAL①","NFTコラボAL②"],
    guild:  ["ギルドミッションAL①","ギルドミッションAL②"],
    hello:  ["挨拶タップAL①","挨拶タップAL②"],
  };

  // ===== helpers =====
  const $ = (s, r=document) => r.querySelector(s);
  const cls = (n,on) => { if(!n) return; n.classList.toggle("is-on", !!on); n.classList.toggle("is-off", !on); };

  function norm(s){
    if(!s) return "";
    return String(s)
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g,"")
      .replace(/[\u2010-\u2015\u2212\u30FC\uFF0D_]+/g,"-");
  }

  function parseCsv(text){
    return text.split(/\r?\n/).map(l=>{
      const m = l.match(/^"(.*)"\s*$/);
      const line = m ? m[1] : l;
      return line.split(",").map(c=>c.replace(/^"|"$/g,""));
    });
  }

  async function getList(sheetName){
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error(`fetch failed: ${sheetName}`);
    const rowsRaw = parseCsv(await res.text()).map(r => (r[0]??"").trim()).filter(Boolean);

    // 先頭行がヘッダーらしい場合だけ落とす
    if(rowsRaw.length){
      const h = norm(rowsRaw[0]);
      if(/^(slug|name|ユーザー|wallet|address|アドレス)$/i.test(h)) rowsRaw.shift();
    }
    return rowsRaw.map(norm);
  }

  async function judge(slug){
    const s = norm(slug);
    const empty = { charge:[false,false], nft:[false,false], guild:[false,false], hello:[false,false] };
    if(!s) return empty;

    const tasks = [], keys = [];
    for(const key of Object.keys(MAP)){
      MAP[key].forEach((sheet,idx) => { tasks.push(getList(sheet)); keys.push([key,idx]); });
    }
    const lists = await Promise.all(tasks);

    const res = structuredClone(empty);
    lists.forEach((list,i)=>{
      const [key,idx] = keys[i];
      const hit = list.includes(s) || list.includes(s.replace(/-/g,"_")) || list.includes(s.replace(/_/g,"-"));
      res[key][idx] = !!hit;
    });
    return res;
  }

  function ready(fn){ (document.readyState==="loading") ? document.addEventListener("DOMContentLoaded", fn,{once:true}) : fn(); }

  ready(() => {
    // ===== UI refs =====
    const $q   = $("#q") || $('input[name="q"]') || $('input[type="search"]') || $('input');
    const $who = $("#who");
    const $msg = $("#msg");

    // バッジ
    const chips = {
      "charge-1": $("#chip-charge-1"),
      "charge-2": $("#chip-charge-2"),
      "nft-1":    $("#chip-nft-1"),
      "nft-2":    $("#chip-nft-2"),
      "guild-1":  $("#chip-guild-1"),
      "guild-2":  $("#chip-guild-2"),
      "hello-1":  $("#chip-hello-1"),
      "hello-2":  $("#chip-hello-2"),
    };

    function render(result){
      Object.values(chips).forEach(n=>cls(n,false));
      cls(chips["charge-1"], result.charge[0]);
      cls(chips["charge-2"], result.charge[1]);
      cls(chips["nft-1"],    result.nft[0]);
      cls(chips["nft-2"],    result.nft[1]);
      cls(chips["guild-1"],  result.guild[0]);
      cls(chips["guild-2"],  result.guild[1]);
      cls(chips["hello-1"],  result.hello[0]);
      cls(chips["hello-2"],  result.hello[1]);

      const any = Object.values(result).some(p => p[0] || p[1]);
      if($msg){ $msg.textContent = any ? "" : "該当なし。slugを確認。"; $msg.style.display = any ? "none" : ""; }
    }

    async function onSearch(){
      const v = $q?.value ?? "";
      if($who) $who.textContent = `照会: ${v}`;
      if($msg){ $msg.textContent = "検索中..."; $msg.style.display = ""; }
      try{
        const r = await judge(v);
        render(r);
      }catch(e){
        console.error(e);
        if($msg){ $msg.textContent = "読み込みエラー。時間をおいて再実行。"; $msg.style.display = ""; }
      }
    }

    // ===== robust bind for the search button / form =====
    let $btn =
      $("#btn-search") ||
      $("#searchBtn") ||
      $("#search") ||
      $('[data-search]') ||
      $('button[type="submit"]') ||
      ($q?.closest("form")?.querySelector("button, input[type=submit]")) ||
      ($q?.parentElement?.querySelector("button, input[type=submit]"));

    // クリック
    $btn?.addEventListener("click", (e)=>{ e.preventDefault(); onSearch(); });

    // Enter キー
    $q?.addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); onSearch(); } });

    // フォーム submit（保険）
    document.addEventListener("submit", (e)=>{ e.preventDefault(); onSearch(); });

    // 入力済みなら自動検索
    if($q && $q.value.trim()) onSearch();

    // ===== ぶれ撮り =====
    const $blurImg = $("#blur-img");
    const $blurCap = $("#blur-cap");
    const $blurBtn = $("#btn-blur-refresh");

    async function loadBlur(){
      try{
        const r = await fetch("./blurs/manifest.json", { cache:"no-store" });
        if(!r.ok) throw new Error("manifest fetch failed");
        const { images=[] } = await r.json();
        if(!images.length) return;
        const pick = images[Math.floor(Math.random()*images.length)];
        if($blurImg) $blurImg.src = `./blurs/${pick.file}`;
        if($blurCap) $blurCap.textContent = `${pick.author} / ${pick.date}`;
      }catch(e){
        console.error(e);
        if($blurCap) $blurCap.textContent = "画像が読み込めませんでした。";
      }
    }
    $blurBtn?.addEventListener("click", loadBlur);
    if($blurImg) loadBlur();
  });

})();
