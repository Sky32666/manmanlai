// 慢慢来 · 每日一山
// 每天换一座世界上真实的山（同一天房间里每个人是同一座）。
// 当天专注够分钟数就算登顶；高的山要更久。海拔取常用的官方数据。
"use strict";

// shape: cone 火山锥 / pyramid 金字塔尖峰 / jagged 锯齿群峰 / table 平顶 / hill 圆润山丘 / dome 穹顶
const WORLD_PEAKS = [
  { name: "珠穆朗玛峰", en: "Everest", where: "中国 / 尼泊尔", h: 8849, shape: "jagged", fact: "世界最高峰。2020 年中尼联合测量，峰顶海拔 8848.86 米。" },
  { name: "乔戈里峰 K2", en: "K2", where: "中国 / 巴基斯坦", h: 8611, shape: "pyramid", fact: "世界第二高峰，攀登难度比珠峰还大。" },
  { name: "干城章嘉峰", en: "Kangchenjunga", where: "尼泊尔 / 印度", h: 8586, shape: "jagged", fact: "世界第三高峰。" },
  { name: "马纳斯卢峰", en: "Manaslu", where: "尼泊尔", h: 8163, shape: "pyramid", fact: "世界第八高峰，名字的意思是“灵魂之山”。" },
  { name: "安纳布尔纳峰", en: "Annapurna I", where: "尼泊尔", h: 8091, shape: "jagged", fact: "世界第十高峰，人类第一座登顶的 8000 米级山峰（1950 年）。" },
  { name: "贡嘎山", en: "Minya Konka", where: "中国四川", h: 7556, shape: "pyramid", fact: "四川最高峰，被称为“蜀山之王”。" },
  { name: "阿空加瓜山", en: "Aconcagua", where: "阿根廷", h: 6961, shape: "jagged", fact: "亚洲以外的最高峰，也是南美洲最高峰。" },
  { name: "梅里雪山 · 卡瓦格博", en: "Kawagebo", where: "中国云南", h: 6740, shape: "pyramid", fact: "藏族心中的神山，至今没有人登顶过。" },
  { name: "冈仁波齐", en: "Kailash", where: "中国西藏", h: 6656, shape: "dome", fact: "多个宗教心中的神山，从没有人登顶，大家只绕着它转山。" },
  { name: "四姑娘山 · 幺妹峰", en: "Siguniang", where: "中国四川", h: 6250, shape: "pyramid", fact: "四姑娘山四座山峰里最高的“幺妹”。" },
  { name: "德纳利山", en: "Denali", where: "美国阿拉斯加", h: 6190, shape: "jagged", fact: "北美洲最高峰，以前叫麦金利山。" },
  { name: "乞力马扎罗山", en: "Kilimanjaro", where: "坦桑尼亚", h: 5895, shape: "cone", fact: "非洲最高峰，离赤道不远，山顶却有冰川。" },
  { name: "厄尔布鲁士山", en: "Elbrus", where: "俄罗斯", h: 5642, shape: "cone", fact: "欧洲最高峰，是一座休眠火山。" },
  { name: "玉龙雪山", en: "Jade Dragon", where: "中国云南", h: 5596, shape: "jagged", fact: "丽江的雪山，主峰叫扇子陡。" },
  { name: "文森峰", en: "Vinson", where: "南极洲", h: 4892, shape: "jagged", fact: "南极洲最高峰，七大洲最高峰之一。" },
  { name: "查亚峰", en: "Puncak Jaya", where: "印度尼西亚", h: 4884, shape: "jagged", fact: "大洋洲最高峰，在新几内亚岛上。" },
  { name: "勃朗峰", en: "Mont Blanc", where: "法国 / 意大利", h: 4806, shape: "dome", fact: "阿尔卑斯山脉最高峰，名字的意思是“白色的山”。" },
  { name: "马特洪峰", en: "Matterhorn", where: "瑞士 / 意大利", h: 4478, shape: "pyramid", fact: "像金字塔一样的尖顶，曾经印在三角巧克力的包装上。" },
  { name: "雷尼尔山", en: "Mount Rainier", where: "美国华盛顿州", h: 4392, shape: "cone", fact: "西雅图天气好的时候就能看到的活火山。" },
  { name: "少女峰", en: "Jungfrau", where: "瑞士", h: 4158, shape: "jagged", fact: "山腰有欧洲海拔最高的火车站。" },
  { name: "京那巴鲁山", en: "Kinabalu", where: "马来西亚沙巴", h: 4095, shape: "jagged", fact: "马来西亚最高峰，很多人凌晨出发去山顶看日出。" },
  { name: "艾格峰", en: "Eiger", where: "瑞士", h: 3967, shape: "pyramid", fact: "以险峻的北壁闻名。" },
  { name: "玉山", en: "Yushan", where: "中国台湾", h: 3952, shape: "jagged", fact: "台湾最高峰，也是东北亚最高峰。" },
  { name: "富士山", en: "Mount Fuji", where: "日本", h: 3776, shape: "cone", fact: "日本最高峰，每年夏天才开放登山。" },
  { name: "库克山", en: "Aoraki", where: "新西兰", h: 3724, shape: "pyramid", fact: "新西兰最高峰，毛利语名字 Aoraki 的意思是“穿云者”。" },
  { name: "菲茨罗伊峰", en: "Fitz Roy", where: "阿根廷 / 智利", h: 3405, shape: "jagged", fact: "巴塔哥尼亚的标志，户外品牌 Patagonia 的标志就是它。" },
  { name: "峨眉山", en: "Mount Emei", where: "中国四川", h: 3099, shape: "hill", fact: "在金顶能看到云海、日出和佛光。" },
  { name: "瓦纳比丘", en: "Huayna Picchu", where: "秘鲁", h: 2720, shape: "pyramid", fact: "站在山顶可以俯瞰整座马丘比丘古城。" },
  { name: "长白山", en: "Changbai", where: "中国吉林", h: 2691, shape: "dome", fact: "山顶是一个火山口湖：天池。" },
  { name: "华山", en: "Mount Hua", where: "中国陕西", h: 2155, shape: "pyramid", fact: "五岳中最险的一座，有名的长空栈道就在这里。" },
  { name: "汉拿山", en: "Hallasan", where: "韩国济州岛", h: 1947, shape: "dome", fact: "韩国最高峰，是一座火山。" },
  { name: "武功山", en: "Wugong", where: "中国江西", h: 1918, shape: "hill", fact: "山顶是大片高山草甸，很多人上去看星空。" },
  { name: "黄山 · 莲花峰", en: "Huangshan", where: "中国安徽", h: 1864, shape: "jagged", fact: "奇松、怪石、云海、温泉，号称“黄山归来不看岳”。" },
  { name: "阿苏山", en: "Mount Aso", where: "日本熊本", h: 1592, shape: "dome", fact: "世界上最大的活火山口之一。" },
  { name: "泰山", en: "Mount Tai", where: "中国山东", h: 1545, shape: "hill", fact: "五岳之首，“会当凌绝顶，一览众山小”说的就是它。" },
  { name: "本尼维斯山", en: "Ben Nevis", where: "英国苏格兰", h: 1345, shape: "dome", fact: "英国最高峰。" },
  { name: "维苏威火山", en: "Vesuvius", where: "意大利", h: 1281, shape: "cone", fact: "公元 79 年喷发，掩埋了庞贝古城。" },
  { name: "桌山", en: "Table Mountain", where: "南非开普敦", h: 1085, shape: "table", fact: "山顶平得像一张桌子，常常盖着一层“桌布”一样的云。" },
  { name: "太平山", en: "Victoria Peak", where: "中国香港", h: 552, shape: "hill", fact: "香港岛最高点，晚上可以看维多利亚港的夜景。" },
  { name: "狮子山", en: "Lion Rock", where: "中国香港", h: 495, shape: "hill", fact: "山形像一只蹲着的狮子，“狮子山下”就是这里。" }
];

