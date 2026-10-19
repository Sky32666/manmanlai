// 慢慢来 · 给「这一刻」加字
// 拍完照片或视频后先进编辑页：加文字贴纸（拖动位置、换颜色和大小）+ 一句说明，再发布。
// 文字不烧进图片里，而是存成叠加层（posts.goal 里的 JSON），所以视频也能加，以后还能改。
"use strict";

const STK_COLORS = ["#ffffff", "#222222", "#ff7aa8", "#ffd84d", "#7fe0c0", "#8bb8ff"];
const STK_SIZES = { s: 0.055, m: 0.08, l: 0.12 };
let ed = null; // 正在编辑：{ blob, ext, mime, url, caption, items, sel, editId }

/* 原相机录像（画质最好） */
$("cam-native-video").onclick = () => { pendingCaption = $("cam-caption").value.trim(); closeCam(); $("m-video-native").click(); };
$("m-video-native").onchange = (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (f.size > 48e6) { $("m-status").textContent = "这段视频太大了（超过 48MB），录短一点再试试。"; return; }
  const ext = /quicktime|mov/i.test(f.type) || /\.mov$/i.test(f.name) ? "mov" : /webm/.test(f.type) ? "webm" : "mp4";
  saveMoment(f, ext, f.type || "video/mp4", pendingCaption); pendingCaption = "";
};

/* 拍完先进编辑页，不直接上传 */
saveMoment = function (blob, ext, mime, caption) { openEditor({ blob, ext, mime, url: URL.createObjectURL(blob), caption: caption || "", items: [] }); };

function overlayOf(x) { try { const d = JSON.parse(x.goal || "null"); return Array.isArray(d) ? d : []; } catch (e) { return []; } }
function paintOverlay(layer, items, opts = {}) {
  layer.innerHTML = ""; const w = layer.clientWidth || 300;
  items.forEach((it, i) => {
    const d = document.createElement("div"); d.className = "stk" + (it.bg ? " bg" : "") + (opts.sel === i ? " sel" : "");
    d.textContent = it.t || " "; d.style.left = it.x + "%"; d.style.top = it.y + "%"; d.style.color = it.c;
    d.style.fontSize = Math.round(w * (STK_SIZES[it.s] || STK_SIZES.m)) + "px";
    if (it.bg) d.style.background = it.c === "#ffffff" || it.c === "#ffd84d" || it.c === "#7fe0c0" ? "rgba(0,0,0,.45)" : "rgba(255,255,255,.85)";
    d.dataset.i = i; layer.appendChild(d);
  });
}
function mediaEl(url, isVid, editing) {
  if (isVid) { const v = document.createElement("video"); v.src = url; v.playsInline = true; v.muted = !!editing; v.loop = !!editing; v.autoplay = true; v.preload = "auto"; return v; }
  const im = document.createElement("img"); im.src = url; im.alt = "这一刻"; return im;
}

