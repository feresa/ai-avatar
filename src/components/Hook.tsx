// 開場：上方一排圖示（可打紅色斜線）＋ 兩行大標題 ＋ 小膠囊
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { COLORS, colorOf, type Hook as HookType } from "../types";

const textShadow = "0 6px 0 rgba(0,0,0,0.35), 0 0 24px rgba(0,0,0,0.35)";

const Icon: React.FC<{ icon: NonNullable<HookType["icons"]>[number]; size: number }> = ({ icon, size }) => {
  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size * 0.22,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  };
  if (icon.src) {
    return <Img src={staticFile(icon.src)} style={{ ...box, objectFit: "cover" }} />;
  }
  return (
    <div
      style={{
        ...box,
        background: icon.bg ?? "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        fontWeight: 900,
        fontSize: size * (icon.label && icon.label.length > 2 ? 0.26 : 0.4),
        color: icon.bg ? "#FFFFFF" : "#111111",
        textAlign: "center",
        lineHeight: 1.1,
        padding: size * 0.08,
      }}
    >
      {icon.label}
    </div>
  );
};

export const Hook: React.FC<{ hook: HookType; durationInFrames: number }> = ({ hook, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const pop = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 180 } });
  // 最後 0.25 秒淡出
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.25, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const icons = hook.icons ?? [];
  const iconSize = width * 0.135;
  const iconsDone = 4 + icons.length * 4;
  const strike = interpolate(frame, [iconsDone, iconsDone + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = (hook.y ?? 0.66) * height;
  const fontSize = width * 0.15;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {icons.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: height * 0.135,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            gap: width * 0.05,
          }}
        >
          {icons.map((icon, i) => {
            const s = pop(4 + i * 4);
            return (
              <div key={i} style={{ position: "relative", transform: `scale(${s})` }}>
                <Icon icon={icon} size={iconSize} />
                {hook.strike !== false && (
                  <div
                    style={{
                      // 從左下角往右上角畫過去
                      position: "absolute",
                      left: "-4%",
                      bottom: "-4%",
                      width: `${150 * strike}%`,
                      height: iconSize * 0.075,
                      marginBottom: -iconSize * 0.0375,
                      background: COLORS.red,
                      borderRadius: 99,
                      transform: "rotate(-45deg)",
                      transformOrigin: "0% 50%",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: titleY,
          width: "100%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {hook.lines.map((line, i) => {
          const s = pop(i * 5);
          return (
            <div
              key={i}
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: line.text.length > 6 ? fontSize * Math.min(1, 6.2 / line.text.length) : fontSize,
                lineHeight: 1.12,
                color: colorOf(line.color ?? (i === 0 ? "white" : "yellow")),
                textShadow,
                letterSpacing: "0.02em",
                transform: `scale(${0.6 + 0.4 * s}) translateY(${(1 - s) * 40}px)`,
                opacity: Math.min(1, s * 1.5),
                whiteSpace: "nowrap",
              }}
            >
              {line.text}
            </div>
          );
        })}
        {hook.badge && (
          <div
            style={{
              marginTop: height * 0.025,
              display: "flex",
              alignItems: "center",
              gap: width * 0.022,
              padding: `${width * 0.016}px ${width * 0.05}px ${width * 0.016}px ${width * 0.018}px`,
              borderRadius: 999,
              background: "rgba(255,255,255,0.72)",
              border: "3px solid rgba(255,255,255,0.9)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              transform: `translateY(${(1 - pop(hook.lines.length * 5 + 2)) * 60}px)`,
              opacity: pop(hook.lines.length * 5 + 2),
            }}
          >
            <div
              style={{
                width: width * 0.065,
                height: width * 0.065,
                borderRadius: 999,
                background: "#D97757",
                color: "#FFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: width * 0.044,
              }}
            >
              ✳
            </div>
            <div style={{ fontFamily, fontWeight: 900, fontSize: width * 0.047, color: "#3A3A3A" }}>{hook.badge}</div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
