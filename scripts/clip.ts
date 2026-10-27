// npm run clip -- <長片專案> <新專案名> <開始> <結束>
// 從一支長影片剪出一段做成新的短片專案。開始、結束會自動對到最近的自然停頓（不會切到半個字）
// 時間可以寫秒數（83.5）或 分:秒（1:23.5）
import type { Caption } from "@remotion/captions";
import fs from "node:fs";
import path from "node:path";
import type { Project } from "../src/types";
import { die, findPauses, fmtTime, parseTime, projectDir, readProject, remotionTool, syncProjectList, writeProject, writeTranscript } from "./lib";

const [src, name, a0, b0] = process.argv.slice(2);
if (!src || !name || !a0 || !b0) die("用法：npm run clip -- 長片專案 新專案名 開始 結束\n   例如：npm run clip -- class-01 class-01-a 1:23 2:05");
if (!/^[a-zA-Z0-9-]+$/.test(name)) die("專案名只能用英文、數字和 -");
if (fs.existsSync(projectDir(name))) die(`專案「${name}」已經存在，換個名字`);
const p = readProject(src);
const video = path.join(projectDir(src), p.video);
let start = parseTime(a0);
let end = parseTime(b0);
if (end <= start) die("結束要比開始晚");

// 對到最近的停頓（前後 1.5 秒內）：剪在停頓中間，聲音才不會切一半
const pauses = findPauses(video, 0.2);
const snap = (t: number, edge: "start" | "end") => {
  let best: number | null = null;
  for (const ps of pauses) {
    // 開始點：停頓結束前 0.15 秒（話快開始）；結束點：停頓開始後 0.25 秒（話剛說完）
    const at = edge === "start" ? Math.max(ps.start, ps.end - 0.15) : Math.min(ps.end, ps.start + 0.25);
    if (Math.abs(at - t) <= 1.5 && (best === null || Math.abs(at - t) < Math.abs(best - t))) best = at;
  }
  return best ?? t;
};
const s2 = Math.max(0, snap(start, "start"));
const e2 = Math.min(p.durationSec, snap(end, "end"));
if (s2 !== start || e2 !== end) console.log(`🎯 對到自然停頓：${fmtTime(start)}~${fmtTime(end)} → ${fmtTime(s2)}~${fmtTime(e2)}`);
start = s2;
end = e2;
const dur = Math.round((end - start) * 100) / 100;

const dir = projectDir(name);
fs.mkdirSync(dir, { recursive: true });
console.log(`✂️ 剪出 ${fmtTime(start)} ~ ${fmtTime(end)}（${dur} 秒）...`);
const r = remotionTool("ffmpeg", [
  "-y", "-v", "error", "-ss", String(start), "-i", video, "-t", String(dur),
  "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
  path.join(dir, "source.mp4"),
]);
if (r.status !== 0 || !fs.existsSync(path.join(dir, "source.mp4"))) {
  fs.rmSync(dir, { recursive: true, force: true });
  die(`剪片失敗：\n${r.stderr}`);
}

// 字幕：只留這一段，時間從 0 開始
const cut = (file: string) => {
  const f = path.join(projectDir(src), file);
  if (!fs.existsSync(f)) return null;
  const caps = JSON.parse(fs.readFileSync(f, "utf-8")) as Caption[];
  const out = caps
    .filter((c) => (c.startMs + c.endMs) / 2000 >= start && (c.startMs + c.endMs) / 2000 <= end)
    .map((c) => ({
      ...c,
      startMs: Math.max(0, Math.round(c.startMs - start * 1000)),
      endMs: Math.min(dur * 1000, Math.round(c.endMs - start * 1000)),
      timestampMs: c.timestampMs === null ? null : Math.round(c.timestampMs - start * 1000),
    }));
  fs.writeFileSync(path.join(dir, file), JSON.stringify(out, null, 1));
  return out;
};
const caps = cut("captions.json");
cut("captions.whisper.json");
if (caps) writeTranscript(name, caps);

const next: Project = {
  video: "source.mp4",
  durationSec: dur,
  focusX: p.focusX,
  focusY: p.focusY,
  baseZoom: p.baseZoom,
  face: p.face,
  keep: null,
  hook: { from: 0, to: 3, lines: [{ text: "第一行標題", color: "white" }, { text: "第二行重點", color: "yellow" }], icons: [], strike: false },
  captions: { ...(p.captions ?? {}), highlight: [] },
  zooms: [],
  cards: [],
  inserts: [],
  stickers: [],
  transitions: [],
  cutTransition: p.cutTransition ?? null,
  music: null,
  sfx: [],
  gradient: p.gradient,
  videoVolume: p.videoVolume,
  publish: { title: "", description: "", tags: [], privacy: "private" },
};
writeProject(name, next);
syncProjectList();
console.log(`✅ 新短片專案 ${name}（${dur} 秒）${caps ? `，字幕 ${caps.length} 個字` : "，還沒有字幕：npm run transcribe -- " + name}`);
console.log(`   下一步：npm run cuts -- ${name}（剪停頓），再請 Claude「照逐字稿幫 ${name} 規劃畫面」`);
