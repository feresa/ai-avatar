// 呼吸引導圈：吸氣時圓變大、吐氣時縮小，中間寫「吸氣／吐氣」和倒數秒數，觀眾可以跟著練
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { colorOf, type Breath } from "../types";

const MIN = 0.42; // 吐完氣時的大小（最大直徑的比例）
const ease = Easing.inOut(Easing.sin);

// 現在在第幾個階段、這個階段走了多少、圓的大小
const phaseAt = (pattern: [string, number][], t: number) => {
  const cycle = pattern.reduce((s, [, d]) => s + d, 0);
  let local = t % cycle;
  // 每個階段開始時的大小：從吐完氣的小圓開始
  let size = MIN;
  for (const [label, d] of pattern) {
    const grow = /吸/.test(label);
    const shrink = /[吐呼]/.test(label);
    const end = grow ? 1 : shrink ? MIN : size;
    if (local < d) {
      const q = ease(local / d);
      return { label, left: d - local, size: size + (end - size) * q };
    }
    local -= d;
    size = end;
  }
  return { label: pattern[0][0], left: pattern[0][1], size };
};

export const BreathGuide: React.FC<{ breath: Breath; durationInFrames: number }> = ({ breath, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const pattern = breath.pattern?.length ? breath.pattern : ([["吸氣", 4], ["吐氣", 4]] as [string, number][]);
  const { label, left, size } = phaseAt(pattern, frame / fps);
  const opacity = interpolate(frame, [0, fps * 0.4, durationInFrames - fps * 0.4, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const D = (breath.size ?? 0.3) * width;
  const cx = (breath.x ?? 0.5) * width;
  const cy = (breath.y ?? 0.64) * height;
  const color = colorOf(breath.color ?? "#8FE3CF");
  const d = D * size;

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* 外圈：吸滿的大小 */}
      <div
        style={{
          position: "absolute",
          left: cx - D / 2,
          top: cy - D / 2,
          width: D,
          height: D,
          borderRadius: "50%",
          border: `${width * 0.007}px solid ${color}`,
          opacity: 0.8,
          boxShadow: "0 0 18px rgba(0,0,0,0.25)",
        }}
      />
      {/* 呼吸的圓 */}
      <div
        style={{
          position: "absolute",
          left: cx - d / 2,
          top: cy - d / 2,
          width: d,
          height: d,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 40%, ${color}, ${color}DD 70%, ${color}AA)`,
          boxShadow: `0 0 ${width * 0.06}px ${color}99`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: cx - D / 2,
          top: cy - D / 2,
          width: D,
          height: D,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          fontWeight: 900,
          color: "#ffffff",
          textShadow: "0 3px 10px rgba(0,0,0,0.55)",
          lineHeight: 1.1,
        }}
      >
        <div style={{ fontSize: width * 0.08 }}>{label}</div>
        <div style={{ fontSize: width * 0.06 }}>{Math.max(1, Math.ceil(left - 0.05))}</div>
      </div>
    </AbsoluteFill>
  );
};
