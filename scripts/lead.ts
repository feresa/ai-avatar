// npm run lead -- <專案名>
// 量字幕和聲音差多少：找每句話「停頓後開口」的那一刻，和字幕的開始時間比，取中位數寫進 captions.lead
import fs from "node:fs";
import path from "node:path";
import type { Caption } from "@remotion/captions";
import { die, findPauses, projectDir, readProject, writeProject } from "./lib";

const name = process.argv[2] ?? die("用法：npm run lead -- 專案名");
const p = readProject(name);
const dir = projectDir(name);
const captions: Caption[] = JSON.parse(fs.readFileSync(path.join(dir, "captions.json"), "utf-8"));
// 開口的時間 = 停頓結束的時間（0.12 秒以上的停頓）
const onsets = [0, ...findPauses(path.join(dir, p.video), 0.12).map((x) => x.end)];

// 只看每句話的第一個字（前面有停頓的），句中的字聲音連在一起量不準
const diffs: number[] = [];
captions.forEach((c, i) => {
  if (!c.text.trim()) return;
  const prevEnd = i > 0 ? captions[i - 1].endMs : -1e9;
  if (c.startMs - prevEnd < 150 && i > 0) return;
  const s = c.startMs / 1000;
  const near = onsets.filter((o) => o > s - 0.8 && o < s + 0.4).sort((a, b) => Math.abs(a - s) - Math.abs(b - s))[0];
  if (near !== undefined && !(near === 0 && s > 0.8)) diffs.push(s - near);
});
if (diffs.length < 3) die(`只量到 ${diffs.length} 句，不夠準；請直接在 project.json 調 captions.lead`);

const sorted = [...diffs].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const lead = Math.round(Math.min(0.8, Math.max(0, median)) * 100) / 100;
const old = p.captions?.lead ?? 0.15;
console.log(`量了 ${diffs.length} 句：字幕比開口${median >= 0 ? "晚" : "早"} ${Math.abs(median).toFixed(2)} 秒（中位數）`);
console.log(`   各句：${diffs.map((d) => (d >= 0 ? "+" : "") + d.toFixed(2)).join(" ")}`);
writeProject(name, { ...p, captions: { ...p.captions, lead } });
console.log(`✅ captions.lead：${old} → ${lead}（字幕提早 ${lead} 秒出現）`);
