// npm run render -- <專案名>
// 輸出成品到 out/<專案名>.mp4
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { generateImages, pendingImages } from "./images";
import { RENDER_FLAGS, ROOT, applyTranscript, die, ensureSourceSize, freePort, readProject, syncProjectList } from "./lib";

const name = process.argv[2] ?? die("用法：npm run render -- 專案名");
readProject(name);
syncProjectList();
ensureSourceSize(name);
const n = applyTranscript(name);
if (n) console.log(`✏️ 逐字稿改了 ${n} 句，已更新字幕`);
// 有還沒產生的插圖就先產生
if (pendingImages(name).length) {
  await generateImages(name);
  if (pendingImages(name).length) die("有插圖沒產生成功（上面有原因），修好再輸出，或先把那幾個 inserts 拿掉");
}
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const out = path.join("out", `${name}.mp4`);

const port = await freePort();

const r = spawnSync("npx", ["remotion", "render", name, out, "--codec=h264", "--crf=18", ...RENDER_FLAGS, `--port=${port}`], { cwd: ROOT, stdio: "inherit" });
if (r.status !== 0) die("輸出失敗（上面有錯誤訊息）");
console.log(`🎉 完成：${out}`);
