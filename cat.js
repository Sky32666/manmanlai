// 慢慢来 · 我的猫猫
// 只属于自己的猫：用自己的专注时间长大；每专注 10 分钟得 1 条小鱼干。
// 可以摸摸、喂鱼干、逗猫、换装、换品种。状态存在 posts 表（kind = "cat"，每人一行，text 里是 JSON）。
"use strict";

const FISH_PER_MIN = 10; // 每专注 10 分钟 = 1 条小鱼干
const BREEDS = {
  orange: { name: "橘猫", fur: "#f0a65e", dark: "#d27f35", belly: "#fbe3c6", ear: "#f6b3bf", eye: "#3b2a20", pattern: "tabby" },
  cow:    { name: "奶牛猫", fur: "#fbfaf7", dark: "#2b2b2e", belly: "#ffffff", ear: "#f6b3bf", eye: "#2b2b2e", pattern: "cow" },
  ragdoll:{ name: "布偶", fur: "#f7efe4", dark: "#8a6a55", belly: "#fffaf3", ear: "#e9b9b0", eye: "#4f8fd6", pattern: "points" },
  calico: { name: "三花", fur: "#fbf7f1", dark: "#2e2a29", belly: "#ffffff", ear: "#f6b3bf", eye: "#3b2a20", pattern: "calico", spot: "#e7964f" },
  black:  { name: "黑猫", fur: "#2f2c33", dark: "#1d1b20", belly: "#3c3842", ear: "#c98f9c", eye: "#e6c445", pattern: "none" },
  grey:   { name: "灰猫", fur: "#a9adb6", dark: "#7c818c", belly: "#e3e5ea", ear: "#f0b3bf", eye: "#3a6b4b", pattern: "tabby" }
};
// slot: head / face / neck。need: 解锁需要的亲密度；min: 或者需要的专注分钟
const OUTFITS = [
  { id: "bow", name: "蝴蝶结", slot: "head", need: 0 },
  { id: "flower", name: "小花", slot: "head", need: 10 },
  { id: "bell", name: "铃铛项圈", slot: "neck", need: 20 },
  { id: "berry", name: "草莓帽", slot: "head", need: 35 },
  { id: "scarf", name: "围巾", slot: "neck", need: 60 },
  { id: "glasses", name: "圆眼镜", slot: "face", need: 90 },
  { id: "gradcap", name: "学霸帽", slot: "head", min: 3000 },
  { id: "crown", name: "王冠", slot: "head", need: 200 }
];
const CAT_LINES = {
  idle: ["喵~", "摸摸我嘛~", "你认真的样子最好看了", "学累了就休息一下下", "我会一直陪着你的", "要记得喝水哦", "今天也辛苦啦", "蹭蹭你~", "想吃小鱼干…"],
  morning: ["早安喵~ 今天也一起加油", "起床啦！先喝杯水吧"],
  night: ["Zzz…", "（睡得好香）", "晚安喵…"],
  hungry: ["肚子咕咕叫了…", "饿饿，想吃小鱼干"],
  noFish: ["没有小鱼干了…去专注 10 分钟换一条吧", "专注一下，就能给我买鱼干啦"],
  fed: ["嗷呜！好好吃！", "谢谢你~ 最喜欢你了", "吧唧吧唧…"],
  pet: ["呼噜呼噜…", "好舒服喵~", "再摸摸~", "（眯眼）"],
  play: ["抓到了！", "喵！再来再来！", "毛线球是我的！"]
};

let catDrawerOpen = false;
let catRow = null, catSaving = null, catKey = "", catMood = null, catMoodUntil = 0, catBubble = "", catBubbleUntil = 0;
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

