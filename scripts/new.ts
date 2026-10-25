// npm run new -- <專案名> <影片檔>
// 建立一支新影片的專案：複製影片、量長度、產生剪輯腳本 project.json
import fs from "node:fs";
import path from "node:path";
import type { Project } from "../src/types";
import { die, mediaDuration, projectDir, syncProjectList, writeProject } from "./lib";

const [name, video] = process.argv.slice(2);
if (!name || !video) die("用法：npm run new -- 專案名 影片檔\n   例如：npm run new -- breath-01 ~/Downloads/分身影片.mp4");
if (!/^[a-zA-Z0-9-]+$/.test(name)) die("專案名只能用英文、數字和 -（例如 breath-01），這是 Remotion 的限制");
if (!fs.existsSync(video)) die(`找不到影片：${video}`);

const dir = projectDir(name);
fs.mkdirSync(dir, { recursive: true });
const ext = path.extname(video).toLowerCase() || ".mp4";
const dest = `source${ext}`;
fs.copyFileSync(video, path.join(dir, dest));
const durationSec = Math.round(mediaDuration(path.join(dir, dest)) * 100) / 100;

const file = path.join(dir, "project.json");
if (fs.existsSync(file)) {
  const p = JSON.parse(fs.readFileSync(file, "utf-8")) as Project;
  writeProject(name, { ...p, video: dest, durationSec });
  console.log(`♻️ 專案已存在，只更新影片（${durationSec} 秒）`);
} else {
  const p: Project = {
    video: dest,
    durationSec,
    focusX: 0.5,
    focusY: 0.4,
    baseZoom: 1,
    keep: null,
    hook: {
      from: 0,
      to: 3,
      lines: [
        { text: "第一行標題", color: "white" },
        { text: "第二行重點", color: "yellow" },
      ],
      badge: "每個特效都是 Claude 剪的",
      icons: [],
      strike: true,
    },
    captions: { enabled: true, highlight: [], maxChars: 9, y: 0.76, hideDuringHook: true },
    zooms: [],
    cards: [],
    inserts: [],
    stickers: [],
    transitions: [],
    cutTransition: null,
    music: null,
    sfx: [],
    gradient: true,
    videoVolume: 1,
    publish: { title: "", description: "", tags: [], privacy: "private" },
  };
  writeProject(name, p);
  console.log(`✅ 建好專案 ${name}（影片 ${durationSec} 秒）`);
}
const all = syncProjectList();
console.log(`   專案資料夾：public/projects/${name}/`);
console.log(`   下一步：npm run transcribe -- ${name}（產生字幕）`);
console.log(`   目前所有專案：${all.join("、")}`);
