// 用程式合成聲音（不用下載、沒有版權問題）：音效、背景音樂
import fs from "node:fs";

export const SR = 44100;

export const writeWav = (file: string, left: Float32Array, right: Float32Array = left) => {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
};

const normalize = (chs: Float32Array[], peak: number) => {
  let m = 1e-9;
  for (const c of chs) for (const v of c) m = Math.max(m, Math.abs(v));
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= peak / m;
};

// 固定亂數種子：同樣的設定每次產生一樣的聲音
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** 「咻」：濾波雜訊由低到高再下來（轉場用） */
export const whoosh = () => {
  const n = Math.round(SR * 0.45);
  const out = new Float32Array(n);
  const r = rng(7);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * Math.pow(t, 0.7)) ** 2;
    const cutoff = 0.02 + 0.25 * Math.sin(Math.PI * t);
    lp += cutoff * (r() * 2 - 1 - lp);
    out[i] = lp * env;
  }
  normalize([out], 0.8);
  return out;
};

/** 「啵」：短促的音高下滑（貼圖跳出用） */
export const pop = () => {
  const n = Math.round(SR * 0.16);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 300 + 900 * Math.exp(-t * 40);
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t * 28);
  }
  normalize([out], 0.8);
  return out;
};

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export const MOODS = {
  /** 平靜：慢、柔和長音、輕輕的分解和弦（靜心、呼吸、分享） */
  calm: { bpm: 68, chords: [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]], drums: false, pluck: 0.5 },
  /** 溫暖：中速、明亮一點（生活、產品介紹） */
  warm: { bpm: 84, chords: [[48, 55, 64, 67], [43, 50, 59, 62], [45, 52, 60, 64], [41, 48, 57, 60]], drums: false, pluck: 0.8 },
  /** 輕快：有鼓、有節奏（教學、清單、活力） */
  upbeat: { bpm: 104, chords: [[45, 52, 60, 64], [41, 48, 57, 60], [48, 55, 64, 67], [43, 50, 59, 62]], drums: true, pluck: 0.9 },
} as const;
export type Mood = keyof typeof MOODS;

/** 背景音樂：和弦長音 + 低音 + 分解和弦（+ 鼓），頭尾淡入淡出 */
export const music = (mood: Mood, seconds: number) => {
  const m = MOODS[mood];
  const n = Math.round(SR * seconds);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const beat = 60 / m.bpm;
  const bar = beat * 4;
  const r = rng(11);

  const add = (start: number, dur: number, f: number, amp: number, kind: "pad" | "pluck" | "bass", pan: number) => {
    const i0 = Math.round(start * SR);
    const len = Math.round(dur * SR);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let k = 0; k < len && i0 + k < n; k++) {
      const t = k / SR;
      let v: number;
      if (kind === "pad") {
        const env = Math.min(1, t / 0.9) * Math.min(1, (dur - t) / 0.9);
        v = (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t) + 0.2 * Math.sin(4 * Math.PI * f * t)) * env;
      } else if (kind === "pluck") {
        v = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 8)) * Math.exp(-t * 4) * Math.min(1, t / 0.005);
      } else {
        const env = Math.min(1, t / 0.02) * Math.min(1, (dur - t) / 0.1);
        v = Math.sin(2 * Math.PI * f * t) * env;
      }
      L[i0 + k] += v * amp * gl;
      R[i0 + k] += v * amp * gr;
    }
  };

  const bars = Math.ceil(seconds / bar);
  for (let b = 0; b < bars; b++) {
    const ch = m.chords[b % m.chords.length];
    const t0 = b * bar;
    ch.forEach((note, j) => add(t0, bar + 0.6, midi(note + 12), 0.09, "pad", j % 2 ? 0.4 : -0.4));
    add(t0, bar, midi(ch[0] - 12), 0.22, "bass", 0);
    // 分解和弦：八分音符，偶爾休息
    for (let e = 0; e < 8; e++) {
      if (r() > m.pluck) continue;
      const note = ch[[1, 2, 3, 2, 1, 3, 2, 3][e]] + 24;
      add(t0 + e * (beat / 2), beat * 1.5, midi(note), 0.1, "pluck", r() * 1.2 - 0.6);
    }
    if (m.drums) {
      for (let q = 0; q < 4; q++) {
        const tq = t0 + q * beat;
        // 大鼓：1、3 拍
        if (q % 2 === 0) {
          const i0 = Math.round(tq * SR);
          let ph = 0;
          for (let k = 0; k < SR * 0.3 && i0 + k < n; k++) {
            const t = k / SR;
            ph += (2 * Math.PI * (45 + 90 * Math.exp(-t * 30))) / SR;
            const v = Math.sin(ph) * Math.exp(-t * 9) * 0.5;
            L[i0 + k] += v;
            R[i0 + k] += v;
          }
        }
        // 小鈸：每個八分音符
        for (const off of [0, beat / 2]) {
          const i0 = Math.round((tq + off) * SR);
          let prev = 0;
          for (let k = 0; k < SR * 0.05 && i0 + k < n; k++) {
            const x = r() * 2 - 1;
            const v = (x - prev) * Math.exp((-k / SR) * 70) * 0.07;
            prev = x;
            L[i0 + k] += v;
            R[i0 + k] += v * 0.8;
          }
        }
      }
    }
  }

  // 簡單的空間感：左右交叉回音
  const d = Math.round(SR * beat * 0.75);
  for (let i = d; i < n; i++) {
    L[i] += R[i - d] * 0.25;
    R[i] += L[i - d] * 0.25;
  }
  // 淡入 1 秒、淡出 2 秒
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const g = Math.min(1, t / 1) * Math.min(1, (seconds - t) / 2);
    L[i] *= Math.max(0, g);
    R[i] *= Math.max(0, g);
  }
  normalize([L, R], 0.7);
  return [L, R] as const;
};