function catState() {
  catRow = state.posts.find((x) => x.kind === "cat" && x.author === me.name) || catRow;
  let d = {}; try { d = JSON.parse(catRow?.text || "{}"); } catch (e) {}
  return { breed: "orange", name: state.catName || "团子", outfits: { head: "bow" }, affection: 0, fishEaten: 0, lastFed: 0, day: "", pets: 0, plays: 0, ...d };
}
async function saveCat(patch) {
  const cur = { ...catState(), ...patch }, text = JSON.stringify(cur);
  try {
    if (catRow?.id) await store.updatePost(catRow.id, { text });
    else { await (catSaving = catSaving || store.addPost({ kind: "cat", text })); catSaving = null; catRow = state.posts.find((x) => x.kind === "cat" && x.author === me.name); }
  } catch (e) { catSaving = null; }
  return cur;
}
function todayCaps(c) { return c.day === today() ? { feeds: 0, ...c } : { ...c, day: today(), pets: 0, plays: 0, feeds: 0 }; }
const fishOwned = (c) => Math.max(0, Math.floor(total() / FISH_PER_MIN) + (c.bonusFish || 0) - c.fishEaten);

/* ---------- 今日心愿：每天不一样，完成了领奖励 ---------- */
const WISHES = [
  { k: "focus", n: 30, t: "今天想看你专注 30 分钟" }, { k: "feed", n: 2, t: "今天想吃 2 条小鱼干" },
  { k: "note", n: 1, t: "想看你写今天的笔记" }, { k: "pet", n: 5, t: "想被你摸摸 5 次" },
  { k: "focus", n: 60, t: "今天想看你专注 1 小时" }, { k: "moment", n: 2, t: "想看你拍 2 个瞬间" },
  { k: "play", n: 3, t: "想玩 3 次毛线球" }, { k: "together", n: 1, t: "想看你和闺蜜一起专注一次" },
  { k: "focus", n: 90, t: "今天想看你专注 1 个半小时" }, { k: "feed", n: 3, t: "今天想吃 3 条小鱼干" }
];
function wishOfDay(day) { const d = Math.floor(new Date(day + "T12:00:00").getTime() / 864e5); return WISHES[(d * 7 + 3) % WISHES.length]; }
function wishProgress(w, c) {
  const t = today();
  const v = { focus: () => myMinutesOnDay(t), feed: () => c.feeds || 0, pet: () => c.pets || 0, play: () => c.plays || 0,
    note: () => (diaryOf(me.name, t) ? 1 : 0), moment: () => momentsOf(t).filter((x) => x.author === me.name).length,
    together: () => myLogs().filter((l) => !l.failed && l.together && dayOf(l.at) === t).length }[w.k]();
  return Math.min(w.n, v);
}
const myMinutesOnDay = (d) => myLogs().filter((l) => !l.failed && dayOf(l.at) === d).reduce((a, l) => a + (Number(l.minutes) || 0), 0);
async function claimWish() {
  const c = todayCaps(catState()); if (c.wishDone === today()) return;
  await saveCat({ ...c, wishDone: today(), affection: c.affection + 5, bonusFish: (c.bonusFish || 0) + 1 });
  setCatMood("happy", 2200); const r = $("art").getBoundingClientRect(); hearts(r.width / 2, r.height * 0.35, 6);
  say("心愿实现啦！最喜欢你了 💕", 3000); render();
}
const fullness = (c) => (c.lastFed ? Math.max(0, Math.round(100 - ((Date.now() - c.lastFed) / 36e5) * 8)) : 40); // 大约 12 小时饿
const affLevel = (a) => Math.floor(a / 20) + 1;
const unlocked = (o, c) => (o.min ? total() >= o.min : c.affection >= o.need);
const sleepyTime = () => { const h = new Date().getHours(); return h >= 23 || h < 6; };

