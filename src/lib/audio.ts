"use client";

import { settingsStore } from "./settings";

/**
 * Table sounds synthesized with the Web Audio API — no asset files. Each sound
 * is built from short filtered-noise bursts (chips, cards) or decaying tones
 * (knocks, chimes). The context is created lazily and resumed on the first
 * user gesture, since browsers block audio until then.
 */

export type SoundName =
  | "deal"
  | "flip"
  | "check"
  | "call"
  | "bet"
  | "allIn"
  | "fold"
  | "win"
  | "yourTurn"
  | "tick"
  | "levelUp";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

if (typeof window !== "undefined") {
  const unlock = () => context();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function burst(at: number, opts: { freq: number; q: number; dur: number; gain: number; type?: BiquadFilterType }) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const filter = c.createBiquadFilter();
  filter.type = opts.type ?? "bandpass";
  filter.frequency.value = opts.freq;
  filter.Q.value = opts.q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(opts.gain, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
  src.connect(filter).connect(g).connect(master!);
  src.start(at, Math.random() * 0.5, opts.dur + 0.05);
}

function tone(at: number, opts: { freq: number; dur: number; gain: number; type?: OscillatorType; slideTo?: number }) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, at);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, at + opts.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(opts.gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
  osc.connect(g).connect(master!);
  osc.start(at);
  osc.stop(at + opts.dur + 0.05);
}

/** One ceramic chip landing on others: a bright click plus a short ring. */
function chip(at: number, gain = 0.5) {
  burst(at, { freq: 3800 + Math.random() * 900, q: 7, dur: 0.035, gain });
  burst(at + 0.004, { freq: 6500, q: 4, dur: 0.02, gain: gain * 0.5 });
}

function chips(at: number, count: number, spread: number, gain = 0.45) {
  for (let i = 0; i < count; i++) chip(at + (i / count) * spread + Math.random() * 0.012, gain * (0.7 + Math.random() * 0.4));
}

const SOUNDS: Record<SoundName, (t: number) => void> = {
  deal: (t) => burst(t, { freq: 2600, q: 0.8, dur: 0.07, gain: 0.35, type: "highpass" }),
  flip: (t) => {
    burst(t, { freq: 1800, q: 1.2, dur: 0.05, gain: 0.4 });
    burst(t + 0.03, { freq: 4200, q: 2, dur: 0.03, gain: 0.25 });
  },
  check: (t) => {
    tone(t, { freq: 140, dur: 0.09, gain: 0.55, slideTo: 90 });
    burst(t, { freq: 400, q: 1, dur: 0.05, gain: 0.25, type: "lowpass" });
    tone(t + 0.11, { freq: 130, dur: 0.08, gain: 0.45, slideTo: 85 });
    burst(t + 0.11, { freq: 400, q: 1, dur: 0.04, gain: 0.2, type: "lowpass" });
  },
  call: (t) => chips(t, 3, 0.09),
  bet: (t) => chips(t, 5, 0.16),
  allIn: (t) => {
    chips(t, 12, 0.38, 0.5);
    tone(t + 0.05, { freq: 220, dur: 0.5, gain: 0.12, type: "triangle", slideTo: 330 });
  },
  fold: (t) => burst(t, { freq: 900, q: 0.6, dur: 0.16, gain: 0.25, type: "lowpass" }),
  win: (t) => {
    chips(t, 10, 0.45, 0.4);
    tone(t + 0.1, { freq: 784, dur: 0.35, gain: 0.12 });
    tone(t + 0.22, { freq: 1175, dur: 0.5, gain: 0.1 });
  },
  yourTurn: (t) => {
    tone(t, { freq: 880, dur: 0.25, gain: 0.12 });
    tone(t + 0.09, { freq: 1318, dur: 0.35, gain: 0.1 });
  },
  tick: (t) => tone(t, { freq: 1500, dur: 0.04, gain: 0.12, type: "square" }),
  levelUp: (t) => {
    tone(t, { freq: 523, dur: 0.18, gain: 0.1, type: "triangle" });
    tone(t + 0.12, { freq: 659, dur: 0.18, gain: 0.1, type: "triangle" });
    tone(t + 0.24, { freq: 784, dur: 0.3, gain: 0.1, type: "triangle" });
  },
};

export function play(name: SoundName, delayMs = 0) {
  const { sound, volume } = settingsStore.get();
  if (!sound || volume <= 0) return;
  const c = context();
  if (!c || !master || c.state !== "running") return;
  master.gain.value = volume;
  SOUNDS[name](c.currentTime + delayMs / 1000);
}
