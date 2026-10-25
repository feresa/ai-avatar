// 轉場特效：在某個時間點對影片畫面做「閃白、推近、甩鏡、滑入、淡黑、故障閃爍」
import { Easing, interpolate } from "remotion";
import { srcToOut, type Segment } from "./timeline";
import type { Project, TransitionType } from "./types";

export type OutTransition = { t: number; type: TransitionType; dur: number; sound: boolean };

/** 剪輯腳本裡的轉場（原始秒數）＋ 每個剪接點自動加的轉場 → 成品時間 */
export const transitionsOf = (p: Project, segs: Segment[]): OutTransition[] => {
  const list: OutTransition[] = (p.transitions ?? []).map((x) => ({
    t: srcToOut(segs, x.at),
    type: x.type,
    dur: x.dur ?? 0.35,
    sound: x.sound !== false,
  }));
  if (p.cutTransition) {
    for (const s of segs.slice(1)) {
      // 跟手動加的轉場太近就不重複
      if (list.some((x) => Math.abs(x.t - s.outStart) < 0.5)) continue;
      list.push({ t: s.outStart, type: p.cutTransition, dur: 0.3, sound: false });
    }
  }
  return list.sort((a, b) => a.t - b.t);
};

export type TransitionLook = {
  scale: number;
  x: number; // 畫面寬度的比例
  blur: number; // px
  overlay: string | null;
  overlayOpacity: number;
  glitch: number; // 0~1
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 現在這一刻（成品秒數）轉場對畫面的影響 */
export const transitionLook = (t: number, list: OutTransition[]): TransitionLook => {
  const look: TransitionLook = { scale: 1, x: 0, blur: 0, overlay: null, overlayOpacity: 0, glitch: 0 };
  for (const tr of list) {
    const half = tr.dur / 2;
    if (t < tr.t - tr.dur || t > tr.t + tr.dur) continue;
    switch (tr.type) {
      case "flash": {
        const o = interpolate(t, [tr.t - half * 0.5, tr.t, tr.t + half * 1.5], [0, 0.9, 0], clamp);
        if (o > look.overlayOpacity) Object.assign(look, { overlay: "white", overlayOpacity: o });
        break;
      }
      case "fade": {
        const o = interpolate(t, [tr.t - half, tr.t, tr.t + half], [0, 1, 0], clamp);
        if (o > look.overlayOpacity) Object.assign(look, { overlay: "black", overlayOpacity: o });
        break;
      }
      case "zoom": {
        // 剪接點瞬間放大，再快速回到原本大小
        if (t >= tr.t) {
          const k = interpolate(t, [tr.t, tr.t + tr.dur], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
          look.scale *= 1 + 0.14 * k;
          look.blur = Math.max(look.blur, 6 * k);
        }
        break;
      }
      case "whip": {
        // 甩鏡：前半往左甩出、後半從右邊甩回來，中間最糊
        const p = interpolate(t, [tr.t - half, tr.t + half], [-1, 1], clamp);
        const k = 1 - Math.abs(p);
        look.x += (p < 0 ? -1 : 1) * k * 0.18;
        look.blur = Math.max(look.blur, 40 * k);
        break;
      }
      case "slide": {
        if (t >= tr.t) {
          const k = interpolate(t, [tr.t, tr.t + tr.dur], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
          look.x += k;
        }
        break;
      }
      case "glitch": {
        const k = interpolate(t, [tr.t - half, tr.t, tr.t + half], [0, 1, 0], clamp);
        look.glitch = Math.max(look.glitch, k);
        break;
      }
    }
  }
  return look;
};
