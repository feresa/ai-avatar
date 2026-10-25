// 逐字字幕：正在說的字放大變黃、重點詞一直是黃色
import type { Caption } from "@remotion/captions";
import React, { useMemo } from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { COLORS } from "../types";

type Token = { text: string; startMs: number; endMs: number };
type Page = { startMs: number; endMs: number; tokens: Token[] };

const PUNCT = /[，。、！？；：,.!?;:「」『』（）()…\s]+/g;
const BREAK = /[，。！？；,.!?;…]$/;

/** 把逐字的時間點分成一頁一頁（一行）：遇到標點、停頓或超過字數就換頁 */
export const buildPages = (caps: Caption[], maxChars: number): Page[] => {
  const pages: Page[] = [];
  let cur: Token[] = [];
  let len = 0;
  const flush = () => {
    if (cur.length) pages.push({ startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, tokens: cur });
    cur = [];
    len = 0;
  };
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i];
    const raw = c.text.trim();
    const text = raw.replace(PUNCT, "");
    const prev = cur[cur.length - 1];
    if (prev && (c.startMs - prev.endMs > 450 || len + text.length > maxChars)) flush();
    if (text) {
      cur.push({ text, startMs: c.startMs, endMs: c.endMs });
      len += text.length;
    }
    if (BREAK.test(raw) && len >= 3) flush();
  }
  flush();
  // 每頁停留到下一頁開始（最多多停 0.6 秒），字幕才不會一直閃
  return pages.map((p, i) => ({
    ...p,
    endMs: Math.min(pages[i + 1]?.startMs ?? p.endMs + 600, p.endMs + 600),
  }));
};

export const Captions: React.FC<{
  captions: Caption[];
  highlight: string[];
  maxChars: number;
  y: number;
  fontSize?: number;
  hiddenUntilMs: number;
}> = ({ captions, highlight, maxChars, y, fontSize, hiddenUntilMs }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const pages = useMemo(() => buildPages(captions, maxChars), [captions, maxChars]);
  const nowMs = (frame / fps) * 1000;
  if (nowMs < hiddenUntilMs) return null;
  const page = pages.find((p) => nowMs >= p.startMs && nowMs < p.endMs);
  if (!page) return null;

  const text = page.tokens.map((t) => t.text).join("");
  // 重點詞：標出每個字是不是在重點詞裡
  const marked = new Array(text.length).fill(false);
  for (const word of highlight) {
    if (!word) continue;
    for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + 1)) {
      for (let k = 0; k < word.length; k++) marked[i + k] = true;
    }
  }
  const size = fontSize ?? width * 0.085;
  const enter = spring({ frame: frame - Math.round((page.startMs / 1000) * fps), fps, config: { damping: 14, stiffness: 220 } });
  let pos = 0;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: y * height,
          width: "100%",
          transform: `translateY(-50%) scale(${0.85 + 0.15 * enter})`,
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          padding: `0 ${width * 0.06}px`,
          fontFamily,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.25,
        }}
      >
        {page.tokens.map((t, ti) => {
          const active = nowMs >= t.startMs && nowMs < t.endMs;
          const spoken = nowMs >= t.startMs;
          return [...t.text].map((ch, ci) => {
            const isMarked = marked[pos++];
            const color = isMarked || active ? COLORS.yellow : COLORS.white;
            return (
              <span
                key={`${ti}-${ci}`}
                style={{
                  color,
                  opacity: spoken ? 1 : 0.92,
                  WebkitTextStroke: `${size * 0.11}px ${COLORS.stroke}`,
                  paintOrder: "stroke fill",
                  textShadow: "0 5px 0 rgba(0,0,0,0.35)",
                  display: "inline-block",
                  transform: active ? "scale(1.1) translateY(-4%)" : undefined,
                }}
              >
                {ch}
              </span>
            );
          });
        })}
      </div>
    </AbsoluteFill>
  );
};
