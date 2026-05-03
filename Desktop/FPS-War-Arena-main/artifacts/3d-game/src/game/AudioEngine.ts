let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ── Core primitives ──────────────────────────────────────────────────────────

function osc(freq: number, type: OscillatorType, detune = 0): OscillatorNode {
  const o = ctx().createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  return o;
}

function gain(vol: number): GainNode {
  const g = ctx().createGain();
  g.gain.value = vol;
  return g;
}

function filter(type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
  const f = ctx().createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function noiseBuffer(dur: number): AudioBuffer {
  const c = ctx();
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function playNoise(dur: number, vol: number, filterType: BiquadFilterType, filterFreq: number, filterQ = 1, pitchEnv?: { start: number; end: number; time: number }) {
  const c = ctx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.05);
  const flt = filter(filterType, filterFreq, filterQ);
  const g = gain(vol);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  if (pitchEnv) {
    flt.frequency.setValueAtTime(pitchEnv.start, c.currentTime);
    flt.frequency.exponentialRampToValueAtTime(pitchEnv.end, c.currentTime + pitchEnv.time);
  }
  src.connect(flt);
  flt.connect(g);
  g.connect(c.destination);
  src.start();
  src.stop(c.currentTime + dur + 0.05);
}

function playTone(freq: number, dur: number, vol: number, type: OscillatorType = "sine", attack = 0.005, detune = 0) {
  const c = ctx();
  const o = osc(freq, type, detune);
  const g = gain(0.0001);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

// ── GUNSHOTS ─────────────────────────────────────────────────────────────────

export function playGunshot(type: "vandal" | "phantom" | "operator" | "pistol" | "shotgun" | "sniper") {
  const c = ctx();

  switch (type) {
    case "vandal": {
      // Heavy crack + body resonance
      playNoise(0.18, 0.85, "bandpass", 320, 0.7, { start: 2800, end: 140, time: 0.14 });
      playNoise(0.08, 0.4, "highpass", 4000, 1.2);
      playTone(90, 0.16, 0.22, "sawtooth", 0.001);
      playTone(55, 0.2, 0.18, "sine", 0.002);
      // Mechanical click
      setTimeout(() => playNoise(0.025, 0.12, "highpass", 6000, 2), 12);
      // Shell casing drop
      setTimeout(() => { playTone(1800, 0.03, 0.04, "sine"); playNoise(0.02, 0.06, "highpass", 3000); }, 65 + Math.random() * 25);
      break;
    }
    case "phantom": {
      // Suppressed but punchy
      playNoise(0.12, 0.55, "bandpass", 400, 0.9, { start: 2200, end: 200, time: 0.10 });
      playNoise(0.05, 0.22, "highpass", 3500, 1.5);
      playTone(110, 0.12, 0.14, "sawtooth", 0.001);
      playTone(70, 0.15, 0.12, "sine", 0.001);
      setTimeout(() => playTone(1600, 0.025, 0.035, "sine"), 55 + Math.random() * 20);
      break;
    }
    case "operator": {
      // Massive cannon boom
      playNoise(0.35, 1.0, "bandpass", 180, 0.5, { start: 1800, end: 60, time: 0.28 });
      playNoise(0.18, 0.7, "lowpass", 600, 0.8);
      playTone(55, 0.35, 0.35, "sawtooth", 0.001);
      playTone(40, 0.4, 0.28, "sine", 0.002);
      // Distant echo
      setTimeout(() => playNoise(0.15, 0.25, "bandpass", 200, 0.6), 80);
      setTimeout(() => playTone(800, 0.04, 0.06, "sine"), 90 + Math.random() * 35);
      break;
    }
    case "pistol": {
      // Sharp crack
      playNoise(0.09, 0.45, "bandpass", 500, 1.0, { start: 3500, end: 200, time: 0.07 });
      playNoise(0.04, 0.18, "highpass", 5000, 1.3);
      playTone(150, 0.08, 0.14, "square", 0.001);
      playTone(80, 0.1, 0.1, "sine", 0.002);
      setTimeout(() => playTone(2200, 0.02, 0.035, "sine"), 45 + Math.random() * 20);
      break;
    }
    case "shotgun": {
      // Spread blast
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          playNoise(0.08, 0.3 + Math.random() * 0.2, "bandpass", 300 + Math.random() * 400, 0.8);
        }, i * 4);
      }
      playNoise(0.22, 0.9, "lowpass", 400, 0.6, { start: 1500, end: 80, time: 0.18 });
      playTone(60, 0.22, 0.3, "sawtooth", 0.001);
      setTimeout(() => playNoise(0.12, 0.35, "bandpass", 250, 0.7), 60);
      break;
    }
    case "sniper": {
      // Ultra sharp crack + long tail
      playNoise(0.45, 1.0, "bandpass", 220, 0.55, { start: 3000, end: 50, time: 0.38 });
      playNoise(0.25, 0.8, "lowpass", 500, 0.7);
      playTone(45, 0.45, 0.4, "sawtooth", 0.001);
      playTone(30, 0.5, 0.3, "sine", 0.002);
      setTimeout(() => playNoise(0.2, 0.3, "bandpass", 180, 0.5), 100);
      setTimeout(() => playTone(900, 0.05, 0.07, "sine"), 110 + Math.random() * 40);
      break;
    }
  }
}

