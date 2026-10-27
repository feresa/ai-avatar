// 一支短影片：影片（剪掉停頓、直式裁切、推近）＋ 插圖 ＋ 下半部加深 ＋ 逐字字幕 ＋ 字卡 ＋ 貼圖 ＋ 開場標題 ＋ 音樂音效
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Captions } from "./components/Captions";
import { Card } from "./components/Card";
import { Hook } from "./components/Hook";
import { Insert } from "./components/Insert";
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

export const Short: React.FC<ShortProps> = ({ name, project: p, captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const segs = segmentsOf(p);
  const t = frame / fps;
  const dir = `projects/${name}`;
  const zooms = (p.zooms ?? []).map((z) => ({
    start: srcToOut(segs, z.at),
    end: srcToOut(segs, z.at + z.dur),
    scale: z.scale,
  }));
  const scale = (p.baseZoom ?? 1) * zoomAt(t, zooms);
  const focus = `${(p.focusX ?? 0.5) * 100}% ${(p.focusY ?? 0.4) * 100}%`;
  // 推近的中心：有臉的位置就往臉放大
  const zoomOrigin = p.face ? `${(p.face.x + p.face.w / 2) * 100}% ${(p.face.y + p.face.h / 2) * 100}%` : focus;
  const hook = p.hook;
  const hookFrom = hook ? Math.round(srcToOut(segs, hook.from) * fps) : 0;
  const hookTo = hook ? Math.round(srcToOut(segs, hook.to) * fps) : 0;
  const cap = p.captions ?? {};
  const transitions = transitionsOf(p, segs);
  const look = transitionLook(t, transitions);
  // 故障閃爍：畫面左右抖動、色偏
  const jitter = look.glitch ? Math.sin(frame * 2.3) * look.glitch * 0.03 : 0;
  // 字卡、插圖、貼圖：原始影片的時間 → 成品的格數
  const span = (at: number, dur: number) => {
    const from = Math.round(srcToOut(segs, at) * fps);
    return { from, durationInFrames: Math.max(1, Math.round(srcToOut(segs, at + dur) * fps) - from) };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* 影片：每一段保留的內容接起來 */}
      <AbsoluteFill
        style={{
          transform: `translateX(${(look.x + jitter) * 100}%) scale(${scale * look.scale})`,
          transformOrigin: zoomOrigin,
          filter:
            [look.blur > 0.3 ? `blur(${look.blur.toFixed(1)}px)` : "", look.glitch ? `hue-rotate(${Math.round(look.glitch * 40 * Math.sin(frame * 1.7))}deg) saturate(${1 + look.glitch * 0.6}) contrast(${1 + look.glitch * 0.3})` : ""]
              .filter(Boolean)
              .join(" ") || undefined,
        }}
      >
        {segs.map((s, i) => (
          <Sequence
            key={i}
            from={Math.round(s.outStart * fps)}
            durationInFrames={Math.max(1, Math.round((s.srcEnd - s.srcStart) * fps))}
            premountFor={fps}
          >
            <OffthreadVideo
              src={staticFile(`${dir}/${p.video}`)}
              trimBefore={Math.round(s.srcStart * fps)}
              volume={p.videoVolume ?? 1}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus }}
            />
          </Sequence>
        ))}
      </AbsoluteFill>

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