/* ---------- 画猫：所有表情都画好，用 class 切换，避免重画打断动画 ---------- */
function catSVG(c, stageIdx) {
  const b = BREEDS[c.breed] || BREEDS.orange, s = 0.8 + stageIdx * 0.05, fat = stageIdx * 4;
  const night = sleepyTime(), o = c.outfits || {};
  const patches = {
    tabby: `<g stroke="${b.dark}" stroke-width="4" stroke-linecap="round" opacity=".5" fill="none"><path d="M200 72 v12"/><path d="M188 74 l2 10"/><path d="M212 74 l-2 10"/></g>`,
    cow: `<g fill="${b.dark}"><path d="M150 100 q10 -32 46 -28 q-6 18 -20 26 q-14 8 -26 2z"/><ellipse cx="236" cy="198" rx="26" ry="18"/><ellipse cx="170" cy="214" rx="14" ry="10"/></g>`,
    points: `<g fill="${b.dark}" opacity=".45"><ellipse cx="200" cy="128" rx="34" ry="24"/></g>`,
    calico: `<g><path d="M150 102 q8 -34 44 -30 q-4 20 -18 28 q-14 8 -26 2z" fill="${b.spot}"/><path d="M250 100 q-6 -28 -34 -28 q2 16 12 24 q10 8 22 4z" fill="${b.dark}"/><ellipse cx="232" cy="200" rx="24" ry="16" fill="${b.spot}"/><ellipse cx="170" cy="212" rx="12" ry="9" fill="${b.dark}"/></g>`,
    none: ""
  }[b.pattern];
  const head = {
    bow: `<g transform="translate(232 70) rotate(18)"><path d="M0 0 l-16 -10 v20z M0 0 l16 -10 v20z" fill="#f07c9c"/><circle r="5" fill="#d9567c"/></g>`,
    flower: `<g transform="translate(236 72)">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="6" ry="9" fill="#ffd1e0" transform="rotate(${a}) translate(0 -8)"/>`).join("")}<circle r="5" fill="#ffd25e"/></g>`,
    berry: `<g transform="translate(200 62)"><path d="M-38 10 q38 -60 76 0z" fill="#ef5a6f"/><g fill="#ffe9a8">${[[-20, -2], [-6, -12], [8, -6], [20, 2], [-8, 4], [6, 6]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="3"/>`).join("")}</g><path d="M-8 -26 q8 -10 16 0 q-8 4 -16 0z" fill="#5fae6a"/></g>`,
    gradcap: `<g transform="translate(200 60)"><path d="M-46 0 l46 -18 l46 18 l-46 18z" fill="#2c3440"/><path d="M-26 8 v14 q26 12 52 0 v-14" fill="#2c3440"/><path d="M40 2 v24" stroke="#f2c14e" stroke-width="3"/><circle cx="40" cy="28" r="4" fill="#f2c14e"/></g>`,
    crown: `<g transform="translate(200 58)"><path d="M-30 12 l-6 -28 l18 14 l18 -24 l18 24 l18 -14 l-6 28z" fill="#f2c14e" stroke="#d9a62b" stroke-width="2"/><circle cy="-2" r="4" fill="#ef5a6f"/></g>`
  }[o.head] || "";
  const face = o.face === "glasses" ? `<g fill="none" stroke="#3a3a40" stroke-width="3"><circle cx="180" cy="120" r="15"/><circle cx="220" cy="120" r="15"/><path d="M195 120 h10"/></g>` : "";
  const neck = {
    bell: `<g><path d="M162 160 q38 18 76 0" stroke="#e5484d" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="200" cy="172" r="8" fill="#f2c14e" stroke="#d9a62b" stroke-width="2"/></g>`,
    scarf: `<g><path d="M156 156 q44 22 88 0 l2 12 q-46 22 -92 0z" fill="#7aa7d8"/><path d="M226 166 l12 36 l-16 2 l-6 -34z" fill="#6a96c8"/></g>`
  }[o.neck] || "";
  const eyeCol = b.eye;
  return `<svg viewBox="0 0 400 260" class="catsvg ${night ? "is-night" : ""}" role="img" aria-label="${c.name}，一只${b.name}">
    <defs><clipPath id="catclip"><circle cx="200" cy="118" r="52"/><ellipse cx="200" cy="196" rx="${58 + fat}" ry="52"/></clipPath>
      <clipPath id="catheadclip"><ellipse cx="200" cy="118" rx="56" ry="50"/></clipPath></defs>
    <rect width="400" height="260" fill="${night ? "#2c2f45" : "#fbeee9"}"/>
    <g class="room-window"><rect x="276" y="24" width="96" height="78" rx="10" fill="${night ? "#1b1e33" : "#cfe6f2"}" stroke="${night ? "#59607e" : "#f3d5cc"}" stroke-width="6"/>
      ${night ? '<circle cx="342" cy="50" r="12" fill="#f6edc1"/><circle cx="300" cy="44" r="1.6" fill="#fff"/><circle cx="318" cy="72" r="1.4" fill="#fff"/>' : '<circle cx="345" cy="48" r="12" fill="#fff6c9"/><ellipse cx="300" cy="80" rx="18" ry="6" fill="#fff" opacity=".8"/>'}
      <path d="M324 24 v78 M276 63 h96" stroke="${night ? "#59607e" : "#f3d5cc"}" stroke-width="4"/></g>
    <g fill="${night ? "#3b3f5a" : "#f6d9d2"}" opacity=".7"><circle cx="40" cy="40" r="3"/><circle cx="70" cy="70" r="2"/><circle cx="110" cy="30" r="2.5"/></g>
    <rect y="214" width="400" height="46" fill="${night ? "#3a3550" : "#f0d7c8"}"/>
    <ellipse cx="200" cy="232" rx="120" ry="22" fill="${night ? "#5a4f7a" : "#f5b7c5"}"/>
    <ellipse cx="200" cy="226" rx="104" ry="14" fill="${night ? "#6a5f8c" : "#f9cbd5"}"/>
    <g class="bowl" transform="translate(330 222)"><path d="M-26 -8 h52 q-4 22 -26 22 q-22 0 -26 -22z" fill="#8fc1e3"/><ellipse cy="-8" rx="26" ry="6" fill="#bcdcf0"/><g class="bowl-fish"><path d="M-12 -10 q10 -8 20 0 l6 -5 v10 l-6 -5 q-10 8 -20 0z" fill="#f3a35a"/></g></g>
    <g class="yarn"><circle r="13" fill="#f28fb0"/><path d="M-10 -6 q10 8 20 -2 M-11 3 q11 6 22 -4 M-6 -11 q6 14 3 22" stroke="#d9668d" stroke-width="1.6" fill="none"/></g>
    <g class="cat" transform="translate(200 232) scale(${s}) translate(-200 -232)">
      <ellipse cx="200" cy="244" rx="${70 + fat}" ry="10" fill="#000" opacity=".08"/>
      <path class="tail" d="M246 220 C 300 216 306 168 280 150" fill="none" stroke="${b.pattern === "points" ? b.dark : b.fur}" stroke-width="16" stroke-linecap="round"/>
      <g class="body"><ellipse cx="200" cy="196" rx="${58 + fat}" ry="52" fill="${b.fur}"/>
        <ellipse cx="200" cy="208" rx="${36 + fat}" ry="34" fill="${b.belly}"/></g>
      <g clip-path="url(#catclip)">${b.pattern === "cow" || b.pattern === "calico" ? patches : ""}</g>
      <g class="paws"><ellipse class="paw-l" cx="178" cy="242" rx="15" ry="10" fill="${b.fur}"/><ellipse class="paw-r" cx="222" cy="242" rx="15" ry="10" fill="${b.fur}"/>
        <g fill="${b.ear}" opacity=".7"><circle cx="172" cy="244" r="2.4"/><circle cx="178" cy="246" r="2.4"/><circle cx="184" cy="244" r="2.4"/><circle cx="216" cy="244" r="2.4"/><circle cx="222" cy="246" r="2.4"/><circle cx="228" cy="244" r="2.4"/></g></g>
      ${neck}
      <g class="head">
        <path d="M152 92 Q148 46 170 52 Q186 62 194 72Z M248 92 Q252 46 230 52 Q214 62 206 72Z" fill="${b.pattern === "points" ? b.dark : b.fur}"/>
        <path d="M158 84 Q158 60 170 62 Q180 68 186 74Z M242 84 Q242 60 230 62 Q220 68 214 74Z" fill="${b.ear}"/>
        <ellipse cx="200" cy="118" rx="56" ry="50" fill="${b.fur}"/>
        ${b.pattern === "tabby" || b.pattern === "points" ? patches : ""}
        ${b.pattern === "cow" || b.pattern === "calico" ? `<g clip-path="url(#catheadclip)">${patches}</g>` : ""}
        <g class="eyes-open">
          <ellipse cx="180" cy="120" rx="10" ry="12" fill="${eyeCol}"/><ellipse cx="220" cy="120" rx="10" ry="12" fill="${eyeCol}"/>
          <circle cx="183" cy="115" r="4" fill="#fff"/><circle cx="223" cy="115" r="4" fill="#fff"/><circle cx="177" cy="125" r="2" fill="#fff" opacity=".8"/><circle cx="217" cy="125" r="2" fill="#fff" opacity=".8"/>
          <g class="brows-sad" stroke="${b.pattern === "none" ? "#c9c2d6" : "#7a5a48"}" stroke-width="3" stroke-linecap="round"><path d="M168 102 l14 4"/><path d="M232 102 l-14 4"/></g>
        </g>
        <g class="eyes-happy" fill="none" stroke="${b.pattern === "none" ? "#efe7ff" : "#3b2a20"}" stroke-width="4" stroke-linecap="round"><path d="M170 122 q10 -12 20 0"/><path d="M210 122 q10 -12 20 0"/></g>
        <g class="eyes-sleep" fill="none" stroke="${b.pattern === "none" ? "#efe7ff" : "#3b2a20"}" stroke-width="4" stroke-linecap="round"><path d="M170 120 q10 8 20 0"/><path d="M210 120 q10 8 20 0"/></g>
        <ellipse cx="166" cy="138" rx="9" ry="5.5" fill="#ff9fb4" opacity=".55"/><ellipse cx="234" cy="138" rx="9" ry="5.5" fill="#ff9fb4" opacity=".55"/>
        <path d="M196 132 h8 l-4 5z" fill="#f08aa0"/>
        <path class="mouth-w" d="M200 137 q-5 7 -10 2 M200 137 q5 7 10 2" stroke="${b.pattern === "none" ? "#efe7ff" : "#5a3f33"}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <ellipse class="mouth-o" cx="200" cy="143" rx="7" ry="8" fill="#b54a5e"/>
        <g stroke="${b.pattern === "none" ? "#8e88a0" : "#7a6a60"}" stroke-width="1.6" opacity=".6" stroke-linecap="round"><path d="M150 128 l-22 -4 M150 136 l-22 4 M250 128 l22 -4 M250 136 l22 4"/></g>
        ${face}${head}
      </g>
      <g class="zzz" fill="#cfd3ff" font-family="ZCOOL KuaiLe, sans-serif"><text x="254" y="70" font-size="18">z</text><text x="268" y="52" font-size="24">Z</text></g>
    </g>
  </svg>`;
}

