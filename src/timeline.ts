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

/**
 * 字幕換到成品時間。語音辨識給的字時間常常拖到停頓裡，剛好被剪掉；
 * 所以字不拿掉，落在剪掉段落的字就貼到最近的保留段落邊緣（通常是前一段的結尾）。
 */
export const mapCaptions = (segs: Segment[], caps: Caption[]): Caption[] => {
  if (!segs.length) return [];
  return caps.map((c) => {
    const s0 = c.startMs / 1000;
    const e0 = c.endMs / 1000;
    const gap = (s: Segment) => Math.max(0, s.srcStart - e0, s0 - s.srcEnd);
    const overlap = (s: Segment) => Math.min(e0, s.srcEnd) - Math.max(s0, s.srcStart);
    // 和哪一段重疊最多就算哪一段；都沒重疊就找最近的一段
    const seg = segs.reduce((best, s) => {
      const ob = overlap(best);
      const os = overlap(s);
      if (os > 0 || ob > 0) return os > ob ? s : best;
      return gap(s) < gap(best) ? s : best;
    });
    const shift = (seg.outStart - seg.srcStart) * 1000;
    const clamp = (ms: number) => Math.min(Math.max(ms, seg.srcStart * 1000), seg.srcEnd * 1000) + shift;
    return { ...c, startMs: clamp(c.startMs), endMs: clamp(c.endMs), timestampMs: null };
  });
};

/** 整體提早（秒）：語音辨識給的字時間常常比實際說話晚一點 */
export const shiftCaptions = (caps: Caption[], lead: number): Caption[] =>
  lead
    ? caps.map((c) => ({
        ...c,
        startMs: Math.max(0, c.startMs - lead * 1000),
        endMs: Math.max(0, c.endMs - lead * 1000),
      }))
    : caps;
