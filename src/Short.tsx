// 一支短影片：影片（剪掉停頓、直式裁切、推近、聚光燈、拉遠揭曉）＋ 插圖 ＋ 下半部加深 ＋ 逐字字幕 ＋ 字卡 ＋ 貼圖 ＋ 開場標題 ＋ 音樂音效
// 影片用 @remotion/media 的 <Video>，特效用 Remotion 官方特效庫 @remotion/effects
import React from "react";
import { chromaticAberration } from "@remotion/effects/chromatic-aberration";
import { colorKey } from "@remotion/effects/color-key";
import { dropShadow } from "@remotion/effects/drop-shadow";
import { outline } from "@remotion/effects/outline";
import { lightLeak } from "@remotion/effects/light-leak";
import { vignette } from "@remotion/effects/vignette";
import { zoomBlur } from "@remotion/effects/zoom-blur";
import { Video } from "@remotion/media";
import { AbsoluteFill, Audio, Sequence, Solid, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing, type EffectDescriptor } from "remotion";
import { Captions } from "./components/Captions";
import { Card } from "./components/Card";
import { Backdrop } from "./components/Backdrop";
import { Compare } from "./components/Compare";
import { DepthText } from "./components/DepthText";
import { Headlines } from "./components/Headlines";
import { Hook } from "./components/Hook";
import { Insert } from "./components/Insert";
import { MagazineBack, MagazineFront } from "./components/Magazine";
import { Note } from "./components/Note";
import { Orbit } from "./components/Orbit";
import { Phone } from "./components/Phone";
import { Sticker } from "./components/Sticker";
import { mapCaptions, segmentsOf, shiftCaptions, srcToOut } from "./timeline";
import { transitionLook, transitionsOf } from "./transitions";
import type { ShortProps } from "./types";

