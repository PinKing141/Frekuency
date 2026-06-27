// Tiny synthesized SFX via the Web Audio API — no audio files to ship.
// Sounds are layered (multiple oscillators + filtered noise) for a fuller,
// more "designed" feel. The AudioContext is created lazily on the first sound
// (which always follows a user gesture, so browsers allow it). Mute persists.

const MUTE_KEY = 'freakquencyMuted';
let ctx = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A single oscillator voice with an attack/decay envelope and optional glide.
function tone({ freq = 600, type = 'sine', dur = 0.1, gain = 0.16, slideTo = null, when = 0, attack = 0.006 }) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// A burst of filtered noise with a sweeping band — used for swishes/whooshes.
function noise({ dur = 0.26, gain = 0.13, from = 400, to = 1800, q = 0.8, when = 0 }) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}

export function click() {
  tone({ freq: 540, slideTo: 380, type: 'triangle', dur: 0.06, gain: 0.07 });
}

// Card flip: paper swish (rising noise) + a quick descending swish tone, then
// a soft low "landing" thump as the card settles.
export function flip() {
  noise({ dur: 0.26, gain: 0.11, from: 600, to: 2600, q: 0.7 });
  tone({ freq: 900, slideTo: 320, type: 'sawtooth', dur: 0.18, gain: 0.05 });
  tone({ freq: 150, slideTo: 80, type: 'sine', dur: 0.13, gain: 0.09, when: 0.16 });
}

// L4 "OMG" sting: bright zap up, a deep sub-bass drop, a shimmering pair of
// detuned highs, and a short reverse-ish noise swell.
export function omg() {
  tone({ freq: 320, slideTo: 1500, type: 'square', dur: 0.16, gain: 0.09 });
  tone({ freq: 180, slideTo: 45, type: 'sine', dur: 0.6, gain: 0.17, when: 0.04 });
  tone({ freq: 1320, type: 'triangle', dur: 0.4, gain: 0.05, when: 0.12 });
  tone({ freq: 1336, type: 'triangle', dur: 0.4, gain: 0.05, when: 0.12 });
  noise({ dur: 0.32, gain: 0.06, from: 1400, to: 240, q: 0.6, when: 0.02 });
}

// Drink / pass: three playful descending "glug" bloops.
export function drink() {
  tone({ freq: 430, slideTo: 300, type: 'sine', dur: 0.1, gain: 0.13 });
  tone({ freq: 340, slideTo: 225, type: 'sine', dur: 0.1, gain: 0.13, when: 0.1 });
  tone({ freq: 260, slideTo: 150, type: 'sine', dur: 0.15, gain: 0.14, when: 0.2 });
}

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (!muted) click(); // confirmation blip when unmuting
  return muted;
}
