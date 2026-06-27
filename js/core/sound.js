// Tiny synthesized SFX via the Web Audio API — no audio files to ship.
// The AudioContext is created lazily on the first sound (which always follows
// a user gesture, so browsers allow it). Mute state persists in localStorage.

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

function tone({ freq = 600, type = 'sine', dur = 0.1, gain = 0.16, slideTo = null }) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

function whoosh({ dur = 0.26, gain = 0.13, from = 400, to = 1800 }) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(from, c.currentTime);
  bp.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start();
  src.stop(c.currentTime + dur);
}

export function click() { tone({ freq: 520, type: 'triangle', dur: 0.05, gain: 0.08 }); }
export function flip()  { whoosh({ dur: 0.28, gain: 0.13 }); }
export function omg() {
  tone({ freq: 880, slideTo: 1320, type: 'square', dur: 0.16, gain: 0.1 });
  setTimeout(() => tone({ freq: 220, slideTo: 90, type: 'sawtooth', dur: 0.5, gain: 0.13 }), 120);
}

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (!muted) click(); // confirmation blip when unmuting
  return muted;
}