/* ---------- 编辑页 ---------- */
function editorDom() {
  let el = $("med"); if (el) return el;
  el = document.createElement("div"); el.id = "med"; el.className = "med"; el.hidden = true;
  el.innerHTML = `<div class="med-top"><button class="soft small" id="med-x">取消</button><b>给这一刻加点字</b><button class="go small" id="med-ok">发布</button></div>
    <div class="med-stage"><div class="mwrap" id="med-wrap"><div class="ovl" id="med-ovl"></div></div></div>
    <div class="med-tools">
      <div class="med-row"><button class="soft small" id="med-add">＋ 加文字</button><span class="note" id="med-hint">点一下文字可以改，按住可以拖</span></div>
      <div id="med-style" hidden>
        <input class="field" id="med-text" maxlength="40" placeholder="写点什么">
        <div class="med-row"><div class="med-colors" id="med-colors"></div></div>
        <div class="med-row"><div class="seg3 mini" id="med-size"></div><button class="soft small" id="med-bg">底色</button><button class="soft small" id="med-del">删除</button></div>
      </div>
      <input class="field" id="med-cap" maxlength="40" placeholder="一句话说明（可不填，显示在下面）">
    </div>`;
  document.body.appendChild(el);
  $("med-x").onclick = closeEditor;
  $("med-ok").onclick = publishEditor;
  $("med-add").onclick = () => { if (ed.items.length >= 3) { $("med-hint").textContent = "最多 3 段文字"; return; }
    ed.items.push({ t: "写点什么", x: 50, y: 30 + ed.items.length * 18, c: "#ffffff", s: "m", bg: true }); ed.sel = ed.items.length - 1; paintEditor(); $("med-text").select(); $("med-text").focus(); };
  $("med-text").oninput = (e) => { if (ed.sel == null) return; ed.items[ed.sel].t = e.target.value; paintEditor(true); };
  $("med-bg").onclick = () => { if (ed.sel == null) return; ed.items[ed.sel].bg = !ed.items[ed.sel].bg; paintEditor(); };
  $("med-del").onclick = () => { if (ed.sel == null) return; ed.items.splice(ed.sel, 1); ed.sel = null; paintEditor(); };
  // 拖动文字
  const ovl = $("med-ovl"); let drag = null;
  ovl.addEventListener("pointerdown", (e) => { const s = e.target.closest(".stk"); if (!s) { ed.sel = null; paintEditor(); return; }
    ed.sel = Number(s.dataset.i); drag = { id: e.pointerId, moved: false }; ovl.setPointerCapture?.(e.pointerId); paintEditor(); e.preventDefault(); });
  ovl.addEventListener("pointermove", (e) => { if (!drag || ed.sel == null) return; const r = ovl.getBoundingClientRect();
    const it = ed.items[ed.sel]; it.x = Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100)); it.y = Math.max(4, Math.min(96, ((e.clientY - r.top) / r.height) * 100));
    drag.moved = true; paintEditor(true); });
  const up = () => { if (drag && !drag.moved && ed.sel != null) $("med-text").focus(); drag = null; };
  ovl.addEventListener("pointerup", up); ovl.addEventListener("pointercancel", up);
  window.addEventListener("resize", () => ed && paintEditor(true));
  return el;
}
function openEditor(state0) {
  ed = { sel: null, ...state0 }; const el = editorDom(); el.hidden = false;
  const wrap = $("med-wrap"); wrap.querySelector("img,video")?.remove();
  const m = mediaEl(ed.url, ed.mime ? ed.mime.startsWith("video") : isVideo(ed.url), true);
  m.addEventListener("load", () => paintEditor(true)); m.addEventListener("loadedmetadata", () => paintEditor(true));
  wrap.prepend(m); $("med-cap").value = ed.caption || ""; $("med-ok").textContent = ed.editId ? "保存" : "发布"; $("med-ok").disabled = false;
  paintEditor();
}
function paintEditor(keepInputs) {
  paintOverlay($("med-ovl"), ed.items, { sel: ed.sel });
  const st = $("med-style"); st.hidden = ed.sel == null;
  if (ed.sel == null) return; const it = ed.items[ed.sel];
  if (!keepInputs) $("med-text").value = it.t;
  const cs = $("med-colors"); cs.innerHTML = "";
  STK_COLORS.forEach((c) => { const b = document.createElement("button"); b.className = "dot-c" + (it.c === c ? " on" : ""); b.style.background = c; b.setAttribute("aria-label", "颜色");
    b.onclick = () => { it.c = c; paintEditor(); }; cs.appendChild(b); });
  const sz = $("med-size"); sz.innerHTML = "";
  [["s", "小"], ["m", "中"], ["l", "大"]].forEach(([k, n]) => { const b = document.createElement("button"); b.textContent = n; b.setAttribute("aria-pressed", String(it.s === k)); b.onclick = () => { it.s = k; paintEditor(); }; sz.appendChild(b); });
  $("med-bg").setAttribute("aria-pressed", String(!!it.bg));
}
function closeEditor() { const el = $("med"); if (el) { el.hidden = true; el.querySelector("video")?.pause(); } ed = null; }
async function publishEditor() {
  if (!ed) return; const btn = $("med-ok"); btn.disabled = true;
  const caption = $("med-cap").value.trim().slice(0, 40), items = ed.items.filter((x) => (x.t || "").trim()).map((x) => ({ ...x, t: x.t.trim().slice(0, 40) }));
  const goal = items.length ? JSON.stringify(items) : null;
  try {
    if (ed.editId) { await store.updatePost(ed.editId, { goal, text: caption }); closeEditor(); render(); if (!$("pf").hidden) { showPf(); clearTimeout(pfTimer); } return; } // 改完停在这一张，看看效果
    if (!(cloud && postCloud) && ed.mime.startsWith("video")) { $("m-status").textContent = "视频需要连上云端才能保存，先拍张照片吧。"; closeEditor(); return; }
    btn.textContent = ed.mime.startsWith("video") ? "上传中…" : "发布中…";
    const url = await store.uploadMedia(ed.blob, ed.ext, ed.mime);
    await store.addPost({ kind: "moment", day: today(), photo: url, text: caption, goal });
    notify(`📸 ${me.name}拍下了 ${new Date().getHours()}:00 的这一刻`, caption || items[0]?.t || "去看看在做什么", "share", "moment");
    $("m-status").textContent = `${new Date().getHours()}:00 的这一刻记下了。`;
    closeEditor(); render();
  } catch (err) { btn.disabled = false; btn.textContent = "发布"; $("med-hint").textContent = "没传上去：" + (err?.message || "检查一下网络再试试"); }
}

/* ---------- 播放时显示文字；自己的可以再改 ---------- */
const _showPf3 = showPf;
showPf = function () {
  _showPf3();
  const x = pfList[pfIdx], media = $("pf-media"), m = media.querySelector("img,video"); if (!x || !m) return;
  const wrap = document.createElement("div"); wrap.className = "mwrap"; const ovl = document.createElement("div"); ovl.className = "ovl";
  media.appendChild(wrap); wrap.appendChild(m); wrap.appendChild(ovl);
  const items = overlayOf(x), paint = () => paintOverlay(ovl, items);
  m.addEventListener("load", paint); m.addEventListener("loadedmetadata", paint); setTimeout(paint, 60);
  let b = $("pf-edit"); if (!b) { b = document.createElement("button"); b.id = "pf-edit"; b.className = "soft small pf-edit"; b.textContent = "✎ 加字"; $("pf").appendChild(b); }
  b.hidden = x.author !== me.name;
  b.onclick = () => { clearTimeout(pfTimer); m.pause?.(); openEditor({ url: x.photo, mime: isVideo(x.photo) ? "video/mp4" : "image/jpeg", caption: x.text || "", items: overlayOf(x).map((i) => ({ ...i })), editId: x.id }); };
};