// 需要专注多少分钟才能登顶：矮山 30 多分钟，珠峰 3 小时
const peakMinutes = (p) => Math.round(30 + (p.h / 8849) * 150);
function peakLevel(p) {
  const m = peakMinutes(p);
  return m < 70 ? { t: "轻松", c: "#5fae6a" } : m < 110 ? { t: "适中", c: "#4f8fd6" } : m < 150 ? { t: "挑战", c: "#e7964f" } : { t: "极限", c: "#e5484d" };
}
// 同一天、同一个房间：同一座山。用日期算，打乱顺序，连续几天不会挨着高矮重复
function peakOfDay(day) {
  const n = WORLD_PEAKS.length, d = Math.floor(new Date(day + "T12:00:00").getTime() / 864e5);
  const order = (d * 17 + 7) % n; // 17 和 40 互质：40 天内每座山轮一遍
  return WORLD_PEAKS[order];
}
function myMinutesOn(day) {
  return myLogs().filter((l) => !l.failed && dayOf(l.at) === day).reduce((a, l) => a + (Number(l.minutes) || 0), 0);
}
// 登顶图鉴：哪些日子爬够了那天的山
function summitLog() {
  const days = {}; myLogs().forEach((l) => { if (!l.failed) { const d = dayOf(l.at); days[d] = (days[d] || 0) + (Number(l.minutes) || 0); } });
  return Object.entries(days).map(([d, m]) => ({ day: d, peak: peakOfDay(d), m })).filter((x) => x.m >= peakMinutes(x.peak)).sort((a, b) => b.day.localeCompare(a.day));
}