const zoomAt = (t: number, zooms: { start: number; end: number; scale: number }[]) => {
  let z = 1;
  for (const { start, end, scale } of zooms) {
    const ramp = Math.min(0.25, (end - start) / 3);
    if (t < start || t > end) continue;
    const k = interpolate(t, [start, start + ramp, end - ramp, end], [0, 1, 1, 0], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    z = Math.max(z, 1 + (scale - 1) * k);
  }
  return z;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Short: React.FC<ShortProps> = ({ name, project: p, captions }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const segs = segmentsOf(p);
  const t = frame / fps;
  const dir = `projects/${name}`;
  const zooms = (p.zooms ?? []).map((z) => ({
    start: srcToOut(segs, z.at),
    end: srcToOut(segs, z.at + z.dur),
    scale: z.scale,
  }));
  // 拉遠揭曉：一開始很近，慢慢拉遠，同時從模糊變清楚
  let revealScale = 1;
  let revealBlur = 0;
  for (const r of p.reveals ?? []) {
    const a = srcToOut(segs, r.at);
    const b = srcToOut(segs, r.at + r.dur);
    if (t < a || t > b) continue;
    const q = interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    revealScale = Math.max(revealScale, (r.from ?? 2.2) - ((r.from ?? 2.2) - 1) * q);
    revealBlur = Math.max(revealBlur, (1 - q) ** 2);
  }
  const scale = (p.baseZoom ?? 1) * zoomAt(t, zooms) * revealScale;
  const focus = `${(p.focusX ?? 0.5) * 100}% ${(p.focusY ?? 0.4) * 100}%`;
  // 推近的中心：有臉的位置就往臉放大
  const zoomOrigin = p.face ? `${(p.face.x + p.face.w / 2) * 100}% ${(p.face.y + p.face.h / 2) * 100}%` : focus;
  const hook = p.hook;
  const hookFrom = hook ? Math.round(srcToOut(segs, hook.from) * fps) : 0;
  const hookTo = hook ? Math.round(srcToOut(segs, hook.to) * fps) : 0;
  const cap = p.captions ?? {};
  const transitions = transitionsOf(p, segs);
  const look = transitionLook(t, transitions);
  // 故障閃爍：畫面左右抖動＋RGB 錯位
  const jitter = look.glitch ? Math.sin(frame * 2.3) * look.glitch * 0.03 : 0;

  // 直式裁切：用原始影片的寬高算出影片要放多大、往哪邊對齊（對準臉）
  const fx = p.focusX ?? 0.5;
  const fy = p.focusY ?? 0.4;
  const box =
    p.sourceWidth && p.sourceHeight
      ? (() => {
          const S = Math.max(W / p.sourceWidth, H / p.sourceHeight);
          const iw = p.sourceWidth * S;
          const ih = p.sourceHeight * S;
          return { left: (W - iw) * fx, top: (H - ih) * fy, w: iw, h: ih };
        })()
      : { left: 0, top: 0, w: W, h: H };
  // 畫面上的位置（0~1）→ 影片上的位置（特效用）
  const onVideo = (x: number, y: number) => [(x * W - box.left) / box.w, (y * H - box.top) / box.h] as const;
  const faceC = p.face ? ([p.face.x + p.face.w / 2, p.face.y + p.face.h / 2] as const) : ([0.5, 0.4] as const);

  // 聚光燈：前後 0.3 秒淡入淡出
  let spot: { k: number; strength: number; radius: number; x: number; y: number } | null = null;
  for (const sp of p.spotlights ?? []) {
    const a = srcToOut(segs, sp.at);
    const b = srcToOut(segs, sp.at + sp.dur);
    if (t < a || t > b) continue;
    const ramp = Math.min(0.3, (b - a) / 3);
    const k = interpolate(t, [a, a + ramp, b - ramp, b], [0, 1, 1, 0], clamp);
    if (!spot || k > spot.k)
      spot = { k, strength: sp.strength ?? 0.8, radius: sp.radius ?? 0.32, x: sp.x ?? faceC[0], y: sp.y ?? faceC[1] };
  }

  const effects: EffectDescriptor<unknown>[] = [];
  if (spot && spot.k > 0.01)
    effects.push(
      vignette({
        amount: spot.k * spot.strength,
        radius: Math.min(1, spot.radius * (W / box.w)),
        feather: 0.45,
        center: onVideo(spot.x, spot.y),
      }),
    );
  const zb = Math.max(look.zoomBlur, revealBlur);
  if (zb > 0.01) effects.push(zoomBlur({ amount: Math.round(zb * 90), center: onVideo(faceC[0], faceC[1]) }));
  if (look.glitch > 0.01) effects.push(chromaticAberration({ amount: Math.round(look.glitch * 22), angle: (frame * 47) % 360 }));
  // 字卡、插圖、貼圖：原始影片的時間 → 成品的格數
  const span = (at: number, dur: number) => {
    const from = Math.round(srcToOut(segs, at) * fps);
    return { from, durationInFrames: Math.max(1, Math.round(srcToOut(segs, at + dur) * fps) - from) };
  };

  // ---------- 去背（綠幕 colorKey 或 AI 去背 matte.webm）----------
  const gs = p.greenScreen;
  const keyFx = gs
    ? [colorKey({ keyColor: gs.color ?? "#00ff00", similarity: gs.similarity ?? 0.2, smoothness: gs.smoothness ?? 0.08, spillSuppression: gs.spill ?? 0.35 })]
    : [];
  const canCut = !!gs || !!p.matte;
  // 現在這一刻正在進行的那一個（原始秒數換成成品秒數）
  const now = <T extends { at: number; dur: number }>(list?: T[]) =>
    (list ?? []).find((x) => t >= srcToOut(segs, x.at) && t < srcToOut(segs, x.at + x.dur));
  const bgNow = now(p.backgrounds);
  const breakNow = now(p.breakouts);
  const cutNow = now(p.cutouts);
  const depthNow = now(p.depthTexts);
  const magNow = now(p.magazines);
  const needPerson = canCut && !!(bgNow || breakNow || cutNow || depthNow || magNow);
  // 人像層提早 1 秒載入（影片解碼器要暖機，突然掛上去容易卡住逾時），還沒輪到時先隱藏
  const soon = (list?: { at: number; dur: number }[]) =>
    (list ?? []).some((x) => t >= srcToOut(segs, x.at) - 1 && t < srcToOut(segs, x.at + x.dur));
  const breakSoon = (p.breakouts ?? []).find((x) => soon([x]));
  const mountPerson = canCut && [p.backgrounds, p.breakouts, p.cutouts, p.depthTexts, p.magazines].some(soon);
  // 綠幕去背後要墊的背景
  const bgSrc = bgNow?.src ?? p.background;

  // 一層影片：跟主畫面同樣的剪接、裁切、推近（人像層也用這個，才會完全對齊）
  const videoLayer = (src: string, fx: EffectDescriptor<unknown>[], opts: { muted?: boolean } = {}) => (
    <AbsoluteFill
      style={{
        transform: `translateX(${(look.x + jitter) * 100}%) scale(${scale * look.scale})`,
        transformOrigin: zoomOrigin,
        filter: look.blur > 0.3 ? `blur(${look.blur.toFixed(1)}px)` : undefined,
      }}
    >
      {segs.map((sg, i) => (
        <Sequence
          key={i}
          from={Math.round(sg.outStart * fps)}
          durationInFrames={Math.max(1, Math.round((sg.srcEnd - sg.srcStart) * fps))}
          premountFor={fps}
        >
          <Video
            src={staticFile(`${dir}/${src}`)}
            trimBefore={Math.round(sg.srcStart * fps)}
            volume={opts.muted ? 0 : (p.videoVolume ?? 1)}
            muted={opts.muted}
            objectFit={p.sourceWidth ? "fill" : "cover"}
            style={{ position: "absolute", left: box.left, top: box.top, width: box.w, height: box.h }}
            effects={fx}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
  // 主畫面：綠幕的話先墊背景、影片去掉綠色
  const scene = (opts: { muted?: boolean } = {}) => (
    <>
      {gs && <Backdrop src={bgSrc} dir={dir} />}
      {videoLayer(p.video, [...keyFx, ...effects], opts)}
    </>
  );
  // 人像層：綠幕用原影片＋colorKey，AI 去背用 matte.webm；剪貼時加白邊和陰影
  const person = () =>
    videoLayer(
      gs ? p.video : (p.matte as string),
      [
        ...(gs ? keyFx : []),
        ...(cutNow ? [outline({ width: 18, color: cutNow.outline ?? "#ffffff" }), dropShadow({ radius: 22, offsetX: 10, offsetY: 18, opacity: 0.45 })] : []),
      ],
      { muted: true },
    );
  // 破框的框：上緣在臉的中間，頭會衝出框外
  const frameTop = Math.max(0.12, faceC[1]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* 影片：每一段保留的內容接起來 */}
      {scene()}

      {/* AI 去背時換背景：背景蓋在原畫面上，人像層再疊回來 */}
      {!gs && bgNow && canCut && <Backdrop src={bgNow.src} dir={dir} />}

      {/* 破框：框外換成背景，框裡是原畫面，人像層疊在最上面（頭衝出框外） */}
      {breakSoon && canCut && (
        <AbsoluteFill style={{ opacity: breakNow ? 1 : 0 }}>
          <Backdrop src={breakSoon.backdrop ?? "#EFE8DC"} dir={dir} />
          <AbsoluteFill
            style={{
              clipPath: `inset(${frameTop * 100}% 7% ${(1 - 0.74) * 100}% 7% round ${W * 0.04}px)`,
            }}
          >
            {scene({ muted: true })}
          </AbsoluteFill>
          <div
            style={{
              position: "absolute",
              left: W * 0.07,
              right: W * 0.07,
              top: frameTop * H,
              bottom: (1 - 0.74) * H,
              borderRadius: W * 0.04,
              border: `${W * 0.014}px solid white`,
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            }}
          />
        </AbsoluteFill>
      )}

      {/* 剪貼：背景換成紙，人像加白邊陰影 */}
      {cutNow && canCut && <Backdrop src={cutNow.backdrop ?? "#F6D98B"} dir={dir} paper />}

      {/* 人的後面：景深大字、雜誌大標題 */}
      {(p.depthTexts ?? []).map((d, i) => {
        const sp = span(d.at, d.dur);
        return (
          <Sequence key={`dt${i}`} {...sp}>
            <DepthText depth={d} face={p.face} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}
      {(p.magazines ?? []).map((m, i) => {
        const sp = span(m.at, m.dur);
        return (
          <Sequence key={`mgb${i}`} {...sp}>
            <MagazineBack magazine={m} face={p.face} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {/* 人像層（只在需要的時候出現） */}
      {mountPerson && <AbsoluteFill style={{ opacity: needPerson ? 1 : 0 }}>{person()}</AbsoluteFill>}

      {(p.magazines ?? []).map((m, i) => {
        const sp = span(m.at, m.dur);
        return (
          <Sequence key={`mgf${i}`} {...sp}>
            <MagazineFront magazine={m} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {(p.compares ?? []).map((c, i) => {
        const sp = span(c.at, c.dur);
        return (
          <Sequence key={`cmp${i}`} {...sp} premountFor={fps}>
            <Compare compare={c} dir={dir} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {(p.inserts ?? []).map((ins, i) => {
        const sp = span(ins.at, ins.dur);
        return (
          <Sequence key={`ins${i}`} {...sp} premountFor={fps}>
            <Insert insert={ins} dir={dir} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {p.debugFace && p.face && (
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              left: `${p.face.x * 100}%`,
              top: `${p.face.y * 100}%`,
              width: `${p.face.w * 100}%`,
              height: `${p.face.h * 100}%`,
              border: "6px solid #00E5FF",
              transform: `scale(${scale})`,
              transformOrigin: "center",
            }}
          />
        </AbsoluteFill>
      )}

      {look.lightLeak !== null && (
        <Solid width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }} effects={[lightLeak({ progress: look.lightLeak, seed: 3 })]} />
      )}

      {look.overlay && look.overlayOpacity > 0.01 && (
        <AbsoluteFill style={{ backgroundColor: look.overlay, opacity: look.overlayOpacity }} />
      )}

      {p.gradient !== false && (
        <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
      )}

      {cap.enabled !== false && captions.length > 0 && (
        <Captions
          captions={mapCaptions(segs, shiftCaptions(captions, cap.lead ?? 0.15))}
          highlight={cap.highlight ?? []}
          maxChars={cap.maxChars ?? 9}
          y={cap.y ?? 0.76}
          fontSize={cap.fontSize}
          hiddenUntilMs={hook && cap.hideDuringHook !== false ? (hookTo / fps) * 1000 : 0}
        />
      )}

      {(p.cards ?? []).map((c, i) => {
        const sp = span(c.at, c.dur);
        return (
          <Sequence key={`card${i}`} {...sp}>
            <Card card={c} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {(p.headlines ?? []).map((h, i) => {
        const sp = span(h.at, h.dur);
        return (
          <Sequence key={`hl${i}`} {...sp}>
            <Headlines headline={h} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {(p.orbits ?? []).map((o, i) => {
        const sp = span(o.at, o.dur);
        return (
          <Sequence key={`orb${i}`} {...sp} premountFor={fps}>
            <Orbit orbit={o} dir={dir} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {(p.phones ?? []).map((ph, i) => {
        const sp = span(ph.at, ph.dur);
        return (
          <Sequence key={`ph${i}`} {...sp} premountFor={fps}>
            <Phone phone={ph} dir={dir} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {(p.notes ?? []).map((n, i) => {
        const sp = span(n.at, n.dur);
        return (
          <Sequence key={`note${i}`} {...sp}>
            <Note note={n} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {(p.stickers ?? []).map((st, i) => {
        const sp = span(st.at, st.dur);
        return (
          <Sequence key={`st${i}`} {...sp}>
            <Sticker sticker={st} dir={dir} durationInFrames={sp.durationInFrames} />
          </Sequence>
        );
      })}

      {hook && hookTo > hookFrom && (
        <Sequence from={hookFrom} durationInFrames={hookTo - hookFrom}>
          <Hook hook={hook} durationInFrames={hookTo - hookFrom} />
        </Sequence>
      )}

      {p.music && <Audio src={staticFile(`${dir}/${p.music.src}`)} volume={p.music.volume ?? 0.12} loop />}
      {transitions
        .filter((tr) => tr.sound)
        .map((tr, i) => (
          <Sequence key={`trs${i}`} from={Math.max(0, Math.round((tr.t - 0.18) * fps))}>
            <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
          </Sequence>
        ))}
      {(p.stickers ?? [])
        .filter((st) => st.sound)
        .map((st, i) => (
          <Sequence key={`sts${i}`} from={span(st.at, st.dur).from}>
            <Audio src={staticFile("sfx/pop.wav")} volume={0.5} />
          </Sequence>
        ))}
      {(p.sfx ?? []).map((s, i) => (
        <Sequence key={i} from={Math.round(srcToOut(segs, s.at) * fps)}>
          <Audio src={staticFile(s.src.startsWith("sfx/") ? s.src : `${dir}/${s.src}`)} volume={s.volume ?? 0.6} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
