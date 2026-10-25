// 剪掉的段落 ↔ 成品時間的換算
import type { Caption } from "@remotion/captions";
import type { Project } from "./types";

export type Segment = { srcStart: number; srcEnd: number; outStart: number };

export const segmentsOf = (p: Project): Segment[] => {
  const keep = p.keep && p.keep.length ? p.keep : [[0, p.durationSec] as [number, number]];
  let out = 0;
  return [...keep]
    .map(([a, b]) => [Math.max(0, a), Math.min(p.durationSec, b)] as [number, number])
    .filter(([a, b]) => b - a > 0.04)
    .sort((x, y) => x[0] - y[0])
    .map(([a, b]) => {
      const s = { srcStart: a, srcEnd: b, outStart: out };
      out += b - a;
      return s;
    });
};

export const outDuration = (segs: Segment[]) =>
  segs.length ? segs[segs.length - 1].outStart + segs[segs.length - 1].srcEnd - segs[segs.length - 1].srcStart : 0;

/** 原始影片的秒數 → 成品的秒數；落在剪掉的段落就算到下一段開頭 */
export const srcToOut = (segs: Segment[], t: number): number => {
  for (const s of segs) {
    if (t < s.srcStart) return s.outStart;
    if (t <= s.srcEnd) return s.outStart + (t - s.srcStart);
  }
  return outDuration(segs);
};

/** 字幕換到成品時間；整個字落在剪掉的段落就拿掉 */
export const mapCaptions = (segs: Segment[], caps: Caption[]): Caption[] =>
  caps.flatMap((c) => {
    const mid = (c.startMs + c.endMs) / 2000;
    const seg = segs.find((s) => mid >= s.srcStart && mid <= s.srcEnd);
    if (!seg) return [];
    const shift = (seg.outStart - seg.srcStart) * 1000;
    const clamp = (ms: number) => Math.min(Math.max(ms, seg.srcStart * 1000), seg.srcEnd * 1000) + shift;
    return [{ ...c, startMs: clamp(c.startMs), endMs: clamp(c.endMs), timestampMs: null }];
  });
