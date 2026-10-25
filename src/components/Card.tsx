// 重點字卡：大字彈出、小字滑上來，最後淡出
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { COLORS, colorOf, type Card as CardType } from "../types";

export const Card: React.FC<{ card: CardType; durationInFrames: number }> = ({ card, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 200 } });
  const sub = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  const out = interpolate(frame, [durationInFrames - fps * 0.2, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const len = [...card.text].length;
  const size = width * (len > 7 ? Math.max(0.085, 0.75 / len) : 0.12);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          top: (card.y ?? 0.42) * height,
          width: "100%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: width * 0.02,
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 1.15,
            color: colorOf(card.color ?? "yellow"),
            WebkitTextStroke: `${size * 0.12}px ${COLORS.stroke}`,
            paintOrder: "stroke fill",
            textShadow: "0 8px 0 rgba(0,0,0,0.35), 0 0 30px rgba(0,0,0,0.35)",
            transform: `scale(${0.4 + 0.6 * pop}) rotate(${(1 - pop) * -6}deg)`,
            whiteSpace: "nowrap",
          }}
        >
          {card.text}
        </div>
        {card.sub && (
          <div
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: width * 0.05,
              color: "#222",
              background: "rgba(255,255,255,0.9)",
              borderRadius: 999,
              padding: `${width * 0.012}px ${width * 0.04}px`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              transform: `translateY(${(1 - sub) * 50}px)`,
              opacity: sub,
            }}
          >
            {card.sub}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
