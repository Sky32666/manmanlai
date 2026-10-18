// 慢慢来 · 音乐和环境音
// 音乐和咖啡馆人声是真实录音（都可以免费使用，见 music/CREDITS.txt）；其他环境音由 Web Audio 实时合成。
"use strict";
(function () {
  const SOUNDS = [
    { id: "music", name: "Lo-fi 音乐", icon: "♪" },
    { id: "piano", name: "钢琴曲 · 肖邦", icon: "♩" },
    { id: "musicbox", name: "八音盒", icon: "✧" },
    { id: "pad", name: "氛围长音", icon: "◌" },
    { id: "rain", name: "雨声", icon: "☂" },
    { id: "wind", name: "风声", icon: "≈" },
    { id: "waves", name: "海浪", icon: "∿" },
    { id: "birds", name: "鸟鸣", icon: "♫" },
    { id: "fire", name: "篝火", icon: "✺" },
    { id: "train", name: "列车行进", icon: "▤" },
    { id: "cafe", name: "人声 · 咖啡馆", icon: "☕" }
  ];
  const SCENES = [
    { id: "tram", name: "夕阳电车", mix: { music: 55, train: 35, wind: 15, cafe: 10 } },
    { id: "rainy", name: "雨天书房", mix: { piano: 55, rain: 50, fire: 15 } },
    { id: "night", name: "钢琴夜读", mix: { piano: 65, wind: 10 } },
    { id: "dream", name: "安静的梦", mix: { pad: 50, musicbox: 35, waves: 15 } },
    { id: "sea", name: "海边自习", mix: { music: 40, waves: 50, wind: 15, birds: 8 } },
    { id: "forest", name: "森林早晨", mix: { birds: 45, wind: 25, piano: 30 } },
    { id: "cafe", name: "街角咖啡馆", mix: { music: 45, cafe: 40, rain: 15 } },
    { id: "quiet", name: "只要白噪音", mix: { rain: 40, wind: 20 } }
  ];

  // 真实音乐：同一个歌单按顺序循环播放
  const PLAYLISTS = {
    music: { name: "Lo-fi 音乐", credit: "Loyalty Freak Music · CC0", tracks: [
      "Drowning in your smile", "Dancing in the street", "Aeroplane", "I'm glad you are here with me",
      "Crying those tears I've kept so long", "This pain is soft but here", "I hope you're happy", "Sugar and coffee"
    ].map((t, i) => ({ title: t, artist: "Loyalty Freak Music", src: `music/lofi/${i + 1}.mp3` })) },
    piano: { name: "钢琴曲 · 肖邦", credit: "Frédéric Chopin · Musopen 录音 · CC0", tracks: [
      "夜曲 降E大调 Op.9 No.2", "夜曲 降b小调 Op.9 No.1", "夜曲 B大调 Op.32 No.1", "夜曲 降E大调 Op.55 No.2",
      "夜曲 e小调 Op.72 No.1", "夜曲 升c小调（遗作）", "雨滴前奏曲 Op.28 No.15"
    ].map((t, i) => ({ title: t, artist: "肖邦", src: `music/piano/${i + 1}.mp3` })) }
  };
  // 真实环境录音：单个文件无缝循环
  const RECORDINGS = { cafe: "ambience/cafe.mp3" };
  const players = {}; // id -> { el, idx }
  let onChange = () => {};

  let ctx = null, master = null, playing = false;
  const gains = {}, started = {}, timers = [];
  const saved = (() => { try { return JSON.parse(localStorage.getItem("mml-sound") || "null"); } catch (e) { return null; } })();
  const state = saved || { master: 80, levels: { music: 55, train: 35, wind: 15, cafe: 10 }, scene: "tram" };
  state.track = state.track || { music: 0, piano: 0 };

  function save() { try { localStorage.setItem("mml-sound", JSON.stringify(state)); } catch (e) {} }

  function ensure() {
    if (ctx) return ctx;
    // iPhone：让声音不受静音键影响（iOS 17+ 支持）
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(ctx.destination);
    SOUNDS.forEach((s) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); gains[s.id] = g; });
    return ctx;
  }

  /* ---------- 噪声素材 ---------- */
  let whiteBuf = null, brownBuf = null;
  function buffers() {
    if (whiteBuf) return;
    const len = ctx.sampleRate * 4;
    whiteBuf = ctx.createBuffer(2, len, ctx.sampleRate);
    brownBuf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const w = whiteBuf.getChannelData(c), b = brownBuf.getChannelData(c); let last = 0;
      for (let i = 0; i < len; i++) { const r = Math.random() * 2 - 1; w[i] = r; last = (last + 0.02 * r) / 1.02; b[i] = last * 3.5; }
    }
  }
  function noise(kind) { buffers(); const n = ctx.createBufferSource(); n.buffer = kind === "brown" ? brownBuf : whiteBuf; n.loop = true; n.start(0, Math.random() * 3); return n; }
  function filt(type, freq, q) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q != null) f.Q.value = q; return f; }
  function lfo(rate, depth, target, offset) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); g.connect(target); if (offset != null) target.value = offset; o.start(); return o;
  }
  function burst(out, t, dur, type, freq, vol, q) { // 一小段噪声：雨滴、柴火噼啪、车轮声
    const n = ctx.createBufferSource(); n.buffer = whiteBuf;
    const f = filt(type, freq, q), g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(out); n.start(t, Math.random() * 3); n.stop(t + dur + 0.05);
  }
  function every(fn, minMs, maxMs) { // 随机间隔重复
    let alive = true; const loop = () => { if (!alive) return; if (playing) fn(); timers.push(setTimeout(loop, minMs + Math.random() * (maxMs - minMs))); };
    loop(); return () => (alive = false);
  }

  /* ---------- 混响 ---------- */
  let reverbIn = null;
  function reverb() {
    if (reverbIn) return reverbIn;
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    reverbIn = ctx.createGain(); reverbIn.connect(conv); conv.connect(master);
    return reverbIn;
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function sequencer(bpm, stepFn) { // 每 100ms 往前排 0.5 秒的音符
    const step = 60 / bpm / 2; let next = ctx.currentTime + 0.2, i = 0;
    timers.push(setInterval(() => {
      if (!playing) { next = ctx.currentTime + 0.2; return; }
      while (next < ctx.currentTime + 0.5) { stepFn(i, next); next += step; i++; }
    }, 100));
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------- 每种声音 ---------- */
  const build = {
    rain(out) {
      const n = noise("white"), hp = filt("highpass", 900), lp = filt("lowpass", 6500), g = ctx.createGain(); g.gain.value = 0.32;
      n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
      const n2 = noise("brown"), lp2 = filt("lowpass", 400), g2 = ctx.createGain(); g2.gain.value = 0.25; n2.connect(lp2); lp2.connect(g2); g2.connect(out);
      every(() => burst(out, ctx.currentTime, 0.03 + Math.random() * 0.04, "bandpass", 2500 + Math.random() * 3000, 0.25 * Math.random(), 4), 40, 160);
    },
    wind(out) {
      const n = noise("brown"), bp = filt("bandpass", 420, 0.7), g = ctx.createGain(); g.gain.value = 0.7;
      n.connect(bp); bp.connect(g); g.connect(out);
      lfo(0.09, 260, bp.frequency, 420); lfo(0.05, 0.35, g.gain, 0.55);
    },
    waves(out) {
      const n = noise("brown"), lp = filt("lowpass", 700), g = ctx.createGain(); g.gain.value = 0;
      n.connect(lp); lp.connect(g); g.connect(out);
      const swell = () => { const t = ctx.currentTime, d = 6 + Math.random() * 4;
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0.9, t + d * 0.45); g.gain.linearRampToValueAtTime(0.12, t + d);
        lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1400, t + d * 0.45); lp.frequency.linearRampToValueAtTime(450, t + d); };
      every(swell, 7000, 10000);
    },
    birds(out) {
      const chirp = () => {
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = Math.random() * 1.6 - 0.8; p.connect(out);
        const base = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const t = ctx.currentTime + i * (0.09 + Math.random() * 0.06), o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.5), t + 0.06);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
          o.connect(g); g.connect(p); o.start(t); o.stop(t + 0.1);
        }
      };
      every(chirp, 900, 4200);
    },
    fire(out) {
      const n = noise("brown"), lp = filt("lowpass", 350), g = ctx.createGain(); g.gain.value = 0.5; n.connect(lp); lp.connect(g); g.connect(out);
      lfo(0.3, 0.15, g.gain, 0.5);
      every(() => burst(out, ctx.currentTime, 0.004 + Math.random() * 0.02, "highpass", 1500 + Math.random() * 2500, 0.2 + Math.random() * 0.5), 30, 420);
    },
    train(out) {
      const n = noise("brown"), lp = filt("lowpass", 160), g = ctx.createGain(); g.gain.value = 0.9; n.connect(lp); lp.connect(g); g.connect(out);
      const n2 = noise("white"), bp = filt("bandpass", 900, 0.6), g2 = ctx.createGain(); g2.gain.value = 0.04; n2.connect(bp); bp.connect(g2); g2.connect(out);
      lfo(0.13, 0.12, g.gain, 0.9);
      every(() => { const t = ctx.currentTime; // 哐当-哐当
        [0, 0.16].forEach((d) => burst(out, t + d, 0.09, "lowpass", 380, 0.7));
        [0.62, 0.78].forEach((d) => burst(out, t + d, 0.08, "lowpass", 340, 0.55)); }, 1150, 1250);
    },
    musicbox(out) {
      // 八音盒：高音区的铃声，慢慢转
      const inp = ctx.createGain(); inp.connect(out);
      const wet = ctx.createGain(); wet.gain.value = 0; inp.connect(wet); wet.connect(reverb());
      timers.push(setInterval(() => wet.gain.setTargetAtTime(0.35 * (gains.musicbox?.gain.value || 0), ctx.currentTime, 0.2), 300));
      const TUNES = [[84, 88, 91, 88, 86, 89, 93, 89, 84, 88, 91, 96, 95, 91, 88, 86], [81, 84, 88, 84, 83, 86, 89, 86, 79, 84, 88, 91, 89, 86, 84, 83]];
      let tune = TUNES[0];
      function bell(m, t, v) {
        [[1, 1, 1.6], [4.0, 0.25, 0.4], [2.0, 0.18, 0.9]].forEach(([h, a, d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = mtof(m) * h;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          o.connect(g); g.connect(inp); o.start(t); o.stop(t + d + 0.05); });
      }
      sequencer(76, (i, t) => {
        if (i % 32 === 0) tune = pick(TUNES);
        const n = tune[i % 16]; if (Math.random() < 0.88) bell(n, t + Math.random() * 0.015, 0.09);
        if (i % 8 === 0) bell(n - 24, t, 0.05);
      });
    },
    pad(out) {
      // 氛围长音：慢慢起伏的和弦，没有节拍
      const lp = filt("lowpass", 900); lp.connect(out);
      const wet = ctx.createGain(); wet.gain.value = 0; lp.connect(wet); wet.connect(reverb());
      timers.push(setInterval(() => wet.gain.setTargetAtTime(0.5 * (gains.pad?.gain.value || 0), ctx.currentTime, 0.3), 300));
      lfo(0.05, 300, lp.frequency, 900);
      const CH = [[48, 55, 59, 64], [45, 52, 57, 64], [41, 48, 55, 60], [43, 50, 55, 62]];
      let k = 0;
      const play = () => {
        const t = ctx.currentTime, chord = CH[k++ % CH.length];
        chord.forEach((m) => [-6, 6].forEach((det) => {
          const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = mtof(m); o.detune.value = det;
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 3); g.gain.setValueAtTime(0.035, t + 6); g.gain.linearRampToValueAtTime(0.0001, t + 11);
          o.connect(g); g.connect(lp); o.start(t); o.stop(t + 11.2); }));
      };
      every(play, 7800, 8200);
    }
  };

  /* ---------- 真实音乐播放器 ---------- */
  function trackPlayer(id, out) {
    const list = PLAYLISTS[id].tracks, el = new Audio();
    el.preload = "auto"; el.playsInline = true;
    const p = { el, idx: Math.min(state.track[id] || 0, list.length - 1) };
    el.src = list[p.idx].src;
    try { ctx.createMediaElementSource(el).connect(out); } catch (e) { p.direct = true; } // 不支持时直接播放
    el.addEventListener("ended", () => go(id, p.idx + 1));
    el.addEventListener("play", () => onChange()); el.addEventListener("pause", () => onChange());
    players[id] = p;
  }
  function go(id, idx, autoplay = true) {
    const list = PLAYLISTS[id].tracks, n = list.length; idx = ((idx % n) + n) % n;
    state.track[id] = idx; save();
    const p = players[id];
    if (p) { p.idx = idx; p.el.src = list[idx].src; if (autoplay && playing && (state.levels[id] || 0) > 0) p.el.play().catch(() => {}); }
    onChange();
  }

  function loopPlayer(id, out) {
    const el = new Audio(RECORDINGS[id]); el.loop = true; el.preload = "auto"; el.playsInline = true;
    const p = { el, idx: 0 };
    try { ctx.createMediaElementSource(el).connect(out); } catch (e) { p.direct = true; }
    players[id] = p;
  }

  function startSound(id) {
    if (started[id]) return; started[id] = true;
    if (PLAYLISTS[id]) trackPlayer(id, gains[id]);
    else if (RECORDINGS[id]) loopPlayer(id, gains[id]);
    else build[id](gains[id]);
  }
  const vol = (v) => Math.pow(v / 100, 2); // 听感更线性

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(playing ? vol(state.master) : 0, t, 0.3);
    SOUNDS.forEach((s) => {
      const v = state.levels[s.id] || 0;
      if (playing && v > 0) startSound(s.id);
      gains[s.id].gain.setTargetAtTime(vol(v) * (PLAYLISTS[s.id] ? 0.75 : RECORDINGS[s.id] ? 1.4 : 1), t, 0.25);
      const p = players[s.id];
      if (p) { if (p.direct) p.el.volume = vol(v) * vol(state.master); if (playing && v > 0) { if (p.el.paused) p.el.play().catch(() => {}); } else if (!p.el.paused) p.el.pause(); }
    });
  }

  window.Ambient = {
    SOUNDS, SCENES, PLAYLISTS, state,
    onChange(fn) { onChange = fn; },
    // 当前歌单：音量最大的那个音乐；都没开就用 Lo-fi
    active() { const ids = Object.keys(PLAYLISTS); return ids.reduce((a, b) => ((state.levels[b] || 0) > (state.levels[a] || 0) ? b : a), ids[0]); },
    track(id) { return PLAYLISTS[id].tracks[state.track[id] || 0]; },
    next(id) { go(id, (state.track[id] || 0) + 1); },
    prev(id) { go(id, (state.track[id] || 0) - 1); },
    choose(id, idx) { if (!(state.levels[id] > 0)) { state.levels[id] = 55; state.scene = null; } go(id, idx); if (!playing) this.play(); else apply(); },
    get playing() { return playing; },
    async play() { ensure(); playing = true; apply(); try { await ctx.resume(); } catch (e) {} },
    pause() { playing = false; apply(); },
    toggle() { return playing ? (this.pause(), false) : (this.play(), true); },
    set(id, v) { state.levels[id] = v; state.scene = null; save(); apply(); },
    setMaster(v) { state.master = v; save(); apply(); },
    scene(id) { const sc = SCENES.find((x) => x.id === id); if (!sc) return; state.levels = { ...sc.mix }; state.scene = id; save(); apply(); },
    reset() { state.levels = {}; state.scene = null; save(); apply(); },
    ctx() { return ensure(); }
  };
})();
