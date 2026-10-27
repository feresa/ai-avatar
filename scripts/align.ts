// npm run align -- <專案名> [講稿檔]
// 用講稿當字幕：字用講稿的（不會有錯字），時間用語音辨識的。講稿會存成專案資料夾裡的 script.txt
import fs from "node:fs";
import path from "node:path";
import { applyScript, die, projectDir, readProject } from "./lib";

const [name, file] = process.argv.slice(2);
if (!name) die("用法：npm run align -- 專案名 講稿.txt");
readProject(name);
const dir = projectDir(name);
if (file) {
  if (!fs.existsSync(file)) die(`找不到講稿：${file}`);
  fs.copyFileSync(file, path.join(dir, "script.txt"));
}
if (!fs.existsSync(path.join(dir, "script.txt"))) die("沒有講稿：npm run align -- 專案名 講稿.txt");
if (!fs.existsSync(path.join(dir, "captions.whisper.json"))) {
  // 舊專案：transcribe 還沒存原始辨識結果，就拿現在的 captions.json 當原始結果
  const cur = path.join(dir, "captions.json");
  if (!fs.existsSync(cur)) die(`還沒上字幕：先跑 npm run transcribe -- ${name}`);
  fs.copyFileSync(cur, path.join(dir, "captions.whisper.json"));
}
const r = applyScript(name) ?? die("對齊失敗");
console.log(`✅ 用講稿當字幕：${r.total} 個字，${Math.round(r.rate * 100)}% 對到語音`);
if (r.rate < 0.6) console.log("   ⚠️ 對到的比例偏低：講稿跟影片內容是同一份嗎？");
console.log(`   逐字稿已更新：public/projects/${name}/transcript.txt`);