/* ---------- 页面 ---------- */
function setCatMood(m, ms = 1800) { catMood = m; catMoodUntil = Date.now() + ms; applyCatMood(); clearTimeout(setCatMood.t); setCatMood.t = setTimeout(applyCatMood, ms + 50); }
function say(text, ms = 3200) { catBubble = text; catBubbleUntil = Date.now() + ms; const el = $("cat-bubble"); if (el) { el.textContent = text; el.hidden = false; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); } clearTimeout(say.t); say.t = setTimeout(() => { const e = $("cat-bubble"); if (e && Date.now() >= catBubbleUntil) e.hidden = true; }, ms); }
function applyCatMood() {
  const svg = document.querySelector("#art .catsvg"); if (!svg) return;
  const c = catState(), m = Date.now() < catMoodUntil ? catMood : null, hungry = fullness(c) < 30;
  svg.classList.toggle("m-happy", m === "happy" || m === "eat");
  svg.classList.toggle("m-eat", m === "eat");
  svg.classList.toggle("m-play", m === "play");
  svg.classList.toggle("m-sleep", !m && sleepyTime());
  svg.classList.toggle("m-hungry", !m && !sleepyTime() && hungry);
}
function hearts(x, y, n = 3) {
  const box = $("art"); if (!box) return;
  for (let i = 0; i < n; i++) { const h = document.createElement("span"); h.className = "heart"; h.textContent = pickOne(["❤", "💕", "💗", "✨"]);
    h.style.left = `${x + (Math.random() * 40 - 20)}px`; h.style.top = `${y + (Math.random() * 20 - 10)}px`; h.style.animationDelay = `${i * 0.12}s`;
    box.appendChild(h); setTimeout(() => h.remove(), 1600); }
}
let purrNode = null;
function purr(on) { // 呼噜声：低频噪声 + 25Hz 起伏
  try {
    const ctx = window.Ambient ? Ambient.ctx() : null; if (!ctx) return;
    if (on && !purrNode) {
      const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
      const am = ctx.createGain(); am.gain.value = 0.5; const osc = ctx.createOscillator(); osc.frequency.value = 24; const depth = ctx.createGain(); depth.gain.value = 0.5; osc.connect(depth); depth.connect(am.gain);
      const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.5, ctx.currentTime, 0.08);
      src.connect(lp); lp.connect(am); am.connect(g); g.connect(ctx.destination); src.start(); osc.start(); ctx.resume?.();
      purrNode = { src, osc, g, ctx };
    } else if (!on && purrNode) { const p = purrNode; purrNode = null; p.g.gain.setTargetAtTime(0, p.ctx.currentTime, 0.12); setTimeout(() => { try { p.src.stop(); p.osc.stop(); } catch (e) {} }, 500); }
  } catch (e) {}
}

