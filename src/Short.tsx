// 一支短影片：影片（剪掉停頓、直式裁切、推近）＋ 下半部加深 ＋ 開場標題 ＋ 逐字字幕 ＋ 音樂音效
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Captions } from "./components/Captions";
import { Hook } from "./components/Hook";
import { mapCaptions, segmentsOf, srcToOut } from "./timeline";
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
  const hook = p.hook;
  const hookFrom = hook ? Math.round(srcToOut(segs, hook.from) * fps) : 0;
  const hookTo = hook ? Math.round(srcToOut(segs, hook.to) * fps) : 0;
  const cap = p.captions ?? {};

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* 影片：每一段保留的內容接起來 */}
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: focus }}>
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

      {p.gradient !== false && (
        <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
      )}

      {cap.enabled !== false && captions.length > 0 && (
        <Captions
          captions={mapCaptions(segs, captions)}
          highlight={cap.highlight ?? []}
          maxChars={cap.maxChars ?? 9}
          y={cap.y ?? 0.76}
          fontSize={cap.fontSize}
          hiddenUntilMs={hook && cap.hideDuringHook !== false ? (hookTo / fps) * 1000 : 0}
        />
      )}

      {hook && hookTo > hookFrom && (
        <Sequence from={hookFrom} durationInFrames={hookTo - hookFrom}>
          <Hook hook={hook} durationInFrames={hookTo - hookFrom} />
        </Sequence>
      )}

      {p.music && <Audio src={staticFile(`${dir}/${p.music.src}`)} volume={p.music.volume ?? 0.12} loop />}
      {(p.sfx ?? []).map((s, i) => (
        <Sequence key={i} from={Math.round(srcToOut(segs, s.at) * fps)}>
          <Audio src={staticFile(`${dir}/${s.src}`)} volume={s.volume ?? 0.6} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
