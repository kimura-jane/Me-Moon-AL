
const ORDER = ["チャージ確定","チャージ早押し","企画確定","企画早押し","NFT確定","NFT早押し","挨拶確定","挨拶早押し②","挨拶早押し①"];
const DATA_URL = "data/members.json";

const bySlug = new Map();
const byName = new Map();

function norm(s){
  if(!s) return "";
  return s.normalize('NFKC').trim().toLowerCase().replace(/^@/,'');
}
function uniq(arr){ return [...new Set(arr)]; }

async function load(){
  const res = await fetch(DATA_URL + "?_t=" + Date.now(), {cache:"no-store"});
  if(!res.ok) throw new Error("データ読込失敗");
  const json = await res.json();
  (json.members||[]).forEach(m=>{
    const slug = norm(m.slug);
    const name = norm(m.username||"");
    const als = Array.isArray(m.als)? m.als.filter(Boolean): [];
    if(slug){
      if(!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.set(slug, uniq(bySlug.get(slug).concat(als)));
    }
    if(name){
      if(!byName.has(name)) byName.set(name, []);
      byName.set(name, uniq(byName.get(name).concat(als)));
    }
  });
}

function lookup(q){
  const key = norm(q);
  const set = new Set();
  (bySlug.get(key)||[]).forEach(a=>set.add(a));
  (byName.get(key)||[]).forEach(a=>set.add(a));
  return ORDER.filter(a=>set.has(a));
}

function show(q, arr){
  const out = document.getElementById("out");
  out.innerHTML = "";
  const title = document.createElement("div");
  title.innerHTML = `<strong>照会:</strong> <code>${q}</code>`;
  out.appendChild(title);
  const tags = document.createElement("div");
  tags.className = "tags";
  if(arr.length===0){
    const msg = document.createElement("div");
    msg.className = "bad";
    msg.textContent = "該当なし。slug を確認。";
    out.appendChild(msg);
  }else{
    arr.forEach(a=>{
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = a;
      tags.appendChild(span);
    });
    out.appendChild(tags);
    const ok = document.createElement("div");
    ok.className = "ok muted";
    ok.textContent = "表示順はシステム定義。複数ALの場合は全て表示。";
    out.appendChild(ok);
  }
  out.style.display = "block";
}

function handleSearch(){
  const q = document.getElementById("q").value.trim();
  if(!q) return;
  const arr = lookup(q);
  show(q, arr);
  const url = new URL(location.href);
  url.searchParams.set("q", q);
  history.replaceState(null, "", url.toString());
}

window.addEventListener("DOMContentLoaded", async ()=>{
  try{
    await load();
  }catch(e){
    alert("データ読み込みに失敗。data/members.json を確認しろ。");
    console.error(e);
  }
  document.getElementById("go").addEventListener("click", handleSearch);
  document.getElementById("q").addEventListener("keydown", e=>{
    if(e.key==="Enter") handleSearch();
  });
  // deep link
  const q = new URL(location.href).searchParams.get("q");
  if(q){
    document.getElementById("q").value = q;
    handleSearch();
  }
});