function renderCatScene(p) {
  const c = todayCaps(catState()), st = stageAt(p), fish = fishOwned(c), full = fullness(c);
  const key = [c.breed, JSON.stringify(c.outfits), st.i, sleepyTime()].join("|");
  if (catKey !== key || !document.querySelector("#art .catsvg")) {
    catKey = key;
    $("art").innerHTML = catSVG(c, st.i) + '<div class="cat-bubble" id="cat-bubble" hidden></div><div class="cat-hit" id="cat-hit" aria-label="摸摸猫猫"></div>';
    bindPetting();
  }
  applyCatMood();
  if (document.activeElement && document.activeElement.id === "catname") return; // 正在改名字：先不刷新
  const lvl = affLevel(c.affection), into = c.affection % 20;
  $("info").innerHTML = `
    <div class="cat-top"><input class="catname" id="catname" aria-label="猫猫的名字" maxlength="10"><span class="pill">${BREEDS[c.breed]?.name || "橘猫"} · ${st.s.n}</span></div>
    <div class="cat-meters">
      <div><span>❤ 亲密度 Lv.${lvl}</span><div class="bar pink"><i style="width:${(into / 20) * 100}%"></i></div></div>
      <div><span>🍚 饱腹 ${full}%</span><div class="bar ${full < 30 ? "warn" : ""}"><i style="width:${full}%"></i></div></div>
    </div>
    ${(() => { const w = wishOfDay(today()), got = wishProgress(w, c), done = c.wishDone === today(), ok = got >= w.n;
      return `<div class="wish ${done ? "done" : ""}"><div class="wish-top"><span>💭 今日心愿</span><small>${done ? "已实现 ✓" : `${w.k === "focus" ? fmtMin(got) : got} / ${w.k === "focus" ? fmtMin(w.n) : w.n}`}</small></div>
        <b>${w.t}</b><div class="bar pink"><i style="width:${(got / w.n) * 100}%"></i></div>
        ${!done && ok ? '<button class="go" id="wish-claim">领取奖励：亲密度 +5 · 小鱼干 +1 🐟</button>' : done ? "" : '<small class="note">完成后可以领取：亲密度 +5 · 小鱼干 +1</small>'}</div>`; })()}
    <div class="cat-actions">
      <button class="cat-btn" id="cat-pet"><b>🤚</b>摸摸</button>
      <button class="cat-btn" id="cat-feed" ${fish ? "" : 'aria-disabled="true"'}><b>🐟</b>喂鱼干<small>×${fish}</small></button>
      <button class="cat-btn" id="cat-play"><b>🧶</b>逗猫</button>
      <button class="cat-btn" id="cat-dress"><b>👗</b>换装</button>
    </div>
    <div class="cat-drawer" id="cat-drawer" hidden></div>
    <div class="row"><span>陪了它 ${fmtMin(p)} · 每专注 ${FISH_PER_MIN} 分钟得 1 条小鱼干</span><span>${st.next ? `再 ${fmtMin(st.next.at - p)} 长成「${st.next.n}」` : "已经是猫猫大王了"}</span></div>`;
  const inp = $("catname"); inp.value = c.name;
  inp.onchange = () => { const v = inp.value.trim().slice(0, 10); if (v) saveCat({ name: v }); };
  $("cat-pet").onclick = () => petOnce();
  $("cat-feed").onclick = feedCat;
  if ($("wish-claim")) $("wish-claim").onclick = claimWish;
  $("cat-play").onclick = playCat;
  $("cat-dress").onclick = () => { catDrawerOpen = !catDrawerOpen; $("cat-drawer").hidden = !catDrawerOpen; if (catDrawerOpen) renderDrawer(); };
  if (catDrawerOpen) { $("cat-drawer").hidden = false; renderDrawer(); }
  if (!catBubble || Date.now() > catBubbleUntil) {
    const h = new Date().getHours();
    setTimeout(() => say(sleepyTime() ? pickOne(CAT_LINES.night) : full < 30 ? pickOne(fish ? CAT_LINES.hungry : CAT_LINES.noFish)
      : h < 10 ? pickOne(CAT_LINES.morning) : greetingLine()), 400);
  }
}
function greetingLine() {
  const todayMin = myLogs().filter((l) => !l.failed && dayOf(l.at) === today()).reduce((a, l) => a + (Number(l.minutes) || 0), 0);
  const fr = typeof friends === "function" ? friends().filter((n) => statusOf(n).busy) : [];
  if (fr.length) return `${fr[0]}也在学习哦，一起冲鸭！`;
  if (todayMin >= 60) return `今天你专注了 ${fmtMin(todayMin)}，好厉害喵！`;
  return pickOne(CAT_LINES.idle);
}

