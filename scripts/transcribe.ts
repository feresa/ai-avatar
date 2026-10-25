// npm run transcribe -- <專案名>
// 語音轉文字（whisper.cpp，在你電腦上跑，不用上傳）：產生逐字時間的 captions.json 和給人 / Claude 看的 transcript.txt
import type { Caption } from "@remotion/captions";
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe, type WhisperModel } from "@remotion/install-whisper-cpp";
import * as OpenCC from "opencc-js";
import fs from "node:fs";
import path from "node:path";
import { ROOT, die, fmtTime, projectDir, readProject, remotionTool } from "./lib";

const name = process.argv[2] ?? die("用法：npm run transcribe -- 專案名");
const p = readProject(name);
const dir = projectDir(name);
const WHISPER_DIR = path.join(ROOT, "whisper.cpp");
const VERSION = process.env.WHISPER_VERSION ?? "1.5.5";
const MODEL = (process.env.WHISPER_MODEL ?? "medium") as WhisperModel;

const wav = path.join(dir, "audio16k.wav");
const r = remotionTool("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(dir, p.video), "-ac", "1", "-ar", "16000", wav]);
if (r.status !== 0) die(`抽聲音失敗：\n${r.stderr}`);

console.log(`⚙️ 準備 whisper.cpp ${VERSION}（第一次會下載、編譯，幾分鐘）...`);
await installWhisperCpp({ to: WHISPER_DIR, version: VERSION, printOutput: false });
console.log(`⬇️ 準備語音模型 ${MODEL}（第一次會下載）...`);
await downloadWhisperModel({ model: MODEL, folder: WHISPER_DIR, printOutput: false });

console.log("🎧 語音轉文字中...");
const out = await transcribe({
  inputPath: wav,
  whisperPath: WHISPER_DIR,
  whisperCppVersion: VERSION,
  model: MODEL,
  tokenLevelTimestamps: true,
  language: "zh",
  additionalArgs: [["--prompt", "以下是繁體中文的句子，有標點符號。"]],
  onProgress: (x) => process.stdout.write(`\r   ${Math.round(x * 100)}%`),
});
process.stdout.write("\n");
fs.rmSync(wav);

// whisper 常常給簡體字：一律轉成台灣用字
const toTW = OpenCC.Converter({ from: "cn", to: "twp" });
const captions: Caption[] = toCaptions({ whisperCppOutput: out }).captions
  .map((c) => ({ ...c, text: toTW(c.text) }))
  .filter((c) => c.text.trim() && !/^\[.*\]$/.test(c.text.trim()));
fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify(captions, null, 1));

// 給人看的逐字稿：每句一行，前面是開始時間（原始影片的秒數，剪輯腳本就用這個時間）
const lines: string[] = [];
let cur = "";
let start = 0;
for (const c of captions) {
  if (!cur) start = c.startMs / 1000;
  cur += c.text.trim();
  if (/[，。！？,.!?]$/.test(c.text.trim()) || cur.length >= 22) {
    lines.push(`[${fmtTime(start)}] ${cur}`);
    cur = "";
  }
}
if (cur) lines.push(`[${fmtTime(start)}] ${cur}`);
fs.writeFileSync(path.join(dir, "transcript.txt"), lines.join("\n") + "\n");
console.log(`✅ 字幕完成：${captions.length} 個字詞，逐字稿 ${lines.length} 句`);
console.log(`   public/projects/${name}/transcript.txt（有錯字直接改 captions.json 裡的 text）`);
console.log(`   下一步：npm run cuts -- ${name}（自動剪掉停頓，可略過）`);
