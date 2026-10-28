// 雜誌封面：MagazineBack 放在人的後面（大標題），MagazineFront 放在人的前面（封面小標、條碼）
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { colorOf, type Magazine, type Project } from "../types";

const useIn = (durationInFrames: number, delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame - delay, [0, fps * 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [durationInFrames - fps * 0.3, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { enter, out };
};

export const MagazineBack: React.FC<{ magazine: Magazine; face?: Project["face"]; durationInFrames: number }> = ({ magazine, face, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { enter, out } = useIn(durationInFrames);
  const len = Math.max(1, Array.from(magazine.title).length);
  const isLatin = /^[\x00-\x7F]+$/.test(magazine.title);
  const size = Math.min(0.42, 0.92 / (len * (isLatin ? 0.6 : 1))) * width;
  // 大標題的底部壓在頭頂附近，頭會擋住一部分字
  const top = face ? Math.max(0.03, face.y - (size / height) * 0.55) : 0.05;
  const color = colorOf(magazine.color ?? "white");
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {magazine.issue && (
        <div
          style={{
            position: "absolute",
            top: Math.max(0.012, top - 0.025) * height,
            width: "100%",
            textAlign: "center",
            fontFamily,
            fontWeight: 900,
            fontSize: width * 0.03,
            letterSpacing: "0.35em",
            color,
            opacity: enter,
          }}
        >
          {magazine.issue}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: top * height,
          width: "100%",
          textAlign: "center",
          fontFamily,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1,
          color,
          textShadow: "0 8px 30px rgba(0,0,0,0.25)",
          transform: `scale(${1.08 - 0.08 * enter})`,
          opacity: enter,
          whiteSpace: "nowrap",
        }}
      >
        {magazine.title}
      </div>
    </AbsoluteFill>
  );
};

const CoverLine: React.FC<{ text: string; i: number; color: string; durationInFrames: number }> = ({ text, i, color, durationInFrames }) => {
  const { width, height, fps } = useVideoConfig();
  const { enter } = useIn(durationInFrames, Math.round(fps * (0.35 + i * 0.2)));
  const left = i === 0;
  return (
    <div
      style={{
        position: "absolute",
        top: (left ? 0.5 : 0.56 + (i - 1) * 0.065) * height,
        [left ? "left" : "right"]: width * 0.06,
        maxWidth: width * 0.42,
        textAlign: left ? "left" : "right",
        fontFamily,
        fontWeight: 900,
        fontSize: width * (left ? 0.068 : 0.052),
        lineHeight: 1.15,
        color: left ? colorOf("yellow") : color,
        textShadow: "0 3px 12px rgba(0,0,0,0.45)",
        opacity: enter,
        transform: `translateX(${(1 - enter) * (left ? -1 : 1) * width * 0.05}px)`,
      }}
    >
      {text}
    </div>
  );
};

export const MagazineFront: React.FC<{ magazine: Magazine; durationInFrames: number }> = ({ magazine, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const { out } = useIn(durationInFrames);
  const color = colorOf(magazine.color ?? "white");
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {(magazine.lines ?? []).slice(0, 4).map((text, i) => (
        <CoverLine key={i} text={text} i={i} color={color} durationInFrames={durationInFrames} />
      ))}
      {/* 條碼：放左下（右邊是封面小標） */}
      <div
        style={{
          position: "absolute",
          left: width * 0.06,
          top: 0.6 * height,
          width: width * 0.16,
          height: width * 0.07,
          background: "white",
          padding: width * 0.008,
          display: "flex",
          gap: 2,
          alignItems: "stretch",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        }}
      >
        {[2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2].map((wd, k) => (
          <div key={k} style={{ width: wd * 1.6, background: k % 2 ? "transparent" : "#111" }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
