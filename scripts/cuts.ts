// npm run cuts -- <專案名> [最短停頓秒數，預設 0.5]
// 偵測停頓，把「要保留的段落」寫進 project.json 的 keep（原始影片不會被改動，隨時可以改回來）
import path from "node:path";
import { die, findPauses, projectDir, readProject, writeProject } from "./lib";

const name = process.argv[2] ?? die("用法：npm run cuts -- 專案名 [最短停頓秒數]");
const minPause = Number(process.argv[3] ?? 0.5);
const PAD = 0.12; // 停頓前後各留一點，聲音才不會切得太突然
const p = readProject(name);

const pauses = findPauses(path.join(projectDir(name), p.video), minPause);
const starts = pauses.map((x) => x.start);
const ends = pauses.map((x) => x.end);

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
