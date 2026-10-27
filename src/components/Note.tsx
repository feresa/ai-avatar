// 便利貼字：一張便利貼貼上來（紙質紋理用官方特效庫的 paper()）
import { dropShadow } from "@remotion/effects/drop-shadow";
import { paper } from "@remotion/effects/paper";
import React from "react";
import { AbsoluteFill, Solid, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import type { Note as NoteType } from "../types";

const PALETTE = {
  yellow: { paper: "#FFE878", ink: "#3A2E00" },
  pink: { paper: "#FFB8C8", ink: "#4A1020" },
  blue: { paper: "#B8E2FF", ink: "#0D2B45" },
  green: { paper: "#C6F0B4", ink: "#173A10" },
};

export const Note: React.FC<{ note: NoteType; durationInFrames: number }> = ({ note, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const c = PALETTE[note.color ?? "yellow"];
  const size = Math.round((note.size ?? 0.36) * width);
  // 貼上來：從上方落下、稍微壓扁再彈回
  const drop = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  const out = interpolate(frame, [durationInFrames - fps * 0.25, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotate = (note.rotate ?? 4) + (1 - drop) * 12;
  const len = Array.from(note.text).length;
  const fontSize = size * (len <= 4 ? 0.2 : len <= 8 ? 0.15 : 0.12);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          left: (note.x ?? 0.74) * width - size / 2,
          top: (note.y ?? 0.52) * height - size / 2,
          width: size,
          height: size,
          transform: `translateY(${(1 - drop) * -height * 0.08}px) rotate(${rotate}deg) scale(${0.9 + 0.1 * drop})`,
        }}
      >
        <Solid
          width={size}
          height={size}
          color={c.paper}
          style={{ position: "absolute", inset: 0 }}
          effects={[
            paper({ colorFront: c.paper, colorBack: c.paper, amount: 0.5, crumples: 0.2, folds: 0.15, seed: len }),
            dropShadow({ radius: 18, offsetX: 6, offsetY: 14, opacity: 0.35 }),
          ]}
        />
        {/* 膠帶 */}
        <div
          style={{
            position: "absolute",
            left: size * 0.32,
            top: -size * 0.06,
            width: size * 0.36,
            height: size * 0.12,
            background: "rgba(255,255,255,0.55)",
            transform: "rotate(-3deg)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: size * 0.1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily,
            fontWeight: 900,
            fontSize,
            lineHeight: 1.3,
            color: c.ink,
            whiteSpace: "pre-wrap",
          }}
        >
          {note.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
