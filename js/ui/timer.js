// Optional per-turn countdown ring. startTimer(seconds, onExpire) shows the
// ring over the card and depletes it; at 0 it pulses red and calls onExpire.
// seconds = 0 (or falsy) means "off".

const wrap  = document.querySelector('#turnTimer');
const ring  = document.querySelector('#turnTimer .tt-ring');
const label = document.querySelector('#turnTimerLabel');

const R = 24;
const C = 2 * Math.PI * R;

let rafId = null;

export function stopTimer() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (wrap) {
    wrap.hidden = true;
    wrap.classList.remove('expired');
  }
}

export function startTimer(seconds, onExpire) {
  stopTimer();
  if (!wrap || !seconds) return;

  const total = seconds * 1000;
  const start = performance.now();
  let fired = false;

  wrap.hidden = false;
  ring.style.strokeDasharray = String(C);

  function frame(now) {
    const remaining = Math.max(0, total - (now - start));
    const frac = remaining / total;           // 1 → 0
    ring.style.strokeDashoffset = String(C * (1 - frac)); // deplete clockwise
    label.textContent = String(Math.ceil(remaining / 1000));

    if (remaining <= 0) {
      if (!fired) {
        fired = true;
        wrap.classList.add('expired');
        label.textContent = '0';
        if (onExpire) onExpire();
      }
      return;
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);
}
