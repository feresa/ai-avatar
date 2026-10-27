// npm run face -- <專案名>
// 自動找臉：算出直式裁切要對準哪裡（focusX / focusY），並把臉的位置存進 project.json 的 face，
// 之後字卡、貼圖、插圖就能避開臉（npm run check 會檢查）
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Project } from "../src/types";
import { ROOT, die, projectDir, readProject, writeProject } from "./lib";

const name = process.argv[2] ?? die("用法：npm run face -- 專案名");
const p = readProject(name);

// 第一次會在專案裡建一個 Python 環境，裝 OpenCV（約 50MB，只裝一次）
const VENV = path.join(ROOT, ".venv-face");
const py = path.join(VENV, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!fs.existsSync(py)) {
  console.log("⚙️ 第一次使用：安裝人臉偵測（OpenCV），約 1 分鐘...");
  const sys = process.platform === "win32" ? "python" : "python3";
  let r = spawnSync(sys, ["-m", "venv", VENV], { stdio: "inherit" });
  if (r.status !== 0) die("建立 Python 環境失敗：Mac 請先跑 xcode-select --install");
  r = spawnSync(py, ["-m", "pip", "install", "-q", "opencv-python-headless>=4.8,<5"], { stdio: "inherit" });
  if (r.status !== 0) die("安裝 OpenCV 失敗（上面有錯誤訊息）");
}

console.log("🙂 找臉中...");
const r = spawnSync(py, [path.join(ROOT, "scripts", "face.py"), path.join(projectDir(name), p.video)], { encoding: "utf-8" });
if (r.status !== 0) die(`找臉失敗：\n${r.stderr || r.stdout}`);
const res = JSON.parse(r.stdout) as {
  width: number;
  height: number;
  samples: number;
  faces: { t: number; x: number; y: number; w: number; h: number }[];
};
if (!res.faces.length) die("整支影片都沒找到臉（側臉、太暗或臉太小會找不到），維持原本的設定");

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const cx = median(res.faces.map((f) => f.x + f.w / 2));
const cy = median(res.faces.map((f) => f.y + f.h / 2));
const fw = median(res.faces.map((f) => f.w));
const fh = median(res.faces.map((f) => f.h));

// 直式成品（cover 裁切）裡的位置
const W = p.width ?? 1080;
const H = p.height ?? 1920;
const S = Math.max(W / res.width, H / res.height);
const iw = res.width * S;
const ih = res.height * S;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// 左右：臉放正中間；上下：臉放在畫面上方約 35% 的位置（下半部留給字幕）
const focusX = iw > W + 1 ? clamp01((cx * S - W / 2) / (iw - W)) : 0.5;
const focusY = ih > H + 1 ? clamp01((cy * S - H * 0.35) / (ih - H)) : 0.5;
const offX = (W - iw) * focusX;
const offY = (H - ih) * focusY;
const face = {
  x: round((cx - fw / 2) * S + offX, W),
  y: round((cy - fh / 2) * S + offY, H),
  w: round(fw * S, W),
  h: round(fh * S, H),
};
function round(v: number, total: number) {
  return Math.round((v / total) * 1000) / 1000;
}

// 臉會不會一直移動
const spread = Math.max(...res.faces.map((f) => Math.abs((f.x + f.w / 2 - cx) * S) / W));
const next: Project = { ...p, focusX: round(focusX * 1000, 1000), focusY: round(focusY * 1000, 1000), face };
writeProject(name, next);

console.log(`✅ ${res.faces.length}/${res.samples} 個取樣點找到臉`);
console.log(`   裁切焦點 focusX=${next.focusX} focusY=${next.focusY}`);
console.log(`   臉在畫面的位置：左 ${pct(face.x)}、上 ${pct(face.y)}、寬 ${pct(face.w)}、高 ${pct(face.h)}（已存進 project.json 的 face）`);
if (face.h < 0.12) console.log(`   💡 臉有點小，可以把 baseZoom 調到 ${Math.min(1.6, 0.16 / face.h).toFixed(2)} 左右`);
if (spread > 0.12) console.log("   ⚠️ 臉左右移動比較多，字卡貼圖要留多一點空間");
console.log(`   下一步：npm run check -- ${name}（檢查字卡、貼圖有沒有擋到臉）`);
function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}
