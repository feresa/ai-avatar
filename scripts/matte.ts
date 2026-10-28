// npm run matte -- <專案名>
// AI 去背：用 RobustVideoMatting 把人從背景切出來，存成 matte.webm（背景透明），
// 之後景深大字、破框、換背景、剪貼、雜誌封面都會用到。有綠幕的影片不用跑這個（設 greenScreen 就好）
// 第一次會在專案裡建 Python 環境、裝 PyTorch（約 300MB）、Pillow、下載模型（15MB），只做一次
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { RenderInternals } from "@remotion/renderer";
import { ROOT, die, ensureSourceSize, projectDir, writeProject } from "./lib";

const args = process.argv.slice(2);
const fi = args.indexOf("--file");
const importFile = fi >= 0 ? args[fi + 1] : undefined;
const name = args.filter((_, i) => fi < 0 || (i !== fi && i !== fi + 1))[0] ?? die("用法：npm run matte -- 專案名 [--file Colab做好的_去背.webm]");
const p = ensureSourceSize(name);

// Colab 做好的去背檔：直接放進專案
if (importFile) {
  if (!fs.existsSync(importFile)) die(`找不到檔案：${importFile}`);
  if (!/\.webm$/i.test(importFile)) die("去背檔要是 .webm（Colab「AI去背」筆記本做出來的 _去背.webm）");
  const dur = Number(
    spawnSync("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", importFile], { cwd: ROOT, encoding: "utf-8" }).stdout.trim(),
  );
  if (dur && Math.abs(dur - p.durationSec) > 0.5)
    die(`去背檔 ${dur.toFixed(1)} 秒，專案影片 ${p.durationSec} 秒，長度對不上：要用同一支影片去背`);
  fs.copyFileSync(importFile, path.join(projectDir(name), "matte.webm"));
  writeProject(name, { ...p, matte: "matte.webm" });
  console.log(`✅ 已放進專案：public/projects/${name}/matte.webm`);
  console.log("   現在可以用：景深大字 depthTexts、破框 breakouts、換背景 backgrounds、剪貼 cutouts、雜誌封面 magazines");
  process.exit(0);
}
const W = p.sourceWidth ?? die("量不到影片大小");
const H = p.sourceHeight ?? die("量不到影片大小");

// 用 Remotion 內建的 ffmpeg：照 Remotion 自己的方式找檔案、補執行權限、設函式庫路徑（Mac 少了 DYLD_LIBRARY_PATH 會開不起來）
const { ffmpeg, ffprobe, ffEnv } = (() => {
  const get = (type: "ffmpeg" | "ffprobe" | "compositor") =>
    RenderInternals.getExecutablePath({ type, indent: false, logLevel: "error", binariesDirectory: null });
  const lib = path.dirname(get("compositor"));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(process.platform === "darwin"
      ? { DYLD_LIBRARY_PATH: lib }
      : process.platform === "win32"
        ? { PATH: `${lib};${process.env.PATH}` }
        : { LD_LIBRARY_PATH: lib }),
  };
  const bin = get("ffmpeg");
  const probe = get("ffprobe");
  for (const b of [bin, probe]) if (fs.existsSync(b)) RenderInternals.makeFileExecutableIfItIsNot(b);
  const r = spawnSync(bin, ["-version"], { env, encoding: "utf-8" });
  if (r.status === 0) return { ffmpeg: bin, ffprobe: probe, ffEnv: env };
  console.error(`Remotion 內建 ffmpeg 開不起來：${bin}\n${r.error?.message ?? r.stderr ?? ""}`);
  // 退而求其次：電腦裡裝的 ffmpeg（Mac：brew install ffmpeg）
  for (const sys of ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"])
    if (spawnSync(sys, ["-version"]).status === 0) {
      console.log(`改用電腦裡的 ffmpeg：${sys}`);
      const sp = sys.replace(/ffmpeg$/, "ffprobe");
      return { ffmpeg: sys, ffprobe: spawnSync(sp, ["-version"]).status === 0 ? sp : probe, ffEnv: process.env };
    }
  return die("找不到能用的 ffmpeg：把上面的錯誤訊息貼給 Claude，或先 brew install ffmpeg");
})();

