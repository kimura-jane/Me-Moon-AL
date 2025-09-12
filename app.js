
const ORDER = ["チャージ確定","チャージ早押し","企画確定","企画早押し","NFT確定","NFT早押し","挨拶確定","挨拶早押し②","挨拶早押し①"];
const DATA_URL = "data/members.json";

const bySlug = new Map();

function norm(s){
  if(!s) return "";
  return s.normalize('NFKC').trim().toLowerCase().replace(/^@/,'');
}
function getCat(label){
  if(label.startsWith("チャージ")) return "charge";
  if(label.startsWith("企画")) return "plan";
  if(label.startsWith("NFT")) return "nft";
  return "greet";
}
async function load(){
  const res = await fetch(DATA_URL + "?_t=" + Date.now(), {cache:"no-store"});
  if(!res.ok) throw new Error("データ読込失敗");
  const json = await res.json();
  (json.members||[]).forEach(m=>{
    const slug = norm(m.slug);
    const als = Array.isArray(m.als)? m.als.filter(Boolean): [];
    if(!slug) return;
    const cur = bySlug.get(slug)||[];
    bySlug.set(slug, Array.from(new Set([...cur, ...als])));
  });
}
function lookup(q){
  const key = norm(q);
  const list = bySlug.get(key)||[];
  // 並び保証
  return ORDER.filter(a=>list.includes(a));
}
function tag(label){
  const cat = getCat(label);
  return `<span class="tag"><span class="i ${cat}"></span>${label}</span>`;
}
function show(q, arr){
  const out = document.getElementById("out");
  out.innerHTML = "";
  const title = document.createElement("div");
  title.innerHTML = `<strong>照会:</strong> <code>${q}</code>`;
  out.appendChild(title);
  const block = document.createElement("div");
  block.className = "tags";
  if(arr.length===0){
    const none = document.createElement("div");
    none.className = "muted";
    none.textContent = "該当なし。slug を確認。";
    out.appendChild(none);
  }else{
    block.innerHTML = arr.map(tag).join("");
    out.appendChild(block);
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
  const q = new URL(location.href).searchParams.get("q");
  if(q){
    document.getElementById("q").value = q;
    handleSearch();
  }
});
