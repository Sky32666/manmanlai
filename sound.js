// 慢慢来 · 环境音和 Lo-fi 音乐
// 全部由 Web Audio 实时合成：不需要下载音频文件，也没有版权问题。
"use strict";
(function () {
  const SOUNDS = [
    { id: "piano", name: "轻音乐 · 钢琴", icon: "♩" },
    { id: "music", name: "Lo-fi 节拍", icon: "♪" },
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
    { id: "sea", name: "海边自习", mix: { pad: 35, waves: 55, wind: 20, birds: 10 } },
    { id: "forest", name: "森林早晨", mix: { birds: 45, wind: 25, piano: 30 } },
    { id: "cafe", name: "街角咖啡馆", mix: { music: 45, cafe: 40, rain: 15 } },
    { id: "quiet", name: "只要白噪音", mix: { rain: 40, wind: 20 } }
  ];

  let ctx = null, master = null, playing = false;
  const gains = {}, started = {}, timers = [];
  const saved = (() => { try { return JSON.parse(localStorage.getItem("mml-sound") || "null"); } catch (e) { return null; } })();
  const state = saved || { master: 80, levels: { music: 55, train: 35, wind: 15, cafe: 10 }, scene: "tram" };

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

  /* ---------- 真钢琴采样（Salamander Grand Piano, CC BY 3.0） ---------- */
  const SAMPLE_NOTES = []; [2, 3, 4, 5, 6].forEach((o) => [["C", 0], ["Ds", 3], ["Fs", 6], ["A", 9]].forEach(([n, k]) => SAMPLE_NOTES.push({ file: `piano/${n}${o}.mp3`, midi: 12 * (o + 1) + k })));
  const samples = {}; let samplesLoading = null;
  function loadPiano() {
    if (samplesLoading) return samplesLoading;
    samplesLoading = Promise.all(SAMPLE_NOTES.map((s) => fetch(s.file).then((r) => r.arrayBuffer())
      .then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then((buf) => (samples[s.midi] = buf)).catch(() => {})));
    return samplesLoading;
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function pianoNote(out, m, t, vel, dur) {
    const keys = Object.keys(samples).map(Number);
    if (!keys.length) { // 采样还没下载好：先用柔和的合成音顶上
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); return;
    }
    const near = keys.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = samples[near]; src.playbackRate.value = Math.pow(2, (m - near) / 12);
    g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0, t + dur, 0.6);
    src.connect(g); g.connect(out); src.start(t); src.stop(t + dur + 4);
  }
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
    cafe(out) {
      // 远处的谈话声：几组共振峰带通噪声，按说话的节奏起伏
      [[380, 6], [900, 5], [1700, 6], [2600, 8]].forEach(([f, q], i) => {
        const n = noise(i % 2 ? "white" : "brown"), bp = filt("bandpass", f, q), g = ctx.createGain(); g.gain.value = 0;
        n.connect(bp); bp.connect(g); g.connect(out);
        every(() => { const t = ctx.currentTime, v = Math.random() < 0.25 ? 0.02 : 0.08 + Math.random() * 0.22;
          g.gain.setTargetAtTime(v, t, 0.05); bp.frequency.setTargetAtTime(f * (0.85 + Math.random() * 0.3), t, 0.08); }, 120, 320);
      });
      const room = noise("brown"), lp = filt("lowpass", 500), rg = ctx.createGain(); rg.gain.value = 0.18; room.connect(lp); lp.connect(rg); rg.connect(out);
      every(() => { const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); // 杯子碰撞
        o.frequency.value = 2400 + Math.random() * 1600; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4); }, 4000, 11000);
    },
    piano(out) {
      // 轻音乐：慢速分解和弦 + 稀疏的旋律，像深夜一个人弹琴
      loadPiano();
      const lp = filt("lowpass", 5200); lp.connect(out);
      const inp = ctx.createGain(); inp.connect(lp);
      const wet = ctx.createGain(); wet.gain.value = 0; inp.connect(wet); wet.connect(reverb()); // 混响音量跟着这一轨的音量
      timers.push(setInterval(() => wet.gain.setTargetAtTime(0.32 * (gains.piano?.gain.value || 0), ctx.currentTime, 0.2), 300));
      const PROGS = [
        [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 64], [43, 50, 59, 62]],   // C  Am  F  G
        [[41, 48, 57, 60], [43, 50, 59, 62], [40, 47, 55, 59], [45, 52, 60, 64]],   // F  G  Em Am
        [[45, 52, 60, 64], [41, 48, 57, 60], [48, 55, 64, 67], [43, 50, 59, 67]]    // Am F  C  G
      ];
      const MEL = [72, 74, 76, 79, 81, 84, 86, 88];
      let prog = PROGS[0], motif = null;
      sequencer(64, (i, t) => {
        const bar = Math.floor(i / 8), s8 = i % 8, chord = prog[bar % 4];
        if (i % 64 === 0) prog = pick(PROGS);
        const v = 0.16 + Math.random() * 0.06;
        if (s8 === 0) pianoNote(inp, chord[0] - 12, t, 0.2, 4.5);
        if ([0, 2, 4, 6].includes(s8)) pianoNote(inp, chord[[1, 2, 3, 2][s8 / 2]], t + Math.random() * 0.02, v, 2.4);
        if (s8 === 0 && bar % 2 === 0) motif = [0, 1, 2].map(() => pick(MEL));
        if (motif && (s8 === 1 || s8 === 4 || s8 === 5) && Math.random() < 0.55) pianoNote(inp, motif[[1, 4, 5].indexOf(s8)], t + 0.02, 0.13 + Math.random() * 0.05, 2.8);
      });
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
    },
    music(out) {
      // 生成式 Lo-fi：七和弦电钢琴 + 慢鼓点 + 黑胶底噪，72 BPM，带一点摇摆
      const lp = filt("lowpass", 1600); lp.connect(out);
      const keys = ctx.createGain(); keys.gain.value = 0.22; keys.connect(lp);
      const drums = ctx.createGain(); drums.gain.value = 0.5; drums.connect(out);
      const vin = noise("white"), vhp = filt("highpass", 3000), vg = ctx.createGain(); vg.gain.value = 0.012; vin.connect(vhp); vhp.connect(vg); vg.connect(out);
      every(() => burst(out, ctx.currentTime, 0.005, "highpass", 4000, 0.06 * Math.random()), 120, 900);
      const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
      const PROGS = [
        [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], // Fmaj7 Em7 Dm7 Cmaj7
        [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]]  // Dm7 G7 Cmaj7 Am7
      ];
      const SCALE = [72, 74, 76, 79, 81, 84];
      const beat = 60 / 72; let next = ctx.currentTime + 0.1, step = 0, prog = PROGS[0];
      function note(m, t, dur, vol) {
        [1, 2.01].forEach((h, i) => { const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = i ? "sine" : "triangle"; o.frequency.value = mtof(m) * h; o.detune.value = Math.random() * 8 - 4;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol / (i ? 4 : 1), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(keys); o.start(t); o.stop(t + dur + 0.05); });
      }
      function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(drums); o.start(t); o.stop(t + 0.35); }
      function sched() {
        if (!playing) { next = ctx.currentTime + 0.1; return; }
        while (next < ctx.currentTime + 0.4) {
          const bar = Math.floor(step / 8), s8 = step % 8, swing = s8 % 2 ? beat * 0.08 : 0, t = next + swing;
          if (step % 64 === 0) prog = PROGS[Math.floor(Math.random() * PROGS.length)];
          if (s8 === 0) prog[bar % 4].forEach((m, i) => note(m, t + i * 0.015, beat * 3.6, 0.16));
          if (s8 === 0 || s8 === 5) kick(t);
          if (s8 === 2 || s8 === 6) burst(drums, t, 0.14, "bandpass", 1800, 0.35, 0.8);
          if (step % 1 === 0) burst(drums, t, 0.04, "highpass", 7000, s8 % 2 ? 0.08 : 0.14);
          if (Math.random() < 0.18) note(SCALE[Math.floor(Math.random() * SCALE.length)], t, beat * 1.4, 0.07);
          next += beat / 2; step++;
        }
      }
      timers.push(setInterval(sched, 100));
    }
  };

  function startSound(id) { if (started[id]) return; started[id] = true; build[id](gains[id]); }
  const vol = (v) => Math.pow(v / 100, 2); // 听感更线性

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(playing ? vol(state.master) : 0, t, 0.3);
    SOUNDS.forEach((s) => {
      const v = state.levels[s.id] || 0;
      if (playing && v > 0) startSound(s.id);
      gains[s.id].gain.setTargetAtTime(vol(v) * (s.id === "music" ? 0.9 : 1), t, 0.25);
    });
  }

  window.Ambient = {
    SOUNDS, SCENES, state,
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
