// 轉場特效：在某個時間點對影片畫面做「閃白、推近、甩鏡、滑入、淡黑、故障閃爍、穿越、漏光」
// 穿越（zoomBlur）、故障（chromaticAberration）、漏光（lightLeak）用 Remotion 官方特效庫 @remotion/effects
import { Easing, interpolate } from "remotion";
import { srcToOut, type Segment } from "./timeline";
import type { Project, TransitionType } from "./types";

export type OutTransition = { t: number; type: TransitionType; dur: number; sound: boolean };

/** 剪輯腳本裡的轉場（原始秒數）＋ 每個剪接點自動加的轉場 → 成品時間 */
export const transitionsOf = (p: Project, segs: Segment[]): OutTransition[] => {
  const list: OutTransition[] = (p.transitions ?? []).map((x) => ({
    t: srcToOut(segs, x.at),
    type: x.type,
    dur: x.dur ?? (x.type === "lightleak" ? 1.2 : x.type === "zoomblur" ? 0.6 : 0.35),
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
  zoomBlur: number; // 0~1（官方 zoomBlur 的強度比例）
  lightLeak: number | null; // 漏光進度 0~1，null = 沒有
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 現在這一刻（成品秒數）轉場對畫面的影響 */
export const transitionLook = (t: number, list: OutTransition[]): TransitionLook => {
  const look: TransitionLook = { scale: 1, x: 0, blur: 0, overlay: null, overlayOpacity: 0, glitch: 0, zoomBlur: 0, lightLeak: null };
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
      case "zoomblur": {
        // 穿越：往畫面中心衝進去，剪接點最快、最糊，過了之後從裡面衝出來
        const p = interpolate(t, [tr.t - half, tr.t + half], [-1, 1], clamp);
        const k = 1 - Math.abs(p);
        look.scale *= 1 + 0.45 * Easing.in(Easing.quad)(k);
        look.zoomBlur = Math.max(look.zoomBlur, k);
        const o = interpolate(t, [tr.t - half * 0.2, tr.t, tr.t + half * 0.4], [0, 0.35, 0], clamp);
        if (o > look.overlayOpacity) Object.assign(look, { overlay: "white", overlayOpacity: o });
        break;
      }
      case "lightleak": {
        // 漏光：暖色光從邊緣掃過整個畫面再退掉
        if (t >= tr.t - half && t <= tr.t + half) look.lightLeak = interpolate(t, [tr.t - half, tr.t + half], [0, 1], clamp);
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
