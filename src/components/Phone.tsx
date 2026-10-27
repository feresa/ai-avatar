// 手機示範：跳出一支手機，螢幕裡放圖片或影片（App 畫面、截圖、示範影片）
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Phone as PhoneType } from "../types";

const isVideo = (src: string) => /\.(mp4|mov|webm|m4v)$/i.test(src);

export const Phone: React.FC<{ phone: PhoneType; dir: string; durationInFrames: number }> = ({ phone, dir, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const w = (phone.size ?? 0.34) * width;
  const h = w * 2.05;
  const bezel = w * 0.04;
  const radius = w * 0.16;
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });
  const out = interpolate(frame, [durationInFrames - fps * 0.3, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tilt = phone.tilt ?? -8;
  // 輕輕晃動，看起來像拿在手上
  const sway = Math.sin((frame / fps) * 1.6) * 2;
  const src = staticFile(phone.src.includes("/") ? phone.src : `${dir}/${phone.src}`);

  return (
    <AbsoluteFill style={{ perspective: width * 2, opacity: out }}>
      <div
        style={{
          position: "absolute",
          left: (phone.x ?? 0.78) * width - w / 2,
          top: (phone.y ?? 0.45) * height - h / 2,
          width: w,
          height: h,
          borderRadius: radius,
          background: "linear-gradient(145deg, #3a3a3e, #121214)",
          padding: bezel,
          boxShadow: "0 30px 60px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.12)",
          transform: `translateY(${(1 - enter) * height * 0.5}px) rotateY(${tilt + sway}deg) rotateZ(${tilt * 0.35}deg)`,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: radius - bezel, overflow: "hidden", background: "black" }}>
          {isVideo(phone.src) ? (
            <Video src={src} muted trimBefore={Math.round((phone.start ?? 0) * fps)} objectFit="cover" style={{ width: "100%", height: "100%" }} />
          ) : (
            <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          {/* 動態島 */}
          <div
            style={{
              position: "absolute",
              top: w * 0.035,
              left: "50%",
              width: w * 0.3,
              height: w * 0.085,
              marginLeft: -w * 0.15,
              borderRadius: w,
              background: "black",
            }}
          />
          {/* 玻璃反光 */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 35%)" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
