// npm run render -- <專案名>
// 輸出成品到 out/<專案名>.mp4
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, applyTranscript, die, readProject } from "./lib";

const name = process.argv[2] ?? die("用法：npm run render -- 專案名");
readProject(name);
const n = applyTranscript(name);
if (n) console.log(`✏️ 逐字稿改了 ${n} 句，已更新字幕`);
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const out = path.join("out", `${name}.mp4`);
const r = spawnSync("npx", ["remotion", "render", name, out, "--codec=h264", "--crf=18"], { cwd: ROOT, stdio: "inherit" });
if (r.status !== 0) die("輸出失敗（上面有錯誤訊息）");
console.log(`🎉 完成：${out}`);
