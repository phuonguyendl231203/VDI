/* Hiệu ứng âm thanh tổng hợp bằng Web Audio — không cần file mp3,
 * chạy giống nhau trên trình duyệt và trong WebView của robot.
 * SFX.correct()  : "ting ting ting" + tiếng vỗ tay (trả lời ĐÚNG)
 * SFX.wrong()    : "bờ bờ" trầm (trả lời SAI)
 * SFX.win()      : kèn chiến thắng + vỗ tay (hoàn thành bài ôn tập)
 * SFX.tap()      : tiếng chạm nhẹ khi bấm nút
 * SFX.arrive()   : chuông "ding dong" khi robot tới điểm dẫn đường */
(function () {
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem("vdi_muted") === "1"; } catch (e) {}

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function bell(freq, t, dur = 0.9, vol = 0.35) {
    const c = ac(); if (!c) return;
    [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([mul, amp]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = freq * mul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / mul ** 0.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    });
  }

  function tone(freq, t, dur, type = "sawtooth", vol = 0.25, endFreq) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.linearRampToValueAtTime(endFreq, t + dur);
    f.type = "lowpass"; f.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function applause(t, dur = 1.8, vol = 0.5) {
    const c = ac(); if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = Math.floor(dur * 38);
    for (let i = 0; i < n; i++) {
      const at = t + Math.random() * dur;
      const fade = 1 - Math.max(0, (at - t) / dur - 0.55) / 0.45;
      const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      s.buffer = noiseBuf; f.type = "bandpass"; f.frequency.value = 1200 + Math.random() * 2400; f.Q.value = 0.9;
      const v = vol * (0.35 + Math.random() * 0.65) * fade;
      g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045 + Math.random() * 0.03);
      s.connect(f); f.connect(g); g.connect(master); s.start(at, Math.random() * 0.1, 0.09);
    }
  }

  window.SFX = {
    get muted() { return muted; },
    setMuted(v) { muted = !!v; try { localStorage.setItem("vdi_muted", muted ? "1" : "0"); } catch (e) {} },
    unlock() { ac(); },
    tap() { if (muted) return; const c = ac(); if (!c) return; bell(1760, c.currentTime, 0.12, 0.12); },
    correct() {
      if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.02;
      bell(1046.5, t, 0.7); bell(1318.5, t + 0.11, 0.7); bell(1568, t + 0.22, 0.7); bell(2093, t + 0.33, 1.2, 0.3);
      applause(t + 0.5, 1.7, 0.45);
    },
    wrong() {
      if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.02;
      tone(196, t, 0.26, "square", 0.16, 180); tone(147, t + 0.32, 0.5, "square", 0.16, 110);
    },
    win() {
      if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.05;
      [[392, 0, .16], [523.3, .16, .16], [659.3, .32, .16], [784, .48, .32], [659.3, .82, .14], [784, .98, .9]].forEach(([f, d, l]) => {
        tone(f, t + d, l, "sawtooth", 0.14); tone(f * 2, t + d, l, "triangle", 0.06);
      });
      bell(2093, t + 1.0, 1.4, 0.25);
      applause(t + 0.9, 2.6, 0.55);
    },
    arrive() {
      if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime + 0.02;
      bell(1318.5, t, 1.1, 0.3); bell(1046.5, t + 0.32, 1.4, 0.3);
    }
  };
})();
