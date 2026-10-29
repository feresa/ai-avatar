// 教學版型：螢幕錄影（Screen）、AI 對話泡泡（Chat）、提示詞打字機（PromptBox）
// 畫面上方是內容（y 0.05 ~ 0.5），分身在 Short.tsx 縮成圓形小頭像，字幕照常在下面
import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import type { Chat as ChatType, Prompt as PromptType, Screen as ScreenType } from "../types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const isVideo = (src: string) => /\.(mp4|mov|webm|m4v)$/i.test(src);
const TOP = 0.05;
const BOTTOM = 0.5;

// 進場彈出、出場淡出
const useInOut = (durationInFrames: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });
  const out = interpolate(frame, [durationInFrames - fps * 0.3, durationInFrames], [1, 0], clamp);
  return { frame, fps, enter, out };
};

// 背景：深色漸層（蓋掉原本的畫面，分身改用小頭像）
export const TeachBackdrop: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 20%, #23324a 0%, #111827 55%, #0b0f17 100%)" }} />
);

export const Screen: React.FC<{ screen: ScreenType; dir: string; durationInFrames: number }> = ({ screen, dir, durationInFrames }) => {
  const { frame, fps, enter, out } = useInOut(durationInFrames);
  const { width, height } = useVideoConfig();
  const src = staticFile(screen.src.includes("/") ? screen.src : `${dir}/${screen.src}`);
  // 放大局部：前後 0.4 秒平滑推近、拉回
  const t = screen.at + frame / fps;
  let zoom = { s: 1, x: 0.5, y: 0.5 };
  for (const f of screen.focus ?? []) {
    const ramp = Math.min(0.4, f.dur / 3);
    const k = interpolate(t, [f.at, f.at + ramp, f.at + f.dur - ramp, f.at + f.dur], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    if (k > 0) zoom = { s: 1 + ((f.scale ?? 2) - 1) * k, x: f.x, y: f.y };
  }
  const boxTop = (screen.label ? TOP + 0.05 : TOP) * height;
  const boxH = BOTTOM * height - boxTop;
  const media = isVideo(screen.src) ? (
    <OffthreadVideo src={src} muted trimBefore={Math.round((screen.start ?? 0) * fps)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
  ) : (
    <Img src={src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
  );
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {screen.label && (
        <div
          style={{
            position: "absolute",
            top: TOP * height,
            width: "100%",
            textAlign: "center",
            fontFamily,
            fontWeight: 900,
            fontSize: width * 0.055,
            color: "#F7E27C",
            opacity: enter,
          }}
        >
          {screen.label}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: width * 0.04,
          width: width * 0.92,
          top: boxTop,
          height: boxH,
          overflow: "hidden",
          borderRadius: width * 0.025,
          transform: `scale(${0.9 + 0.1 * enter})`,
          opacity: Math.min(1, enter * 1.5),
        }}
      >
        <div style={{ width: "100%", height: "100%", transform: `scale(${zoom.s})`, transformOrigin: `${zoom.x * 100}% ${zoom.y * 100}%` }}>{media}</div>
      </div>
    </AbsoluteFill>
  );
};

// 一個字一個字打出來
const typed = (text: string, t: number, cps: number) => Array.from(text).slice(0, Math.max(0, Math.floor(t * cps))).join("");

export const Chat: React.FC<{ chat: ChatType; durationInFrames: number }> = ({ chat, durationInFrames }) => {
  const { frame, fps, enter, out } = useInOut(durationInFrames);
  const { width, height } = useVideoConfig();
  const t = chat.at + frame / fps;
  // 每句出現的時間：有填 at 用 at，沒填就接在上一句後面
  let next = chat.at + 0.4;
  const shown = chat.messages.map((m) => {
    const start = m.at ?? next;
    const typing = m.role === "ai" ? 0.7 : 0;
    const cps = m.role === "ai" ? 16 : 1000;
    next = start + typing + Array.from(m.text).length / Math.min(cps, 40) + 0.6;
    return { ...m, start, typing, cps };
  });
  const fs = width * 0.042;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          left: width * 0.05,
          width: width * 0.9,
          top: TOP * height,
          height: (BOTTOM - TOP) * height,
          background: "#ffffff",
          borderRadius: width * 0.035,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${(1 - enter) * height * 0.04}px)`,
          opacity: Math.min(1, enter * 1.5),
        }}
      >
        <div style={{ padding: `${width * 0.025}px ${width * 0.04}px`, borderBottom: "1px solid #e5e7eb", fontFamily, fontWeight: 900, fontSize: width * 0.04, color: "#111827", display: "flex", alignItems: "center", gap: width * 0.02 }}>
          <span style={{ width: width * 0.025, height: width * 0.025, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
          {chat.title ?? "AI 助理"}
        </div>
        {/* 新的訊息在下面，舊的往上推 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: width * 0.025, padding: width * 0.035, overflow: "hidden" }}>
          {shown
            .filter((m) => t >= m.start)
            .map((m, i) => {
              const isUser = m.role === "user";
              const since = t - m.start;
              const pop = spring({ frame: Math.round(since * fps), fps, config: { damping: 14, stiffness: 180 } });
              const text = since < m.typing ? null : typed(m.text, since - m.typing, m.cps);
              return (
                <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", transform: `scale(${0.85 + 0.15 * pop})`, transformOrigin: isUser ? "right bottom" : "left bottom" }}>
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: `${width * 0.022}px ${width * 0.032}px`,
                      borderRadius: width * 0.035,
                      background: isUser ? "#2563eb" : "#f3f4f6",
                      color: isUser ? "#ffffff" : "#111827",
                      fontFamily,
                      fontWeight: 700,
                      fontSize: fs,
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {text === null ? <Dots t={since} size={fs} /> : text}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Dots: React.FC<{ t: number; size: number }> = ({ t, size }) => (
  <span style={{ letterSpacing: size * 0.15 }}>
    {[0, 1, 2].map((i) => (
      <span key={i} style={{ opacity: 0.3 + 0.7 * Math.max(0, Math.sin(t * 8 - i * 0.9)) }}>●</span>
    ))}
  </span>
);

export const PromptBox: React.FC<{ prompt: PromptType; durationInFrames: number }> = ({ prompt, durationInFrames }) => {
  const { frame, fps, enter, out } = useInOut(durationInFrames);
  const { width, height } = useVideoConfig();
  const chars = Array.from(prompt.text).length;
  const typeSec = prompt.typeSec ?? Math.max(1, (durationInFrames / fps) * 0.6);
  const t = frame / fps - 0.4;
  const text = typed(prompt.text, t, chars / typeSec);
  const done = text.length >= prompt.text.length;
  const cursor = !done || Math.floor(frame / (fps * 0.5)) % 2 === 0;
  const copied = done && t > typeSec + 0.6;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          left: width * 0.05,
          width: width * 0.9,
          top: TOP * height,
          maxHeight: (BOTTOM - TOP) * height,
          background: "#0f172a",
          border: "2px solid #334155",
          borderRadius: width * 0.03,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
          transform: `translateY(${(1 - enter) * height * 0.04}px)`,
          opacity: Math.min(1, enter * 1.5),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: width * 0.015, padding: `${width * 0.022}px ${width * 0.035}px`, background: "#1e293b" }}>
          {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
            <span key={c} style={{ width: width * 0.022, height: width * 0.022, borderRadius: "50%", background: c, display: "inline-block" }} />
          ))}
          <span style={{ flex: 1, marginLeft: width * 0.02, fontFamily, fontWeight: 900, fontSize: width * 0.036, color: "#e2e8f0" }}>{prompt.title ?? "提示詞"}</span>
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: width * 0.032,
              padding: `${width * 0.008}px ${width * 0.025}px`,
              borderRadius: width * 0.02,
              background: copied ? "#22c55e" : "#334155",
              color: "#ffffff",
            }}
          >
            {copied ? "✓ 已複製" : "複製"}
          </span>
        </div>
        <div style={{ padding: width * 0.045, fontFamily, fontWeight: 700, fontSize: width * 0.043, lineHeight: 1.55, color: "#f8fafc", whiteSpace: "pre-wrap" }}>
          {text}
          <span style={{ opacity: cursor ? 1 : 0, color: "#F7E27C" }}>▍</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