// ── FOOTSTEPS ────────────────────────────────────────────────────────────────

let _lastFootstep = 0;
let _footstepPhase = 0;

export function playFootstep(surface: "concrete" | "metal" | "grass" | "dirt" = "concrete") {
  const now = Date.now();
  if (now - _lastFootstep < 260) return;
  _lastFootstep = now;
  _footstepPhase = (_footstepPhase + 1) % 2;
  const pitchShift = _footstepPhase === 0 ? 0 : 80;

  switch (surface) {
    case "concrete":
      playNoise(0.055, 0.14, "lowpass", 320 + pitchShift, 0.8);
      playNoise(0.02, 0.06, "highpass", 900 + pitchShift, 1.2);
      break;
    case "metal":
      playNoise(0.04, 0.10, "highpass", 1200 + pitchShift, 1.5);
      playTone(180 + pitchShift, 0.04, 0.04, "sine");
      // Metallic ring
      setTimeout(() => playTone(2400 + pitchShift, 0.06, 0.02, "sine"), 8);
      break;
    case "grass":
      playNoise(0.07, 0.09, "bandpass", 500 + pitchShift, 1.8);
      playNoise(0.04, 0.05, "bandpass", 800 + pitchShift, 2.0);
      break;
    case "dirt":
      playNoise(0.065, 0.11, "lowpass", 250 + pitchShift, 0.7);
      playNoise(0.03, 0.045, "bandpass", 400 + pitchShift, 1.0);
      break;
  }
}

// ── HIT MARKERS ──────────────────────────────────────────────────────────────

export function playHitSound(isHeadshot = false) {
  if (isHeadshot) {
    // Sharp metallic ping
    playTone(2800, 0.06, 0.3, "sine", 0.001);
    playTone(1900, 0.08, 0.2, "sine", 0.001);
    setTimeout(() => playTone(3400, 0.04, 0.15, "sine"), 25);
    // Crunchy bone crack
    playNoise(0.04, 0.15, "highpass", 3000, 1.5);
  } else {
    // Dull thud
    playTone(700, 0.05, 0.22, "square", 0.001);
    playNoise(0.03, 0.12, "bandpass", 800, 1.0);
  }
}

// ── SPIKE / BOMB ──────────────────────────────────────────────────────────────

let _lastBeep = 0;

export function playSpikeBeep(urgent = false) {
  const now = Date.now();
  if (now - _lastBeep < (urgent ? 160 : 820)) return;
  _lastBeep = now;
  // Electronic beep
  const freq = urgent ? 1600 : 960;
  const dur = urgent ? 0.055 : 0.09;
  playTone(freq, dur, urgent ? 0.35 : 0.22, "square", 0.002);
  setTimeout(() => playTone(freq * 1.5, dur * 0.4, urgent ? 0.18 : 0.10, "sine"), dur * 500);
}

export function playSpikeArmed() {
  // Dramatic arm sequence
  [0, 130, 260, 430].forEach((t, i) => {
    const f = [660, 880, 1100, 1400][i];
    const v = [0.45, 0.38, 0.3, 0.5][i];
    setTimeout(() => playTone(f, 0.14, v, "square", 0.002), t);
  });
  setTimeout(() => playNoise(0.08, 0.3, "highpass", 2000, 1.5), 450);
}

export function playSpikeExplode() {
  // Big explosion
  playNoise(0.7, 1.0, "lowpass", 300, 0.5, { start: 1200, end: 40, time: 0.55 });
  playNoise(0.4, 0.85, "bandpass", 180, 0.6);
  playTone(55, 0.55, 0.5, "sawtooth", 0.001);
  playTone(35, 0.65, 0.4, "sine", 0.002);
  setTimeout(() => playNoise(0.35, 0.5, "lowpass", 200, 0.4), 90);
  setTimeout(() => playNoise(0.2, 0.3, "bandpass", 150, 0.5), 220);
}

// ── UI SOUNDS ────────────────────────────────────────────────────────────────

export function playBuySound() {
  playTone(880, 0.06, 0.18, "sine", 0.003);
  setTimeout(() => playTone(1100, 0.07, 0.14, "sine", 0.002), 55);
  setTimeout(() => playTone(1320, 0.09, 0.12, "sine", 0.002), 110);
}

