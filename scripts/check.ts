// npm run check -- <專案名>
// 檢查字卡、貼圖、插圖、字幕有沒有擋到臉（要先跑 npm run face），以及同一時間效果會不會太擠
import { fmtTime, die, readProject } from "./lib";

const name = process.argv[2] ?? die("用法：npm run check -- 專案名");
const p = readProject(name);
type Box = { x: number; y: number; w: number; h: number };

// 臉的位置（含 baseZoom 放大，放大的中心就是臉）
let face: Box | null = null;
if (p.face) {
  const z = p.baseZoom ?? 1;
  const ox = p.face.x + p.face.w / 2;
  const oy = p.face.y + p.face.h / 2;
  // 額頭、下巴也算進去：上下各多 15%
  const f = { x: p.face.x, y: p.face.y - p.face.h * 0.15, w: p.face.w, h: p.face.h * 1.3 };
  face = { x: ox + (f.x - ox) * z, y: oy + (f.y - oy) * z, w: f.w * z, h: f.h * z };
}

const overlap = (a: Box, b: Box) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (ix * iy) / (b.w * b.h);
};

type Item = { kind: string; at: number; dur: number; box: Box; label: string };
const items: Item[] = [];
for (const c of p.cards ?? []) {
  const y = c.y ?? 0.42;
  items.push({ kind: "字卡", at: c.at, dur: c.dur, box: { x: 0.1, y: y - 0.045, w: 0.8, h: c.sub ? 0.12 : 0.09 }, label: c.text });
}
for (const s of p.stickers ?? []) {
  const size = s.size ?? 0.2;
  const hh = (size * 1080) / 1920;
  items.push({ kind: "貼圖", at: s.at, dur: s.dur, box: { x: (s.x ?? 0.78) - size / 2, y: (s.y ?? 0.3) - hh / 2, w: size, h: hh }, label: s.emoji ?? s.kind ?? s.src ?? "" });
}
for (const n of p.notes ?? []) {
  const size = n.size ?? 0.36;
  const hh = (size * 1080) / 1920;
  items.push({ kind: "便利貼", at: n.at, dur: n.dur, box: { x: (n.x ?? 0.74) - size / 2, y: (n.y ?? 0.52) - hh / 2, w: size, h: hh }, label: n.text });
}
for (const b of p.breaths ?? []) {
  const w = b.size ?? 0.3;
  const h = (w * 1080) / 1920;
  items.push({ kind: "呼吸引導圈", at: b.at, dur: b.dur, box: { x: (b.x ?? 0.5) - w / 2, y: (b.y ?? 0.64) - h / 2, w, h }, label: (b.pattern ?? [["吸氣", 4], ["吐氣", 4]]).map(([l, d]) => `${l}${d}`).join("") });
}
for (const ph of p.phones ?? []) {
  const w = ph.size ?? 0.34;
  const h = (w * 2.05 * 1080) / 1920;
  items.push({ kind: "手機", at: ph.at, dur: ph.dur, box: { x: (ph.x ?? 0.78) - w / 2, y: (ph.y ?? 0.45) - h / 2, w, h }, label: ph.src });
}
for (const o of p.orbits ?? []) {
  const y = o.y ?? 0.12;
  items.push({ kind: "卡片環繞", at: o.at, dur: o.dur, box: { x: 0.05, y: y - 0.08, w: 0.9, h: 0.16 }, label: o.items.join("、") });
}
for (const ins of p.inserts ?? []) {
  const mode = ins.mode ?? "full";
  if (mode === "full") continue; // 蓋滿畫面本來就會蓋住臉
  const box = mode === "top" ? { x: 0, y: 0, w: 1, h: 0.5 } : { x: 0.08, y: 0.1, w: 0.84, h: 0.266 };
  items.push({ kind: "插圖", at: ins.at, dur: ins.dur, box, label: ins.src });
}

let problems = 0;

// 景深大字、破框、剪貼、換背景、雜誌封面要先把人切出來
const needCut = [
  ["景深大字", p.depthTexts],
  ["破框", p.breakouts],
  ["剪貼", p.cutouts],
  ["換背景", p.backgrounds],
  ["雜誌封面", p.magazines],
].filter(([, l]) => (l as unknown[] | undefined)?.length).map(([n]) => n);
if (needCut.length && !p.greenScreen && !p.matte) {
  problems++;
  console.log(`⚠️ ${needCut.join("、")} 要先去背：綠幕拍的跑 npm run green -- ${name}，一般影片跑 npm run matte -- ${name}`);
}
if (!face) console.log(`ℹ️ 還沒有臉的位置，先跑 npm run face -- ${name}，才能檢查有沒有擋到臉`);
else {
  const capY = p.captions?.y ?? 0.76;
  if (overlap({ x: 0.05, y: capY - 0.04, w: 0.9, h: 0.08 }, face) > 0.05) {
    problems++;
    console.log(`⚠️ 字幕（y=${capY}）會擋到臉：把 captions.y 調大一點，例如 ${Math.min(0.86, face.y + face.h + 0.08).toFixed(2)}`);
  }
  for (const it of items) {
    const o = overlap(it.box, face);
    if (o > 0.08) {
      problems++;
      const below = Math.min(0.7, face.y + face.h + 0.07).toFixed(2);
      console.log(`⚠️ [${fmtTime(it.at)}] ${it.kind}「${it.label}」擋到臉 ${Math.round(o * 100)}%：建議 y 改成 ${below}${it.kind === "貼圖" ? " 或移到左右兩邊" : ""}`);
    }
  }
}

// 同一時間太多東西
const sorted = [...items].sort((a, b) => a.at - b.at);
for (let i = 0; i < sorted.length; i++)
  for (let j = i + 1; j < sorted.length && sorted[j].at < sorted[i].at + sorted[i].dur; j++)
    if (sorted[i].kind !== "插圖" && sorted[j].kind !== "插圖") {
      problems++;
      console.log(`⚠️ [${fmtTime(sorted[j].at)}] ${sorted[i].kind}「${sorted[i].label}」和${sorted[j].kind}「${sorted[j].label}」同時出現，畫面會太擠`);
    }

if (p.hook)
  for (const it of items)
    if (it.at < p.hook.to && it.at + it.dur > p.hook.from) {
      problems++;
      console.log(`⚠️ [${fmtTime(it.at)}] ${it.kind}「${it.label}」和開場標題重疊`);
    }

console.log(problems ? `\n共 ${problems} 個地方要注意` : "✅ 沒問題：字卡、貼圖、插圖都沒擋到臉，也不會太擠");
