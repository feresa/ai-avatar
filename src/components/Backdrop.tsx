// 背景：顏色、圖片（慢慢推近）或影片，綠幕去背、換背景、破框、剪貼都會用到
import { paper } from "@remotion/effects/paper";
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Img, Solid, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const isVideo = (s: string) => /\.(mp4|mov|webm|m4v)$/i.test(s);
const isImage = (s: string) => /\.(jpe?g|png|webp|gif|avif)$/i.test(s);

export const Backdrop: React.FC<{ src?: string; dir: string; paper?: boolean }> = ({ src, dir, paper: usePaper }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  if (src && (isVideo(src) || isImage(src))) {
    const url = staticFile(src.includes("/") ? src : `${dir}/${src}`);
    // 圖片慢慢推近，看起來不會死板
    const ken = interpolate(frame, [0, durationInFrames], [1.0, 1.1]);
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {isVideo(src) ? (
          <Video src={url} muted loop objectFit="cover" style={{ width: "100%", height: "100%" }} />
        ) : (
          <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${ken})` }} />
        )}
      </AbsoluteFill>
    );
  }
  // 顏色（沒指定就用柔和的米色漸層）
  const color = src ?? "#E9E2D4";
  if (usePaper)
    return (
      <AbsoluteFill>
        <Solid width={width} height={height} color={color} effects={[paper({ colorFront: color, colorBack: color, amount: 0.6, crumples: 0.35, folds: 0.25, seed: 7 })]} />
      </AbsoluteFill>
    );
  return <AbsoluteFill style={{ background: src ? color : "radial-gradient(circle at 50% 35%, #F7F1E6 0%, #E4D9C4 70%, #D6C8AE 100%)" }} />;
};
