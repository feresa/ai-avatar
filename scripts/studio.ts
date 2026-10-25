// npm run studio
// 開預覽畫面；開著的時候改 transcript.txt，存檔後字幕會自動更新（預覽畫面重新整理一下）
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR, ROOT, applyAllTranscripts, applyTranscript } from "./lib";

applyAllTranscripts();

let timer: NodeJS.Timeout | undefined;
fs.watch(PROJECTS_DIR, { recursive: true }, (_e, file) => {
  if (!file || path.basename(file.toString()) !== "transcript.txt") return;
  const name = file.toString().split(/[\\/]/)[0];
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const n = applyTranscript(name);
      if (n) console.log(`✏️ ${name}：逐字稿改了 ${n} 句，已更新字幕（預覽畫面按 F5 重新整理）`);
    } catch (e) {
      console.error(`❌ 逐字稿更新失敗：${(e as Error).message}`);
    }
  }, 300);
});

const child = spawn("npx", ["remotion", "studio", ...process.argv.slice(2)], { cwd: ROOT, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
