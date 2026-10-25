// 貼圖小動畫：內建打勾、叉叉、箭頭、愛心、星星、火焰，也可以用 emoji 或圖片
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Sticker as StickerType } from "../types";

const SHAPES: Record<NonNullable<StickerType["kind"]>, React.ReactNode> = {
  check: (
    <>
      <circle cx="50" cy="50" r="46" fill="#2FB86E" stroke="white" strokeWidth="6" />
      <path d="M28 52 L44 67 L73 35" fill="none" stroke="white" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cross: (
    <>
      <circle cx="50" cy="50" r="46" fill="#E5484D" stroke="white" strokeWidth="6" />
      <path d="M33 33 L67 67 M67 33 L33 67" stroke="white" strokeWidth="11" strokeLinecap="round" />
    </>
  ),
  arrow: (
    <path
      d="M8 42 H62 V22 L94 50 L62 78 V58 H8 Z"
      fill="#F7E27C"
      stroke="#1B1B1B"
      strokeWidth="6"
      strokeLinejoin="round"
    />
  ),
  heart: (
    <path
      d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z"
      fill="#FF4D6D"
      stroke="white"
      strokeWidth="6"
    />
  ),
  star: (
    <path
      d="M50 6 L62 37 L95 38 L69 58 L78 91 L50 72 L22 91 L31 58 L5 38 L38 37 Z"
      fill="#FFD43B"
      stroke="#1B1B1B"
      strokeWidth="5"
      strokeLinejoin="round"
    />
  ),
  fire: (
    <>
      <path d="M50 95 C25 95 12 78 14 58 C16 40 30 32 34 14 C46 24 50 34 49 44 C56 38 60 30 60 22 C78 36 88 52 86 66 C84 84 70 95 50 95 Z" fill="#FF6B1A" stroke="#1B1B1B" strokeWidth="5" />
      <path d="M50 92 C38 92 31 84 32 74 C33 64 41 60 44 50 C51 56 54 63 53 70 C58 67 61 62 61 57 C68 64 70 72 69 78 C67 87 60 92 50 92 Z" fill="#FFD43B" />
    </>
  ),
};

export const Sticker: React.FC<{ sticker: StickerType; dir: string; durationInFrames: number }> = ({
  sticker,
  dir,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const size = (sticker.size ?? 0.2) * width;
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 220 } });
  const out = interpolate(frame, [durationInFrames - fps * 0.2, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const anim = sticker.anim ?? "pop";
  const t = frame / fps;
  const wobble =
    anim === "bounce" ? Math.abs(Math.sin(t * 6)) * -size * 0.12 : anim === "float" ? Math.sin(t * 2.5) * size * 0.06 : 0;
  const tilt = anim === "pop" ? Math.sin(t * 5) * 4 : 0;

  let content: React.ReactNode;
  if (sticker.src) {
    content = (
      <Img
        src={staticFile(sticker.src.includes("/") ? sticker.src : `${dir}/${sticker.src}`)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  } else if (sticker.emoji) {
    content = <div style={{ fontSize: size * 0.85, lineHeight: 1, textAlign: "center" }}>{sticker.emoji}</div>;
  } else {
    content = (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {SHAPES[sticker.kind ?? "check"]}
      </svg>
    );
  }

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          left: (sticker.x ?? 0.78) * width - size / 2,
          top: (sticker.y ?? 0.3) * height - size / 2,
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.35))",
          transform: `translateY(${wobble}px) scale(${pop}) rotate(${(sticker.rotate ?? 0) + tilt}deg)`,
        }}
      >
        {content}
      </div>
    </AbsoluteFill>
  );
};
