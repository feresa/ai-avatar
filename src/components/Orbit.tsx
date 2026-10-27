// 卡片環繞：一圈卡片在頭上慢慢繞，轉到後面的卡片變小、變暗
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import type { Orbit as OrbitType } from "../types";

const isImage = (s: string) => /\.(jpe?g|png|webp|gif)$/i.test(s);

export const Orbit: React.FC<{ orbit: OrbitType; dir: string; durationInFrames: number }> = ({ orbit, dir, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const n = Math.max(1, orbit.items.length);
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const out = interpolate(frame, [durationInFrames - fps * 0.3, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spin = (frame / durationInFrames) * (orbit.turns ?? 0.5) * Math.PI * 2;
  const cx = width / 2;
  const cy = (orbit.y ?? 0.12) * height;
  const rx = width * 0.4 * enter;
  const ry = height * 0.035 * enter;
  const cw = width * 0.2;
  const chh = cw * 1.35;

  const cards = orbit.items.map((item, i) => {
    const a = (i / n) * Math.PI * 2 + spin;
    const z = Math.cos(a); // 1 = 最前面，-1 = 最後面
    return { item, i, x: cx + rx * Math.sin(a), y: cy + ry * z, z, rot: Math.sin(a) * -28 };
  });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      {cards
        .sort((a, b) => a.z - b.z)
        .map(({ item, i, x, y, z, rot }) => {
          const s = 0.7 + 0.3 * ((z + 1) / 2);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x - cw / 2,
                top: y - chh / 2,
                width: cw,
                height: chh,
                borderRadius: cw * 0.1,
                overflow: "hidden",
                background: "white",
                border: `${cw * 0.03}px solid white`,
                boxShadow: "0 12px 28px rgba(0,0,0,0.3)",
                transform: `perspective(${width}px) rotateY(${rot}deg) scale(${s})`,
                filter: `brightness(${0.55 + 0.45 * ((z + 1) / 2)})`,
              }}
            >
              {isImage(item) ? (
                <Img
                  src={staticFile(item.includes("/") ? item : `${dir}/${item}`)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: cw * 0.07 }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: cw * 0.08,
                    boxSizing: "border-box",
                    fontFamily,
                    fontWeight: 900,
                    fontSize: cw * (Array.from(item).length <= 4 ? 0.2 : 0.14),
                    color: "#1B1B1B",
                    background: "linear-gradient(160deg, #FFF8E1, #F7E27C)",
                    borderRadius: cw * 0.07,
                  }}
                >
                  {item}
                </div>
              )}
            </div>
          );
        })}
    </AbsoluteFill>
  );
};
