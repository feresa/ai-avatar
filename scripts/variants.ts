// npm run variants -- <專案名> [版本名...]
// 一支變多支：把 project.json 的 variants 每個版本都輸出成 out/專案名-版本名.mp4（原版也一起輸出）
// 例如開場標題不同的 3 個版本，發出去看哪個比較多人看
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, applyTranscript, die, ensureSourceSize, freePort, readProject, syncProjectList } from "./lib";

const [name, ...only] = process.argv.slice(2);
if (!name) die("用法：npm run variants -- 專案名 [版本名...]");
const p = readProject(name);
const list = (p.variants ?? []).filter((v) => !only.length || only.includes(v.name));
if (!list.length) die('project.json 裡沒有 variants。例如：\n   "variants": [{ "name": "b", "hook": { ...另一個開場標題... } }]');
for (const v of list) if (!/^[a-zA-Z0-9-]+$/.test(v.name)) die(`版本名只能用英文、數字和 -：${v.name}`);
syncProjectList();
ensureSourceSize(name);
applyTranscript(name);
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });

const jobs = [...(only.length ? [] : [{ name: "", file: `${name}.mp4` }]), ...list.map((v) => ({ name: v.name, file: `${name}-${v.name}.mp4` }))];
for (const [i, j] of jobs.entries()) {
  console.log(`🎬 (${i + 1}/${jobs.length}) ${j.name ? `版本 ${j.name}` : "原版"} → out/${j.file}`);
  const r = spawnSync("npx", ["remotion", "render", name, path.join("out", j.file), "--codec=h264", "--crf=18", `--port=${await freePort()}`, `--props=${JSON.stringify({ variant: j.name || undefined })}`], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) die(`輸出 ${j.file} 失敗（上面有錯誤訊息）`);
}
console.log(`🎉 完成 ${jobs.length} 支：${jobs.map((j) => "out/" + j.file).join("、")}`);
