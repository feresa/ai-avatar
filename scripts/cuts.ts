// npm run cuts -- <專案名> [最短停頓秒數，預設 0.5]
// 偵測停頓，把「要保留的段落」寫進 project.json 的 keep（原始影片不會被改動，隨時可以改回來）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { die, projectDir, readProject, remotionTool, writeProject } from "./lib";

const name = process.argv[2] ?? die("用法：npm run cuts -- 專案名 [最短停頓秒數]");
const minPause = Number(process.argv[3] ?? 0.5);
const PAD = 0.12; // 停頓前後各留一點，聲音才不會切得太突然
const p = readProject(name);

// 讀出 16kHz 的聲音，每 20ms 算一次音量，比說話音量低 20dB 以上就算安靜
const wav = path.join(os.tmpdir(), `cuts-${process.pid}.wav`);
remotionTool("ffmpeg", ["-y", "-v", "error", "-i", path.join(projectDir(name), p.video), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
if (!fs.existsSync(wav)) die("讀不到影片的聲音");
const buf = fs.readFileSync(wav);
fs.rmSync(wav);
const dataAt = buf.indexOf("data") + 8; // 跳過 WAV 檔頭
const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + dataAt, buf.byteOffset + dataAt + Math.floor((buf.length - dataAt) / 2) * 2));
if (!pcm.length) die("讀不到影片的聲音");
const WIN = 320; // 20ms
const db: number[] = [];
for (let i = 0; i + WIN <= pcm.length; i += WIN) {
  let sum = 0;
  for (let k = i; k < i + WIN; k++) sum += pcm[k] * pcm[k];
  db.push(10 * Math.log10(sum / WIN + 1e-9));
}
const loud = [...db].sort((a, b) => a - b)[Math.floor(db.length * 0.9)];
const quiet = db.map((d) => d < loud - 20);
const starts: number[] = [];
const ends: number[] = [];
for (let i = 0; i <= quiet.length; i++) {
  const q = quiet[i] ?? false;
  if (q && !quiet[i - 1]) starts.push(i * 0.02);
  if (!q && quiet[i - 1]) {
    if (i * 0.02 - starts[starts.length - 1] < minPause) starts.pop();
    else ends.push(i * 0.02);
  }
}

const keep: [number, number][] = [];
let t = 0;
starts.forEach((s, i) => {
  const e = ends[i] ?? p.durationSec;
  const a = t;
  const b = Math.min(p.durationSec, s + PAD);
  if (b - a > 0.15) keep.push([Math.round(a * 100) / 100, Math.round(b * 100) / 100]);
  t = Math.max(b, e - PAD);
});
if (p.durationSec - t > 0.15) keep.push([Math.round(t * 100) / 100, p.durationSec]);

const kept = keep.reduce((s, [a, b]) => s + b - a, 0);
writeProject(name, { ...p, keep: keep.length ? keep : null });
console.log(`✂️ 找到 ${starts.length} 個停頓（≥ ${minPause} 秒），保留 ${keep.length} 段`);
console.log(`   ${p.durationSec.toFixed(1)} 秒 → ${kept.toFixed(1)} 秒（剪掉 ${(p.durationSec - kept).toFixed(1)} 秒）`);
console.log(`   想恢復：把 project.json 的 keep 改成 null`);
