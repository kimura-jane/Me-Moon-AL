/* app.js – v29 (GVizクエリ版＋安定化) */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDF5-aN-oLg_-wyqEpMSdcvcU";
  const CATS = [
    { key:"charge", label:"チャージ",          s1:"チャージAL①",          s2:"チャージAL②" },
    { key:"nft",    label:"NFTコラボ",        s1:"NFTコラボAL①",        s2:"NFTコラボAL②" },
    { key:"guild",  label:"ギルドミッション",  s1:"ギルドミッションAL①", s2:"ギルドミッションAL②" },
    { key:"greet",  label:"挨拶タップ",        s1:"挨拶タップAL①",        s2:"挨拶タップAL②" },
  ];

  // レート制限対策
  const MAX_RETRY = 5;          // 最大リトライ
  const BETWEEN_CALL_MS = 400;  // シート呼び出し間隔
  const BASE_BACKOFF = 700;     // バックオフ基準(ms)

  // ===== utils =====
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const normalize = s => (s||"").toString()
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/^[\s_@]+|[\s_@]+$/g,"");

  const setState = t => { $("#resultStatus").textContent = t; };
  const resetBadges = () => CATS.forEach(c=>{
    setBadge(c.key,1,"unknown");
    setBadge(c.key,2,"unknown");
  });

  function setBadge(key, which, state){
    const el = $(`#${key}-${which}`);
    el.classList.remove("yes","no","unknown");
    el.classList.add(state);
    el.querySelector("span").textContent = which===1?"AL①":"AL②";
  }

  // ===== GViz Query: 一致行だけCSVでもらう =====
  async function queryHasSlug(sheetName, slug, attempt=1){
    const q = `select A where lower(A)='${slug.replace(/'/g,"\\'")}'`;
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq`+
      `?sheet=${encodeURIComponent(sheetName)}`+
      `&tq=${encodeURIComponent(q)}`+
      `&tqx=out:csv&headers=0&_=${Date.now()}`;

    try{
      const res = await fetch(url, { cache:"no-store", credentials:"omit" });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      // ヒットなし → 1行も返らない / 空文字
      return /\S/.test(csv); // 何か返ってきたら true
    }catch(e){
      if(attempt < MAX_RETRY){
        const wait = Math.min(5000, BASE_BACKOFF * Math.pow(1.8, attempt-1));
        await sleep(wait);
        return queryHasSlug(sheetName, slug, attempt+1);
      }
      throw e;
    }
  }

  async function checkAll(slugNorm){
    for(const cat of CATS){
      // AL①
      try{
        const ok1 = await queryHasSlug(cat.s1, slugNorm);
        setBadge(cat.key,1, ok1?"yes":"no");
      }catch(_){
        setBadge(cat.key,1,"unknown");
        throw _;
      }
      await sleep(BETWEEN_CALL_MS);
      // AL②
      try{
        const ok2 = await queryHasSlug(cat.s2, slugNorm);
        setBadge(cat.key,2, ok2?"yes":"no");
      }catch(_){
        setBadge(cat.key,2,"unknown");
        throw _;
      }
      await sleep(BETWEEN_CALL_MS);
    }
  }

  // ===== UI =====
  const form = $("#searchForm");
  const input = $("#slugInput");
  resetBadges();

  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    const q = normalize(input.value);
    if(!q){ setState("slug を入力してください。"); return; }

    resetBadges();
    setState(`照会: ${q}（取得中…）`);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;

    try{
      await checkAll(q);
      setState(q);
    }catch(_){
      setState("取得エラー。時間をおいて再実行してください。");
    }finally{
      btn.disabled = false;
    }
  });
})();
