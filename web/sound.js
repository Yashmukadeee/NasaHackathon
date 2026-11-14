/**
 * sound.js — Web Audio API sound module for Mission Vitals.
 * No audio files needed. All sounds synthesized in browser.
 */

let _ctx = null;
let _muted = false;

function getCtx() {
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { _ctx = null; }
  }
  return _ctx;
}

function resume() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
  return c;
}

/** Play a soft ascending chime (improvement / positive event) */
export function playChime() {
  if (_muted) return;
  const c = resume(); if (!c) return;
  const t = c.currentTime;
  const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, t + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.18, t + i * 0.12 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.4);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t + i * 0.12);
    osc.stop(t + i * 0.12 + 0.4);
  });
}

/** Play a low warning tone (deterioration / alert) */
export function playWarn() {
  if (_muted) return;
  const c = resume(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.linearRampToValueAtTime(180, t + 0.3);
  gain.gain.setValueAtTime(0.22, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(t); osc.stop(t + 0.5);
  // second pulse
  const osc2 = c.createOscillator();
  const g2 = c.createGain();
  osc2.type = "triangle";
  osc2.frequency.value = 180;
  g2.gain.setValueAtTime(0.18, t + 0.6);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
  osc2.connect(g2); g2.connect(c.destination);
  osc2.start(t + 0.6); osc2.stop(t + 1.0);
}

/** Play a short positive XP gained sound */
export function playXP() {
  if (_muted) return;
  const c = resume(); if (!c) return;
  const t = c.currentTime;
  [880, 1108.73, 1318.51].forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, t + i * 0.07);
    gain.gain.linearRampToValueAtTime(0.14, t + i * 0.07 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.25);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.25);
  });
}

export function setMuted(v) { _muted = v; }
export function isMuted() { return _muted; }
