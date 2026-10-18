// 慢慢来 · 互动：戳一戳和加油表情、去闺蜜家撸猫、可选的同步专注、点赞和评论
// 都存在 posts 表里：poke（戳/表情）、catpet（摸对方的猫）、gift（送小鱼干）、session（专注的结束时间）、comment（评论）
// 点赞存在被点赞那条 post 的 reactions 里。goal 字段 = 发给谁 / 评论哪一条。
"use strict";

const CHEERS = [["👉", "戳一戳"], ["❤️", "爱你"], ["💪", "加油"], ["🔥", "冲鸭"], ["🌸", "送花"], ["🥤", "喝水"]];
const known = new Set(); let socialReady = false;

/* ---------- 新消息：戳我、摸我的猫、送我鱼干、评论我 ---------- */
const _load = store.load.bind(store);
store.load = async function () { await _load(); checkIncoming(); };
function checkIncoming() {
  const fresh = [];
  state.posts.forEach((x) => { if (!known.has(x.id)) { known.add(x.id); if (socialReady) fresh.push(x); } });
  socialReady = true;
  fresh.filter((x) => x.author !== me.name && Date.now() - Number(x.created) < 5 * 60e3).forEach(onIncoming);
}
function onIncoming(x) {
  if (x.kind === "poke" && x.goal === me.name) { floatEmoji(x.text, x.text === "👉" ? 10 : 16); toast(x.text === "👉" ? `${x.author} 戳了戳你 👉` : `${x.author} 给你送来 ${x.text}`); }
  else if (x.kind === "catpet" && x.goal === me.name) { floatEmoji("💕", 8); toast(`${x.author} 摸了摸你的猫 🐾`); }
  else if (x.kind === "gift" && x.goal === me.name) { floatEmoji("🐟", 8); toast(`${x.author} 送了你的猫 ${x.target || 1} 条小鱼干 🐟`); }
  else if (x.kind === "comment") { const t = state.posts.find((p) => p.id === x.goal); if (t && t.author === me.name) toast(`${x.author} 评论了你：${x.text}`); }
}
function toast(text) {
  let el = $("toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = text; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 3600);
}
function floatEmoji(e, n = 12, from) {
  const box = document.createElement("div"); box.className = "emoji-rain";
  for (let i = 0; i < n; i++) { const s = document.createElement("span"); s.textContent = e;
    s.style.left = from ? `${from.x + (Math.random() * 60 - 30)}px` : `${10 + Math.random() * 80}vw`;
    s.style.top = from ? `${from.y}px` : "auto"; if (from) s.style.bottom = "auto";
    s.style.animationDelay = `${Math.random() * 0.6}s`; s.style.fontSize = `${1.4 + Math.random() * 1.4}rem`; box.appendChild(s); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 3200);
}

/* ---------- 戳一戳 / 加油表情 ---------- */
let pokeTo = null, lastPoke = 0;
function openPoke(name, anchor) { // 点闺蜜头像：TA 的小主页（状态、打招呼、TA 的猫）
  pokeTo = name; let sh = $("poke-sheet");
  if (!sh) { sh = document.createElement("div"); sh.id = "poke-sheet"; sh.className = "sheet"; document.body.appendChild(sh); }
  const st = statusOf(name);
  sh.innerHTML = `<div class="sheet-card">
      <div class="prof"><div class="avatar">${[...name][0].toUpperCase()}</div><div><b></b><small>${st.label} · 今天 ${fmtMin(st.todayMin)}${st.mood ? " · 心情 " + st.mood : ""}</small></div><button class="camx light" id="poke-x" aria-label="关闭">✕</button></div>
      <div class="label">打个招呼</div>
      <div class="cheers">${CHEERS.map(([e, t]) => `<button data-e="${e}"><span>${e}</span><small>${t}</small></button>`).join("")}</div>
      <div id="visit-slot"></div>
    </div>`;
  sh.querySelector(".prof b").textContent = name;
  sh.hidden = false;
  sh.querySelectorAll(".cheers button").forEach((b) => (b.onclick = () => sendCheer(b.dataset.e, anchor)));
  $("poke-x").onclick = () => (sh.hidden = true);
  sh.onclick = (e) => { if (e.target === sh) sh.hidden = true; };
  renderVisit(name);
}
async function sendCheer(e, anchor) {
  if (Date.now() - lastPoke < 2500) { toast("慢一点点～"); return; }
  lastPoke = Date.now(); $("poke-sheet").hidden = true;
  const r = anchor?.getBoundingClientRect(); floatEmoji(e, 6, r ? { x: r.left + r.width / 2, y: r.top } : null);
  try { await store.addPost({ kind: "poke", goal: pokeTo, text: e }); } catch (err) {}
  const busy = statusOf(pokeTo).busy;
  notify(e === "👉" ? `👉 ${me.name}戳了戳你` : `${e} ${me.name}给你送来 ${e}`, busy ? "（你正在专注，表情已经飘到你的屏幕上了）" : "去自习室看看吧", "room", "poke");
  toast(busy ? `${pokeTo}正在专注，${e} 会飘到TA的屏幕上` : `已经送给 ${pokeTo} 啦`);
}

/* ---------- 去闺蜜家撸猫 ---------- */
let lastPet = 0;
function friendCat(n) {
  const row = state.posts.find((x) => x.kind === "cat" && x.author === n); let d = {}; try { d = JSON.parse(row?.text || "{}"); } catch (e) {}
  const mins = Math.max(0, state.logs.filter((l) => l.author === n).reduce((a, l) => a + (Number(l.minutes) || 0), 0));
  return { c: { breed: "orange", name: "团子", outfits: { head: "bow" }, ...d }, mins };
}
function renderVisit(n) {
  const slot = $("visit-slot"); if (!slot || !n || typeof catSVG !== "function") return;
  const { c, mins } = friendCat(n), st = stageAt(mins), myFish = fishOwned(catState()), key = [n, c.breed, JSON.stringify(c.outfits), st.i].join("|");
  if (slot.dataset.key !== key) {
    slot.dataset.key = key;
    slot.innerHTML = `<div class="label">🐾 ${n}的猫</div>
      <div class="visit-art" id="visit-art">${catSVG(c, st.i).replace(/catheadclip/g, "vcatheadclip").replace(/catclip/g, "vcatclip")}</div>
      <p class="note"><b>${c.name}</b> · ${BREEDS[c.breed]?.name || "猫猫"} · ${st.s.n}</p>
      <div class="visit-actions"><button class="cat-btn" id="visit-pet"><b>🤚</b>摸摸它</button><button class="cat-btn" id="visit-gift"><b>🐟</b>送一条小鱼干<small id="visit-fish"></small></button></div>`;
    $("visit-pet").onclick = async () => {
      const svg = slot.querySelector(".catsvg"); svg?.classList.add("m-happy"); setTimeout(() => svg?.classList.remove("m-happy"), 1500);
      const r = $("visit-art").getBoundingClientRect(); floatEmoji("💕", 5, { x: r.left + r.width / 2, y: r.top + r.height * 0.4 });
      if (Date.now() - lastPet < 8000) return; lastPet = Date.now();
      try { await store.addPost({ kind: "catpet", goal: n, text: "pet" }); } catch (e) {}
      notify(`🐾 ${me.name}摸了摸你的猫`, `${c.name}眯起了眼睛～`, "me", "catpet");
    };
    $("visit-gift").onclick = async () => {
      if (fishOwned(catState()) < 1) { toast("你的小鱼干不够了，专注 10 分钟换一条吧"); return; }
      const svg = slot.querySelector(".catsvg"); svg?.classList.add("m-happy", "m-eat", "feeding"); setTimeout(() => svg?.classList.remove("m-happy", "m-eat", "feeding"), 1800);
      try { await store.addPost({ kind: "gift", goal: n, target: 1, text: "fish" }); } catch (e) { return; }
      notify(`🐟 ${me.name}送了你的猫 1 条小鱼干`, "去「我的」喂它吧", "me", "gift"); toast(`送给${n}的猫啦 🐟`);
      $("visit-fish").textContent = `你有 ×${fishOwned(catState())}`;
    };
  }
  $("visit-fish").textContent = `你有 ×${myFish}`;
}

/* ---------- 同步一起专注（可选） ---------- */
let sessRow = null, lastSessPush = 0, lastSessPhase = "";
function sessionOf(n) { const r = state.posts.find((x) => x.kind === "session" && x.author === n); try { return r ? JSON.parse(r.text) : null; } catch (e) { return null; } }
async function pushSession(force) {
  if (!run) return; const ph = run.phase;
  if (!force && ph === lastSessPhase && Date.now() - lastSessPush < 30000) return;
  lastSessPush = Date.now(); lastSessPhase = ph;
  const text = JSON.stringify({ start: run.start, until: Date.now() + Math.max(0, run.remaining), target: run.target, label: run.label || "", sync: run.syncWith || "" });
  sessRow = state.posts.find((x) => x.kind === "session" && x.author === me.name) || sessRow;
  try { if (sessRow?.id) await store.updatePost(sessRow.id, { text }); else { await store.addPost({ kind: "session", text }); sessRow = state.posts.find((x) => x.kind === "session" && x.author === me.name); } } catch (e) {}
}
const _pushFocus = pushFocus;
pushFocus = function (force) { _pushFocus(force); pushSession(force); };
function busyFriendSession() { // 正在专注、还有剩余时间的闺蜜
  for (const n of friends()) { const st = statusOf(n), ss = sessionOf(n); if (st.busy && ss && ss.until > Date.now() + 60000) return { n, ss, left: ss.until - Date.now() }; }
  return null;
}
function renderSyncRow() {
  let row = $("sync-row"); const b = busyFriendSession();
  if (!row) { row = document.createElement("label"); row.id = "sync-row"; row.className = "toggle sync"; $("start").before(row);
    row.innerHTML = `<input type="checkbox" id="sync-on"><span id="sync-text"></span>`;
    $("sync-on").checked = ls.get("mml-sync", true); $("sync-on").onchange = (e) => ls.set("mml-sync", e.target.checked); }
  row.hidden = !b || !!run;
  if (b) $("sync-text").textContent = `⏱ 和${b.n}同时结束（TA还剩 ${Math.ceil(b.left / 60000)} 分钟）`;
}
const _start = $("start").onclick;
$("start").onclick = async (e) => {
  const b = busyFriendSession(), sync = b && $("sync-on")?.checked;
  if (sync) { dur = Math.max(1, Math.ceil(b.left / 60000)); chips(); }
  await _start(e);
  if (run && sync) { run.syncWith = b.n; run.remaining = Math.max(60000, b.ss.until - Date.now()); run.target = run.remaining; saveRun(); pushSession(true); toast(`已经和${b.n}对齐，会一起结束 ⏱`); }
};

/* 专注画面里看到闺蜜的进度 */
function renderFocusFriends() {
  if ($("focus").hidden) return;
  let box = $("f-friends"); if (!box) { box = document.createElement("div"); box.id = "f-friends"; box.className = "f-friends"; $("f-msg").after(box); }
  const rows = friends().map((n) => { const st = statusOf(n), ss = sessionOf(n); if (!st.busy && st.label !== "拿起手机了 👀" && st.label !== "离开了 👀") return "";
    const left = ss ? Math.max(0, ss.until - Date.now()) : 0, frac = ss && ss.target ? 1 - left / ss.target : 0;
    return `<div class="ff"><span>${n}</span><i><b style="width:${Math.min(100, Math.max(0, frac * 100)).toFixed(0)}%"></b></i><small>${st.label.includes("👀") ? st.label : left ? mmss(left) : st.label}</small></div>`; }).join("");
  box.innerHTML = rows ? `<p class="ff-title">一起专注中</p>${rows}` : "";
}
setInterval(renderFocusFriends, 1000);

/* ---------- 点赞和评论（笔记、瞬间） ---------- */
const likesOf = (x) => ((x.reactions || {})["❤"] || []);
const commentsOf = (id) => state.posts.filter((c) => c.kind === "comment" && c.goal === id).sort((a, b) => a.created - b.created);
const openThreads = new Set();
async function toggleLike(x, what) {
  const r = { ...(x.reactions || {}) }, set = new Set(r["❤"] || []), on = set.has(me.name);
  on ? set.delete(me.name) : set.add(me.name); r["❤"] = [...set];
  try { await store.updatePost(x.id, { reactions: r }); } catch (e) {}
  if (!on && x.author !== me.name) notify(`❤️ ${me.name}喜欢了你的${what}`, x.text || "", "share", "like");
  render();
}
async function addComment(x, text, what) {
  text = text.trim().slice(0, 120); if (!text) return;
  try { await store.addPost({ kind: "comment", goal: x.id, text }); } catch (e) { return; }
  notify(`💬 ${me.name}评论了${x.author === me.name ? "" : "你的"}${what}`, text, "share", "comment");
  render();
}
function threadHTML(x) {
  return commentsOf(x.id).map((c) => `<div class="cm"><b>${c.author === me.name ? "你" : c.author}</b><span></span></div>`).join("");
}
function decorateNotes() {
  document.querySelectorAll("#nf-list .nf").forEach((el) => {
    const x = state.posts.find((p) => p.id === el.dataset.id); if (!x || el.querySelector(".social")) return;
    const likes = likesOf(x), cms = commentsOf(x.id), bar = document.createElement("div"); bar.className = "social";
    bar.innerHTML = `<button class="lk ${likes.includes(me.name) ? "on" : ""}">${likes.includes(me.name) ? "❤️" : "🤍"} ${likes.length || ""}</button><button class="cmb">💬 ${cms.length || "评论"}</button>`;
    el.appendChild(bar);
    const th = document.createElement("div"); th.className = "thread"; th.hidden = !openThreads.has(x.id);
    th.innerHTML = `${cms.map(() => '<div class="cm"><b></b><span></span></div>').join("")}<div class="cm-in"><input class="field" maxlength="120" placeholder="说点什么…" enterkeyhint="send"><button class="soft small">发送</button></div>`;
    th.querySelectorAll(".cm").forEach((d, i) => { d.querySelector("b").textContent = cms[i].author === me.name ? "你" : cms[i].author; d.querySelector("span").textContent = cms[i].text; });
    el.appendChild(th);
    bar.querySelector(".lk").onclick = () => toggleLike(x, "笔记");
    bar.querySelector(".cmb").onclick = () => { openThreads.has(x.id) ? openThreads.delete(x.id) : openThreads.add(x.id); th.hidden = !th.hidden; if (!th.hidden) th.querySelector("input").focus(); };
    const inp = th.querySelector("input"), send = () => { const v = inp.value; inp.value = ""; openThreads.add(x.id); addComment(x, v, "笔记"); };
    th.querySelector("button").onclick = send; inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
  });
}
/* 播放瞬间时：点赞、看评论、写评论 */
function decoratePlayer() {
  if ($("pf").hidden || !pfList.length) return;
  const x = pfList[pfIdx]; if (!x) return;
  let bar = $("pf-social"); if (!bar) { bar = document.createElement("div"); bar.id = "pf-social"; bar.className = "pf-social"; $("pf").appendChild(bar);
    bar.addEventListener("pointerdown", () => clearTimeout(pfTimer)); } // 点赞、写评论时先别自动翻页
  if (bar.dataset.id === x.id && bar.dataset.n === String(commentsOf(x.id).length + likesOf(x).length)) return;
  bar.dataset.id = x.id; bar.dataset.n = String(commentsOf(x.id).length + likesOf(x).length);
  const likes = likesOf(x), cms = commentsOf(x.id).slice(-3);
  bar.innerHTML = `<div class="pf-cms">${cms.map(() => '<div class="cm"><b></b><span></span></div>').join("")}</div>
    <div class="pf-row"><button class="lk">${likes.includes(me.name) ? "❤️" : "🤍"} ${likes.length || ""}</button><input maxlength="120" placeholder="写评论…" enterkeyhint="send"><button class="send">发送</button></div>`;
  bar.querySelectorAll(".cm").forEach((d, i) => { d.querySelector("b").textContent = cms[i].author === me.name ? "你" : cms[i].author; d.querySelector("span").textContent = cms[i].text; });
  bar.querySelector(".lk").onclick = () => { clearTimeout(pfTimer); toggleLike(x, "瞬间"); };
  const inp = bar.querySelector("input"), send = () => { clearTimeout(pfTimer); const v = inp.value; inp.value = ""; addComment(x, v, "瞬间"); };
  inp.onfocus = () => clearTimeout(pfTimer); // 写评论的时候先别自动翻页
  bar.querySelector(".send").onclick = send; inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
}
const _showPf = showPf;
showPf = function () { _showPf(); const b = $("pf-social"); if (b) b.dataset.id = ""; decoratePlayer(); };

/* ---------- 每次刷新页面后装上互动 ---------- */
$("seats").addEventListener("click", (e) => { // 座位会经常重画，所以把点击挂在外面
  const el = e.target.closest(".seat.friend:not(.empty)"); if (!el) return;
  const i = [...document.querySelectorAll("#seats .seat.friend:not(.empty)")].indexOf(el), n = friends()[i];
  if (n) openPoke(n, el.querySelector(".avatar"));
});
const _render = render;
render = function () {
  _render();
  try {
    document.querySelectorAll("#seats .seat.friend:not(.empty)").forEach((el) => el.classList.add("tap"));
    $("visit-card")?.remove(); // 旧版本放在自习室里的卡片
    if (!$("poke-sheet")?.hidden && pokeTo) renderVisit(pokeTo);
    renderSyncRow(); decorateNotes(); decoratePlayer();
  } catch (e) { console.error(e); }
};
// 定期清掉自己发过的旧戳一戳和摸猫记录（鱼干要留着算账）
setTimeout(() => { if (!me) return; state.posts.filter((x) => ["poke", "catpet"].includes(x.kind) && x.author === me.name && Date.now() - Number(x.created) > 3 * 864e5)
  .slice(0, 30).forEach((x) => store.deletePost(x.id).catch(() => {})); }, 8000);
