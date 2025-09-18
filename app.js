/* app.js – v26 (fix: keep first row unless it's a header) */
(() => {
  "use strict";

  // ===== Config =====
  const FILE_ID = "1-2oS--u1jf0fm-m9N_UDf5-aN-oLg_-wyqEpMSdcvcU";

  // 各カテゴリとシート名の対応（タブ名そのまま）
  const MAP = {
    charge:  ["チャージAL①","チャージAL②"],
    nft:     ["NFTコラボAL①","NFTコラボAL②"],
    guild:   ["ギルドミッションAL①","ギルドミッションAL②"],
    hello:   ["挨拶タップAL①","挨拶タップAL②"],
  };

  // 結果バッジ（HTML 側の id はこの想定で付いている前提：chip-<key>-<1|2>）
  const CHIPS = {
    "charge-1": el("#chip-charge-1"),
    "charge-2": el("#chip-charge-2"),
    "nft-1":    el("#chip-nft-1"),
    "nft-2":    el("#chip-nft-2"),
    "guild-1":  el("#chip-guild-1"),
    "guild-2":  el("#chip-guild-2"),
    "hello-1":  el("#chip-hello-1"),
    "hello-2":  el("#chip-hello-2"),
  };

  // UI
  const $q      = el("#q");                  // 検索入力
  const $search = el("#btn-search");         // 検索ボタン
  const $who    = el("#who");                // 「照会: xxx」表示
  const $msg    = el("#msg");                // 結果メッセージ

  // ===== helpers =====
  function el(sel, root = document){ return root.querySelector(sel); }
  function cls(node, on){ node?.classList[on ? "add" : "remove"]("is-on"); node?.classList[on ? "remove" : "add"]("is-off"); }

  // 全角/半角、大小、不要空白、ハイフン類を吸収
  function norm(s){
    if(!s) return "";
    const t = String(s)
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g,"") // 全空白除去（シートに紛れる NBSP 等も吸収）
      .replace(/[\u2010-\u2015\u2212\u30FC\uFF0D_]+/g,"-"); // 各種ハイフン/長音/全角マイナス/アンダーを "-"
    return t;
  }

  // CSV を素朴にパース（今回 A列だけ使うので十分）
  function parseCsv(text){
    return text.split(/\r?\n/).map(l => {
      // いちおう囲み対応（値にカンマは基本無い想定）
      const m = l.match(/^"(.*)"\s*$/);
      const line = m ? m[1] : l;
      return line.split(",").map(c => c.replace(/^"|"$/g,""));
    });
  }

  // 1シート取得 → slug 配列（A列）を返す
  async function getList(sheetName){
    const url = `https://docs.google.com/spreadsheets/d/${FILE_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error(`fetch failed: ${sheetName}`);
    const csv = await res.text();
    const rows = parseCsv(csv).map(r => (r[0] ?? "").trim()).filter(Boolean);

    // ★ ここが修正点：先頭行は「ヘッダーらしければ」だけ捨てる
    if (rows.length) {
      const head = norm(rows[0]);
      if (/^(slug|name|ユーザー|wallet|address|アドレス)$/i.test(head)) {
        rows.shift();
      }
    }
    return rows.map(norm);
  }

  // 指定 slug が各 AL に含まれるかをまとめて判定
  async function judge(slug){
    const s = norm(slug);
    if(!s) return {
      charge:[false,false], nft:[false,false], guild:[false,false], hello:[false,false]
    };

    const res = { charge:[false,false], nft:[false,false], guild:[false,false], hello:[false,false] };

    // 2並列×4カテゴリ＝8枚をまとめて取得
    const tasks = [];
    const keys = [];
    for (const key of Object.keys(MAP)){
      MAP[key].forEach((sheet, idx) => {
        tasks.push(getList(sheet));
        keys.push([key, idx]);
      });
    }
    const lists = await Promise.all(tasks);

    lists.forEach((list, i) => {
      const [key, idx] = keys[i];
      // そのまま一致 or ハイフン⇄アンダーをさらに吸収（保険）
      const hit = list.includes(s) || list.includes(s.replace(/-/g,"_")) || list.includes(s.replace(/_/g,"-"));
      res[key][idx] = !!hit;
    });

    return res;
  }

  // バッジ表示
  function render(result){
    // 先に全部 OFF
    Object.values(CHIPS).forEach(node => cls(node, false));

    // 反映
    cls(CHIPS["charge-1"], result.charge[0]);
    cls(CHIPS["charge-2"], result.charge[1]);
    cls(CHIPS["nft-1"],    result.nft[0]);
    cls(CHIPS["nft-2"],    result.nft[1]);
    cls(CHIPS["guild-1"],  result.guild[0]);
    cls(CHIPS["guild-2"],  result.guild[1]);
    cls(CHIPS["hello-1"],  result.hello[0]);
    cls(CHIPS["hello-2"],  result.hello[1]);

    // 1つもヒットしなければメッセージ表示、あれば消す
    const any = Object.values(result).some(pair => pair[0] || pair[1]);
    $msg.textContent = any ? "" : "該当なし。slugを確認。";
    $msg.style.display = any ? "none" : "";
  }

  // ===== events =====
  async function onSearch(){
    const v = $q.value || "";
    $who.textContent = `照会: ${v}`;
    $msg.textContent = "検索中...";
    $msg.style.display = "";

    try{
      const r = await judge(v);
      render(r);
    }catch(err){
      console.error(err);
      $msg.textContent = "読み込みエラー。時間をおいて再実行。";
      $msg.style.display = "";
    }
  }

  $search?.addEventListener("click", onSearch);
  $q?.addEventListener("keydown", (e)=>{ if(e.key === "Enter") onSearch(); });

  // 初期：入力値があれば自動検索
  if ($q && $q.value?.trim()) onSearch();

  // ===== ぶれ撮り（既存のまま）=====
  const $blurImg = el("#blur-img");
  const $blurCap = el("#blur-cap");
  const $blurBtn = el("#btn-blur-refresh");

  async function loadBlur(){
    try{
      const res = await fetch("./blurs/manifest.json", { cache: "no-store" });
      if(!res.ok) throw new Error("manifest fetch failed");
      const { images = [] } = await res.json();
      if(!images.length) return;
      const pick = images[Math.floor(Math.random()*images.length)];
      // 画像パス
      const src = `./blurs/${pick.file}`;
      if($blurImg){ $blurImg.src = src; }
      if($blurCap){ $blurCap.textContent = `${pick.author} / ${pick.date}`; }
    }catch(e){
      console.error(e);
      if($blurCap){ $blurCap.textContent = "画像が読み込めませんでした。"; }
    }
  }
  $blurBtn?.addEventListener("click", loadBlur);
  // 初期ロード
  if($blurImg) loadBlur();

})();
