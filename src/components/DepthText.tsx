// 景深大字：超大的字放在人的後面（人像層會疊在上面，看起來字在人背後）
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { colorOf, type DepthText as DepthTextType, type Project } from "../types";

export const DepthText: React.FC<{ depth: DepthTextType; face?: Project["face"]; durationInFrames: number }> = ({
  depth,
  face,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const len = Math.max(1, Array.from(depth.text).length);
  const isLatin = /^[\x00-\x7F]+$/.test(depth.text);
  // 字的大小：塞滿畫面寬度（中文一個字約 1 個字寬，英文約 0.6）
  const size = (depth.size ?? Math.min(0.46, 0.94 / (len * (isLatin ? 0.62 : 1.0)))) * width;
  // 預設放在頭的高度：字的下半部被頭擋住，最有景深感
  const y = depth.y ?? (face ? face.y + face.h * 0.15 : 0.2);
  const enter = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [durationInFrames - fps * 0.3, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: enter * out }}>
      <div
        style={{
          position: "absolute",
          top: y * height,
          width: "100%",
          textAlign: "center",
          transform: `translateY(-50%) translateY(${(1 - enter) * height * 0.04}px) scale(${1.12 - 0.12 * enter})`,
          fontFamily,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1,
          letterSpacing: isLatin ? "-0.02em" : "0.02em",
          color: colorOf(depth.color ?? "white"),
          textShadow: "0 10px 40px rgba(0,0,0,0.25)",
          whiteSpace: "nowrap",
        }}
      >
        {depth.text}
      </div>
    </AbsoluteFill>
  );
};
