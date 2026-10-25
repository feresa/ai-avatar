// 插圖 / 插入影片（B-roll）：蓋滿畫面、上方小視窗、或上半部
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import type { Insert as InsertType } from "../types";

const isVideo = (src: string) => /\.(mp4|mov|webm|m4v)$/i.test(src);

export const Insert: React.FC<{ insert: InsertType; dir: string; durationInFrames: number }> = ({
  insert,
  dir,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const mode = insert.mode ?? "full";
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  const out = interpolate(frame, [durationInFrames - fps * 0.25, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // 圖片慢慢推近，看起來像在動
  const ken = insert.kenBurns === false ? 1 : interpolate(frame, [0, durationInFrames], [1.0, 1.12]);
  const src = staticFile(insert.src.includes("/") ? insert.src : `${dir}/${insert.src}`);
  const media = isVideo(insert.src) ? (
    <OffthreadVideo
      src={src}
      muted
      trimBefore={Math.round((insert.start ?? 0) * fps)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  ) : (
    <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${ken})` }} />
  );

  const box: React.CSSProperties =
    mode === "full"
      ? { inset: 0 }
      : mode === "top"
        ? { left: 0, right: 0, top: 0, height: height * 0.5 }
        : {
            left: width * 0.08,
            right: width * 0.08,
            top: height * 0.1,
            height: (width * 0.84 * 9) / 16,
            borderRadius: width * 0.04,
            border: `${width * 0.008}px solid white`,
            boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
          };
  const motion =
    mode === "full"
      ? { opacity: Math.min(enter * 1.4, 1) * out }
      : { opacity: out, transform: `translateY(${(1 - enter) * -height * 0.08}px) scale(${0.85 + 0.15 * enter})` };

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", overflow: "hidden", backgroundColor: "black", ...box, ...motion }}>
        {media}
        {insert.label && (
          <div
            style={{
              position: "absolute",
              left: width * 0.04,
              bottom: width * 0.04,
              fontFamily,
              fontWeight: 900,
              fontSize: width * 0.042,
              color: "white",
              background: "rgba(0,0,0,0.55)",
              borderRadius: width * 0.02,
              padding: `${width * 0.01}px ${width * 0.025}px`,
            }}
          >
            {insert.label}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