// Python 環境（第一次安裝）
const VENV = path.join(ROOT, ".venv-matte");
const py = path.join(VENV, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!fs.existsSync(py)) {
  console.log("⚙️ 第一次使用：安裝 AI 去背（PyTorch），約 2~5 分鐘...");
  const sys = process.platform === "win32" ? "python" : "python3";
  let r = spawnSync(sys, ["-m", "venv", VENV], { stdio: "inherit" });
  if (r.status !== 0) die("建立 Python 環境失敗：Mac 請先跑 xcode-select --install");
  r = spawnSync(py, ["-m", "pip", "install", "-q", "torch", "numpy", "pillow"], { stdio: "inherit" });
  if (r.status !== 0) {
    fs.rmSync(VENV, { recursive: true, force: true });
    die("安裝 PyTorch 失敗（上面有錯誤訊息）");
  }
}
const MODEL = path.join(VENV, "rvm_mobilenetv3_fp32.torchscript");
if (!fs.existsSync(MODEL)) {
  console.log("⬇️ 下載去背模型（15MB）...");
  const res = await fetch("https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.torchscript");
  if (!res.ok) die(`下載模型失敗：HTTP ${res.status}`);
  fs.writeFileSync(MODEL, Buffer.from(await res.arrayBuffer()));
}

const src = path.join(projectDir(name), p.video);
const out = path.join(projectDir(name), "matte.webm");
const fpsProbe = spawnSync(ffprobe, [
  "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", src,
], { encoding: "utf-8", env: ffEnv });
const fps = fpsProbe.stdout.trim() || "30";
const [fn, fd] = fps.split("/").map(Number);
const total = Math.round(p.durationSec * (fd ? fn / fd : fn || 30));

console.log(`✂️ AI 去背中（${W}×${H}，約 ${total} 格）...`);
const t0 = Date.now();
const dec = spawn(ffmpeg, ["-v", "error", "-i", src, "-an", "-f", "image2pipe", "-c:v", "png", "-pix_fmt", "rgb24", "-compression_level", "1", "-s", `${W}x${H}`, "-"], { env: ffEnv });
const mat = spawn(py, [path.join(ROOT, "scripts", "matte.py"), String(W), String(H), MODEL, process.env.MATTE_DEVICE ?? "auto"]);
const enc = spawn(ffmpeg, [
  "-v", "error", "-y", "-f", "image2pipe", "-c:v", "png", "-framerate", fps, "-i", "-",
  "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "6M", "-auto-alt-ref", "0", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1",
  out,
], { env: ffEnv });
dec.stdout.pipe(mat.stdin);
mat.stdout.pipe(enc.stdin);
let device = "";
mat.stderr.on("data", (d: Buffer) => {
  for (const line of d.toString().split("\n")) {
    if (line.startsWith("device=")) device = line.slice(7);
    else if (line.startsWith("frames=")) {
      const n = Number(line.slice(7));
      const sec = (Date.now() - t0) / 1000;
      process.stdout.write(`\r   ${Math.min(100, Math.round((n / total) * 100))}%（${device}，${(n / sec).toFixed(1)} 格/秒）`);
    } else if (line.trim() && !line.startsWith("done=")) process.stderr.write(line + "\n");
  }
});
dec.stderr.on("data", (d: Buffer) => process.stderr.write(d));
enc.stderr.on("data", (d: Buffer) => process.stderr.write(d));
const exit = (c: ReturnType<typeof spawn>) => new Promise<number>((r) => c.on("close", (code) => r(code ?? 1)));
const [a, b, c] = await Promise.all([exit(dec), exit(mat), exit(enc)]);
process.stdout.write("\n");
if (a !== 0 || b !== 0 || c !== 0) die(`去背失敗（解碼 ${a}、去背 ${b}、編碼 ${c}），上面有錯誤訊息`);

writeProject(name, { ...p, matte: "matte.webm" });
console.log(`✅ 去背完成：public/projects/${name}/matte.webm（${Math.round((Date.now() - t0) / 1000)} 秒）`);
console.log("   現在可以用：景深大字 depthTexts、破框 breakouts、換背景 backgrounds、剪貼 cutouts、雜誌封面 magazines");