export function playMenuClick() {
  playTone(1200, 0.04, 0.12, "sine", 0.001);
}

export function playMenuHover() {
  playTone(900, 0.025, 0.07, "sine", 0.001);
}

// ── ROUND EVENTS ─────────────────────────────────────────────────────────────

export function playRoundWin() {
  // Victory fanfare
  const melody = [523, 659, 784, 1047];
  melody.forEach((f, i) => setTimeout(() => {
    playTone(f, 0.22, 0.28, "sine", 0.004);
    playTone(f * 1.25, 0.22, 0.14, "sine", 0.002);
  }, i * 110));
  setTimeout(() => {
    playTone(1047, 0.35, 0.32, "sine", 0.003);
    playTone(1319, 0.35, 0.18, "sine", 0.002);
  }, 460);
}

export function playRoundLoss() {
  // Defeat motif
  const melody = [440, 370, 311];
  melody.forEach((f, i) => setTimeout(() => {
    playTone(f, 0.25, 0.2, "sawtooth", 0.003);
    playTone(f * 0.75, 0.25, 0.1, "sine", 0.002);
  }, i * 130));
}

// ── DEFUSE ────────────────────────────────────────────────────────────────────

export function playDefuse() {
  [800, 1000, 1250, 1600].forEach((f, i) => {
    setTimeout(() => {
      playTone(f, 0.1, 0.28, "sine", 0.003);
      playTone(f * 1.2, 0.1, 0.12, "sine", 0.001);
    }, i * 90);
  });
}

// ── RELOAD ────────────────────────────────────────────────────────────────────

export function playReload() {
  // Magazine out
  playNoise(0.06, 0.18, "bandpass", 600, 1.2);
  playTone(220, 0.04, 0.08, "square", 0.002);
  // Mechanical slide
  setTimeout(() => {
    playNoise(0.05, 0.14, "highpass", 2500, 1.8);
    playTone(180, 0.035, 0.06, "square", 0.001);
  }, 320);
  // Magazine locked in
  setTimeout(() => {
    playNoise(0.04, 0.22, "bandpass", 500, 1.0);
    playTone(140, 0.04, 0.1, "sawtooth", 0.002);
  }, 620);
  // Charging handle
  setTimeout(() => {
    playNoise(0.03, 0.16, "highpass", 3000, 2.0);
    playTone(2200, 0.025, 0.04, "sine", 0.001);
  }, 820);
}

// ── DEATH ────────────────────────────────────────────────────────────────────

export function playDeath() {
  // Dramatic low hit
  playNoise(0.3, 0.5, "lowpass", 200, 0.4, { start: 800, end: 60, time: 0.25 });
  playTone(80, 0.3, 0.3, "sine", 0.002);
  // Ringing ears (high pitched fade)
  setTimeout(() => {
    const o = ctx().createOscillator();
    const g = ctx().createGain();
    o.frequency.value = 3800;
    o.type = "sine";
    g.gain.setValueAtTime(0.18, ctx().currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx().currentTime + 2.5);
    o.connect(g);
    g.connect(ctx().destination);
    o.start();
    o.stop(ctx().currentTime + 2.5);
  }, 100);
}

// ── LEVEL UP ─────────────────────────────────────────────────────────────────

export function playLevelUp() {
  const melody = [523, 659, 784, 1047, 1319];
  melody.forEach((f, i) => {
    setTimeout(() => {
      playTone(f, 0.18, 0.3, "sine", 0.003);
      if (i === melody.length - 1) {
        playTone(f * 1.5, 0.28, 0.2, "sine", 0.002);
      }
    }, i * 90);
  });
}

// ── DAMAGE RECEIVED ──────────────────────────────────────────────────────────

export function playDamageReceived(isCritical = false) {
  if (isCritical) {
    playNoise(0.08, 0.35, "bandpass", 400, 0.8, { start: 1200, end: 200, time: 0.06 });
    playTone(120, 0.1, 0.2, "sawtooth", 0.001);
  } else {
    playNoise(0.05, 0.2, "bandpass", 600, 1.0);
    playTone(160, 0.06, 0.12, "sawtooth", 0.002);
  }
}

// ── AMBIENT / UI ─────────────────────────────────────────────────────────────

export function playPortalClick() {
  playTone(1320, 0.08, 0.2, "sine", 0.002);
  setTimeout(() => playTone(1760, 0.06, 0.15, "sine", 0.002), 60);
}

export function playCountdown(final = false) {
  if (final) {
    playTone(880, 0.12, 0.4, "square", 0.003);
    setTimeout(() => playTone(1320, 0.15, 0.35, "square", 0.002), 120);
  } else {
    playTone(660, 0.08, 0.25, "square", 0.002);
  }
}