async function petOnce() {
  let c = todayCaps(catState());
  setCatMood("happy", 1600); purr(true); setTimeout(() => purr(false), 1400);
  const box = $("art").getBoundingClientRect(); hearts(box.width / 2, box.height * 0.35, 4); say(pickOne(CAT_LINES.pet), 2000);
  if (c.pets < 10) await saveCat({ ...c, pets: c.pets + 1, affection: c.affection + 1 }); // 每天摸摸最多加 10 点
  render();
}
function bindPetting() {
  const hit = $("cat-hit"); if (!hit) return;
  let down = false, moved = 0, last = null, credited = false;
  hit.addEventListener("pointerdown", (e) => { down = true; moved = 0; last = [e.clientX, e.clientY]; credited = false; hit.setPointerCapture?.(e.pointerId); });
  hit.addEventListener("pointermove", (e) => {
    if (!down) return; moved += Math.hypot(e.clientX - last[0], e.clientY - last[1]); last = [e.clientX, e.clientY];
    if (moved > 24) { setCatMood("happy", 1200); purr(true);
      if (Math.random() < 0.25) { const r = $("art").getBoundingClientRect(); hearts(e.clientX - r.left, e.clientY - r.top - 20, 1); } }
    if (moved > 160 && !credited) { credited = true; const c = todayCaps(catState()); if (c.pets < 10) saveCat({ ...c, pets: c.pets + 1, affection: c.affection + 1 }); say(pickOne(CAT_LINES.pet), 1800); }
  });
  const up = () => { if (!down) return; down = false; purr(false);
    if (moved < 10) { const svg = document.querySelector("#art .catsvg"); svg?.classList.remove("bounce"); void svg?.getBoundingClientRect(); svg?.classList.add("bounce"); say(sleepyTime() ? "唔…（被吵醒了）" : greetingLine(), 2400); }
    else render(); };
  hit.addEventListener("pointerup", up); hit.addEventListener("pointercancel", up); hit.addEventListener("pointerleave", up);
}
async function feedCat() {
  let c = todayCaps(catState());
  if (!fishOwned(c)) { say(pickOne(CAT_LINES.noFish), 3000); return; }
  const svg = document.querySelector("#art .catsvg"); svg?.classList.add("feeding"); setTimeout(() => svg?.classList.remove("feeding"), 1800);
  setCatMood("eat", 1800); say(pickOne(CAT_LINES.fed), 2600);
  const r = $("art").getBoundingClientRect(); setTimeout(() => hearts(r.width / 2, r.height * 0.35, 3), 900);
  await saveCat({ ...c, fishEaten: c.fishEaten + 1, lastFed: Date.now(), affection: c.affection + 2, feeds: (c.feeds || 0) + 1 });
  setTimeout(render, 1900);
}
async function playCat() {
  let c = todayCaps(catState());
  const svg = document.querySelector("#art .catsvg"); svg?.classList.remove("playing"); void svg?.getBoundingClientRect(); svg?.classList.add("playing");
  setTimeout(() => svg?.classList.remove("playing"), 2200);
  setCatMood("play", 2200); say(pickOne(CAT_LINES.play), 2400);
  if (c.plays < 5) await saveCat({ ...c, plays: c.plays + 1, affection: c.affection + 1 }); // 每天逗猫最多加 5 点
  setTimeout(render, 2300);
}
function renderDrawer() {
  const c = catState(), d = $("cat-drawer"); d.innerHTML = "";
  const h1 = document.createElement("div"); h1.className = "label"; h1.textContent = "品种"; d.appendChild(h1);
  const br = document.createElement("div"); br.className = "chips";
  Object.entries(BREEDS).forEach(([k, b]) => { const x = document.createElement("button"); x.className = "chip swatch"; x.setAttribute("aria-pressed", String(c.breed === k));
    x.innerHTML = `<i style="background:${b.fur};border-color:${b.dark}"></i>${b.name}`; x.onclick = async () => { await saveCat({ breed: k }); render(); }; br.appendChild(x); });
  d.appendChild(br);
  const h2 = document.createElement("div"); h2.className = "label"; h2.textContent = "装扮（点一下戴上，再点一下取下）"; d.appendChild(h2);
  const grid = document.createElement("div"); grid.className = "outfits";
  OUTFITS.forEach((o) => { const ok = unlocked(o, c), on = (c.outfits || {})[o.slot] === o.id, x = document.createElement("button");
    x.className = "outfit" + (on ? " on" : ""); x.disabled = !ok;
    x.innerHTML = `<b>${{ bow: "🎀", flower: "🌸", bell: "🔔", berry: "🍓", scarf: "🧣", glasses: "👓", gradcap: "🎓", crown: "👑" }[o.id]}</b><span>${o.name}</span><small>${ok ? (on ? "戴着" : "") : o.min ? `专注 ${Math.round(o.min / 60)} 小时解锁` : `亲密度 ${o.need} 解锁`}</small>`;
    x.onclick = async () => { const outfits = { ...(c.outfits || {}) }; if (on) delete outfits[o.slot]; else outfits[o.slot] = o.id; await saveCat({ outfits }); render(); say(on ? "喵？" : "好看吗~", 1800); };
    grid.appendChild(x); });
  d.appendChild(grid);
  const n = document.createElement("p"); n.className = "note"; n.textContent = `亲密度 ${c.affection}：每天摸摸最多 +10，逗猫最多 +5，喂一次鱼干 +2。`; d.appendChild(n);
}
// 专注结束后的话
function catGrowMsg(minutes) { const c = catState(), got = Math.floor(total() / FISH_PER_MIN) - Math.floor((total() - minutes) / FISH_PER_MIN); return `${c.name}${got > 0 ? `得到了 ${got} 条小鱼干 🐟` : "又长大了一点"}。`; }
