// npm run green -- <專案名> [off]
// 綠幕去背：自動偵測綠布的顏色，寫進 project.json 的 greenScreen（用官方 colorKey 去背）
// 加 off 就關掉綠幕去背
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { die, ensureSourceSize, projectDir, remotionTool, writeProject } from "./lib";

const [name, flag] = process.argv.slice(2);
if (!name) die("用法：npm run green -- 專案名 [off]");
const p = ensureSourceSize(name);
if (flag === "off") {
  writeProject(name, { ...p, greenScreen: null });
  console.log("✅ 已關掉綠幕去背");
  process.exit(0);
}

// 取 5 個時間點，每張只看左右兩邊（人通常在中間），縮成 16×16 的小圖讀顏色
const src = path.join(projectDir(name), p.video);
const tmp = path.join(os.tmpdir(), `green-${process.pid}.rgb`);
const samples: [number, number, number][] = [];
for (const k of [0.1, 0.3, 0.5, 0.7, 0.9]) {
  for (const side of ["0", "iw*0.88"]) {
    const r = remotionTool("ffmpeg", [
      "-v", "error", "-y", "-ss", String(p.durationSec * k), "-i", src, "-frames:v", "1",
      "-vf", `crop=iw*0.12:ih*0.6:${side}:ih*0.1,scale=16:16`,
      "-f", "image2", "-c:v", "rawvideo", "-pix_fmt", "rgb24", tmp,
    ]);
    if (r.status !== 0 || !fs.existsSync(tmp)) continue;
    const buf = fs.readFileSync(tmp);
    for (let i = 0; i + 2 < buf.length; i += 3) samples.push([buf[i], buf[i + 1], buf[i + 2]]);
  }
}
fs.rmSync(tmp, { force: true });
if (!samples.length) die("讀不到影片畫面");

// 只留「明顯偏綠」的點，取中位數當綠幕顏色
const greens = samples.filter(([r, g, b]) => g > 60 && g > r * 1.25 && g > b * 1.15);
const ratio = greens.length / samples.length;
if (ratio < 0.4) die(`畫面兩側看起來不是綠幕（只有 ${Math.round(ratio * 100)}% 是綠色）。確定是在綠布前拍的嗎？`);
const med = (i: number) => [...greens.map((c) => c[i])].sort((a, b) => a - b)[Math.floor(greens.length / 2)];
const hex = "#" + [med(0), med(1), med(2)].map((v) => v.toString(16).padStart(2, "0")).join("");

writeProject(name, { ...p, greenScreen: { ...(p.greenScreen ?? {}), color: hex } });
console.log(`✅ 綠幕顏色 ${hex}（兩側 ${Math.round(ratio * 100)}% 是綠色），已開啟綠幕去背`);
console.log("   去不乾淨：把 project.json 的 greenScreen.similarity 調大（預設 0.2，最多約 0.4）");
console.log("   人的邊緣被吃掉：調小 similarity；頭髮邊有綠光：把 spill 調大（預設 0.35）");
if (!p.background) console.log('   背景：在 project.json 加 "background": "背景圖.jpg"（或顏色，例如 "#F2E8D5"）');