/* ---------- 画山：天空跟着时间变，轮廓跟着山的类型变，越高雪越多 ---------- */
function skyOf(h) {
  if (h < 5 || h >= 20) return { top: "#141a33", bot: "#2c355c", star: true, sun: "#f6edc1", sunY: 46 };
  if (h < 8) return { top: "#f7c6b4", bot: "#fde8d6", sun: "#ffb27a", sunY: 120 };
  if (h < 17) return { top: "#8cc2e6", bot: "#d9eef8", sun: "#fff6c9", sunY: 44 };
  return { top: "#f19b7a", bot: "#fbd6a8", sun: "#ff8c5a", sunY: 110 };
}
const PEAK_SHAPES = { // 山顶都在 (210, 40)，小路才能接上
  cone: "M-10 240 L30 228 Q120 175 175 80 L198 44 L222 44 L245 80 Q300 175 390 228 L410 240Z",
  pyramid: "M-10 240 L60 200 L140 120 L190 70 L210 38 L224 64 L262 110 L330 170 L410 220 L410 240Z",
  jagged: "M-10 240 L90 120 L150 170 L210 40 L290 150 L330 110 L410 240Z",
  table: "M-10 240 L40 200 L90 110 Q100 92 120 92 L300 92 Q318 92 328 110 L370 200 L410 240Z",
  hill: "M-10 240 L50 185 Q110 140 150 100 Q190 55 210 40 Q232 55 262 92 Q300 135 345 160 L410 205 L410 240Z",
  dome: "M-10 240 L40 205 Q90 150 140 92 Q180 48 210 44 Q240 48 280 92 Q330 150 380 205 L410 240Z"
};
function drawPeak(p, frac) {
  const hr = new Date().getHours(), sky = skyOf(hr), path = PEAK_SHAPES[p.shape] || PEAK_SHAPES.jagged;
  const snowY = p.h > 5000 ? 120 : p.h > 3500 ? 95 : p.h > 2500 ? 70 : 0; // 越高雪线越低
  const night = !!sky.star;
  const rock = night ? "#3f5468" : p.h > 3000 ? "#9aa7ad" : "#8fb19f", low = night ? "#2d4152" : "#6f957f";
  const top = p.shape === "table" ? 92 : 40;
  return `<svg viewBox="0 0 400 240" role="img" aria-label="${p.name}，海拔 ${p.h} 米">
    <defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bot}"/></linearGradient>
      <clipPath id="peakclip"><path d="${path}"/></clipPath>
      <linearGradient id="rockg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${rock}"/><stop offset="1" stop-color="${low}"/></linearGradient></defs>
    <rect width="400" height="240" fill="url(#skyg)"/>
    ${night ? [[40, 30], [90, 60], [150, 22], [300, 40], [360, 70], [250, 18], [70, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" opacity=".8"/>`).join("") : ""}
    <circle cx="345" cy="${sky.sunY}" r="16" fill="${sky.sun}" opacity=".9"/>
    ${night ? "" : '<g class="clouds" fill="#fff" opacity=".75"><ellipse cx="80" cy="60" rx="34" ry="9"/><ellipse cx="300" cy="96" rx="26" ry="7"/></g>'}
    <path d="M-10 240 L70 150 L130 200 L190 140 L260 190 L330 130 L410 200 L410 240Z" fill="${night ? "#22303f" : "#b9cfc3"}" opacity=".6"/>
    <path d="${path}" fill="url(#rockg)"/>
    ${snowY ? `<g clip-path="url(#peakclip)"><path d="M0 0 H400 V${snowY} q-30 10 -60 0 q-30 -12 -60 2 q-30 12 -60 -2 q-30 -10 -60 4 q-30 8 -60 -2 q-30 -8 -60 0 Z" fill="${night ? "#c9d6e3" : "#ffffff"}"/></g>` : ""}
    <path d="M-10 240 L60 190 L130 215 L200 185 L280 210 L410 180 L410 240Z" fill="${night ? "#1d2a36" : "#5f8a70"}"/>
    <path d="${TRAIL}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 5" stroke-linecap="round" opacity=".8"/>
    <path id="done" d="${TRAIL}" fill="none" stroke="${frac >= 1 ? "#f2c14e" : "#e5484d"}" stroke-width="4" stroke-linecap="round"/>
    <g fill="#fff" font-size="9" font-family="sans-serif" opacity=".9"><text x="50" y="236">大本营</text><text x="196" y="168">营地</text></g>
    <g transform="translate(210 ${top + 4})"><line x1="0" y1="0" x2="0" y2="-20" stroke="#2c3440" stroke-width="1.5"/><path d="M0 -20 L14 -15 L0 -10Z" fill="${frac >= 1 ? "#f2c14e" : "#e5484d"}"/></g>
    <circle id="climber" r="7" fill="#e5484d" stroke="#fff" stroke-width="2.5"/>
  </svg>`;
}

function renderPeakScene() {
  const t = today(), p = peakOfDay(t), need = peakMinutes(p), mins = myMinutesOn(t), frac = Math.min(1, mins / need), lv = peakLevel(p);
  $("art").innerHTML = drawPeak(p, frac);
  const d = $("done"), len = d.getTotalLength(), pt = d.getPointAtLength(len * frac);
  d.style.strokeDasharray = `${len}`; d.style.strokeDashoffset = `${len * (1 - frac)}`;
  $("climber").setAttribute("cx", pt.x); $("climber").setAttribute("cy", pt.y - 6);
  const log = summitLog(), tomorrow = peakOfDay(ymd(new Date(Date.now() + 864e5)));
  const left = Math.max(0, need - mins);
  $("info").innerHTML = `
    <div class="mt-name"><span>今天的山 · <i class="lvl" style="background:${lv.c}">${lv.t}</i></span><b>${p.name}</b><small>📍 ${p.where} · 海拔 ${p.h.toLocaleString()} 米 · ${p.en}</small></div>
    <p class="fact">${p.fact}</p>
    <div class="big">${frac >= 1 ? "🎉 已登顶！" : `海拔 ${Math.round(frac * p.h).toLocaleString()} 米`}</div>
    <div class="bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
    <div class="row"><span>${frac >= 1 ? `今天专注了 ${fmtMin(mins)}，登顶 ${p.name}` : `今天专注 ${fmtMin(need)} 就能登顶，还差 ${fmtMin(left)}`}</span></div>
    <div class="row"><span>明天的山：${tomorrow.name} ${tomorrow.h.toLocaleString()} 米 · ${peakLevel(tomorrow).t}</span></div>
    <details class="peaklog"><summary>⛰ 登顶图鉴 · ${log.length} 座 / 共 ${WORLD_PEAKS.length} 座</summary>
      <div class="peakgrid">${WORLD_PEAKS.map((x) => { const got = log.find((y) => y.peak === x);
        return `<div class="pk ${got ? "got" : ""}"><b>${got ? "⛰" : "？"}</b><span>${x.name}</span><small>${got ? got.day.slice(5).replace("-", "/") : x.h.toLocaleString() + " 米"}</small></div>`; }).join("")}</div>
    </details>`;
}
// 专注结束后：今天是不是刚好爬到山顶
function peakFinishMsg(minutes) {
  const t = today(), p = peakOfDay(t), need = peakMinutes(p), now = myMinutesOn(t), before = now - minutes;
  if (before < need && now >= need) return ` 🎉 你今天登顶了${p.name}（${p.h.toLocaleString()} 米）！`;
  if (now < need) return ` 离${p.name}山顶还差 ${fmtMin(need - now)}。`;
  return "";
}
