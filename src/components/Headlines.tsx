// 頭條牆：剪報一張一張「啪」地貼上來（紙質紋理、撕紙邊用官方特效庫的 paper()、roughenEdges()）
import { dropShadow } from "@remotion/effects/drop-shadow";
import { paper } from "@remotion/effects/paper";
import { roughenEdges } from "@remotion/effects/roughen-edges";
import React from "react";
import { AbsoluteFill, Solid, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import type { Headline } from "../types";

// 剪報的位置（畫面比例）和角度：臉通常在畫面上方 15%~42%，剪報貼在臉的上面和下面、字幕的上面
const SLOTS = [
  { x: 0.04, y: 0.03, r: -5 },
  { x: 0.55, y: 0.05, r: 4 },
  { x: 0.03, y: 0.44, r: 3 },
  { x: 0.56, y: 0.46, r: -4 },
  { x: 0.29, y: 0.56, r: -2 },
  { x: 0.3, y: 0.0, r: 2 },
];

export const Headlines: React.FC<{ headline: Headline; durationInFrames: number }> = ({ headline, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - fps * 0.3, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cw = Math.round(width * 0.4);
  const ch = Math.round(width * 0.27);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      {headline.items.slice(0, SLOTS.length).map((item, i) => {
        const slot = SLOTS[i];
        // 一張隔 0.35 秒
        const f = frame - Math.round(i * fps * 0.35);
        if (f < 0) return null;
        const slam = spring({ frame: f, fps, config: { damping: 11, stiffness: 260 } });
        const len = Array.from(item.text).length;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: slot.x * width,
              top: slot.y * height,
              width: cw,
              height: ch,
              transform: `rotate(${slot.r}deg) scale(${1.35 - 0.35 * slam})`,
              opacity: Math.min(1, slam * 1.5),
            }}
          >
            <Solid
              width={cw}
              height={ch}
              color="#F4EFE4"
              style={{ position: "absolute", inset: 0 }}
              effects={[
                paper({ colorFront: "#F6F1E6", colorBack: "#E9E1D0", amount: 0.6, fiber: 0.5, seed: i + 1 }),
                roughenEdges({}),
                dropShadow({ radius: 14, offsetX: 4, offsetY: 10, opacity: 0.4 }),
              ]}
            />
            <div style={{ position: "absolute", inset: cw * 0.06, display: "flex", flexDirection: "column", gap: cw * 0.025 }}>
              <div style={{ display: "flex", alignItems: "center", gap: cw * 0.03 }}>
                <span
                  style={{
                    background: "#C8102E",
                    color: "white",
                    fontFamily,
                    fontWeight: 900,
                    fontSize: cw * 0.06,
                    padding: `${cw * 0.006}px ${cw * 0.02}px`,
                  }}
                >
                  {item.tag ?? "頭條"}
                </span>
                {item.date && <span style={{ fontFamily, fontSize: cw * 0.05, color: "#6B6252" }}>{item.date}</span>}
              </div>
              <div
                style={{
                  fontFamily,
                  fontWeight: 900,
                  color: "#1E1A14",
                  fontSize: cw * (len <= 6 ? 0.14 : len <= 10 ? 0.11 : 0.09),
                  lineHeight: 1.25,
                }}
              >
                {item.text}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
