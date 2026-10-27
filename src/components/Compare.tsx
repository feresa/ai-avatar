// 前後對比：分隔線從右邊滑進來，左邊是 before（圖片或影片）、右邊是現在的畫面（after）
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import type { Compare as CompareType } from "../types";

const isVideo = (src: string) => /\.(mp4|mov|webm|m4v)$/i.test(src);

const Pill: React.FC<{ text: string; side: "left" | "right"; dark?: boolean }> = ({ text, side, dark }) => {
  const { width, height } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: height * 0.24,
        [side]: width * 0.05,
        padding: `${width * 0.012}px ${width * 0.035}px`,
        borderRadius: width,
        background: dark ? "rgba(20,20,20,0.75)" : "rgba(255,255,255,0.92)",
        color: dark ? "white" : "#1B1B1B",
        fontFamily,
        fontWeight: 900,
        fontSize: width * 0.045,
        letterSpacing: "0.04em",
      }}
    >
      {text}
    </div>
  );
};

export const Compare: React.FC<{ compare: CompareType; dir: string; durationInFrames: number }> = ({
  compare,
  dir,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  // 分隔線：0.6 秒從右邊滑到中間，結束前 0.4 秒再滑回右邊
  const pos = interpolate(
    frame,
    [0, fps * 0.6, durationInFrames - fps * 0.4, durationInFrames],
    [1, 0.5, 0.5, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) },
  );
  const src = staticFile(compare.before.includes("/") ? compare.before : `${dir}/${compare.before}`);
  const labelsIn = interpolate(frame, [fps * 0.4, fps * 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }}>
        {isVideo(compare.before) ? (
          <Video src={src} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>
      {/* 分隔線和把手 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `calc(${pos * 100}% - ${width * 0.004}px)`,
          width: width * 0.008,
          background: "white",
          boxShadow: "0 0 18px rgba(0,0,0,0.35)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${pos * 100}%`,
          width: width * 0.1,
          height: width * 0.1,
          marginLeft: -width * 0.05,
          marginTop: -width * 0.05,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: width * 0.04,
          color: "#333",
          fontFamily,
          fontWeight: 900,
        }}
      >
        ◀▶
      </div>
      <div style={{ opacity: labelsIn }}>
        <Pill text={compare.beforeLabel ?? "BEFORE"} side="left" dark />
        <Pill text={compare.afterLabel ?? "AFTER"} side="right" />
      </div>
    </AbsoluteFill>
  );
};
