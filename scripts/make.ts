// npm run make -- <專案名> [影片檔] [講稿檔] [--music calm|warm|upbeat] [--no-claude] [--no-render]
// 一鍵做片：建專案 → 字幕（有講稿就用講稿的字）→ 字幕對時 → 找臉 → 背景音樂 → Claude 規劃畫面 → 檢查 → 輸出
// 做過的步驟會自動跳過，中途失敗修好後再跑同一行，會從卡住的地方接著做
// 講稿沒給的話，會找影片旁邊同名的 .txt（Colab「AI分身工作室」做好影片時會一起存）
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pendingImages } from "./images";
import { ROOT, claudeLine, die, projectDir, readProject } from "./lib";

const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const mi = argv.indexOf("--music");
const style = mi >= 0 ? argv[mi + 1] : "calm";
if (!["calm", "warm", "upbeat"].includes(style)) die("--music 只能是 calm、warm、upbeat");
const pos = argv.filter((a, i) => !a.startsWith("--") && !(mi >= 0 && i === mi + 1));
const [name, videoArg, scriptArg] = pos;
if (!name) die("用法：npm run make -- 專案名 影片檔 [講稿檔]\n   例如：npm run make -- challenge-d2 ~/Downloads/分身影片_1030_0900_第2000步.mp4");
if (!/^[a-zA-Z0-9-]+$/.test(name)) die("專案名只能用英文、數字和 -（例如 challenge-d2）");

const t0 = Date.now();
const dir = projectDir(name);
const has = (f: string) => fs.existsSync(path.join(dir, f));
const npm = (...args: string[]) => spawnSync("npm", ["run", "-s", ...args.flatMap((x, i) => (i === 0 ? [x, "--"] : [x]))], { cwd: ROOT, stdio: "inherit" }).status === 0;
let n = 0;
const step = async (label: string, skip: string | false, run: () => boolean | Promise<boolean>) => {
  n++;
  if (skip) return console.log(`⏭️  ${n}. ${label}：${skip}，跳過`);
  console.log(`\n━━━ ${n}. ${label} ━━━`);
  if (!(await run())) die(`${label}失敗（上面有錯誤訊息）。修好後再跑一次同一行，做過的會自動跳過`);
};

// 1. 建專案（帶講稿）
const video = videoArg?.replace(/^~(?=\/)/, process.env.HOME ?? "~");
const sidecar = video?.replace(/\.[^.\/]+$/, ".txt");
const script = scriptArg ?? (sidecar && fs.existsSync(sidecar) ? sidecar : undefined);
await step("建專案", has("project.json") ? "已經建好（要換影片用 npm run new）" : false, () => {
  if (!video) die(`還沒有專案 ${name}：要給影片檔，npm run make -- ${name} 影片檔`);
  if (!fs.existsSync(video)) die(`找不到影片：${video}`);
  if (script) console.log(`📝 講稿：${script}`);
  else console.log("⚠️ 沒有講稿：字幕會用語音辨識，可能有錯字（影片旁邊放同名 .txt，或第三個參數給講稿檔）");
  return npm("new", name, video, ...(script ? ["--script", script] : []));
});
// 已經有專案、這次才給講稿：補上
if (scriptArg && has("project.json") && !has("script.txt")) fs.copyFileSync(scriptArg, path.join(dir, "script.txt"));

// 2~5. 字幕、對時、找臉、音樂
await step("上字幕", has("captions.json") ? "已經有字幕" : false, () => npm("transcribe", name));
let p = readProject(name);
await step("字幕對時", p.captions?.lead !== undefined ? `已經量過（${p.captions.lead} 秒）` : false, () => {
  if (!npm("lead", name)) console.log("⚠️ 量不出字幕和聲音的時間差，先用預設值，不影響後面的步驟");
  return true;
});
await step("找臉", p.face ? "已經找過" : false, () => npm("face", name));
await step("背景音樂", p.music ? "已經有音樂" : false, () => npm("music", name, style));

// 6. Claude 規劃畫面（還是預設的開場標題、沒有字卡 = 還沒規劃）
p = readProject(name);
const planned = (p.cards?.length ?? 0) > 0 || (p.hook && p.hook.lines[0]?.text !== "第一行標題");
const hasClaude = spawnSync("claude", ["--version"]).status === 0;
const prompt = `幫我規劃 ${name} 的畫面（照 CLAUDE.md「照逐字稿規劃畫面」），開場小膠囊 badge 也照內容寫，publish 也一起寫好。字幕、字幕對時、找臉、背景音樂都做好了，不用再跑。改完跑 npm run check -- ${name} 修到沒有警告。不要輸出影片、不要發佈、不要 git commit 或 push。`;
await step(
  "Claude 規劃畫面",
  planned ? "已經規劃過（要重來就在控制台寫想改什麼）" : flag("--no-claude") ? "加了 --no-claude" : !hasClaude ? "這台電腦沒有 claude 指令" : false,
  () => {
    console.log("   （約 3~10 分鐘，下面會即時顯示 Claude 在做什麼）");
    return runClaude(prompt);
  },
);
if (!planned && (!hasClaude || flag("--no-claude"))) {
  console.log(`\n🤖 把這段貼給 Claude，規劃好再跑一次同一行就會接著輸出：\n\n${prompt}\n`);
  process.exit(0);
}

// 7~8. 檢查、輸出
// 背景圖、插圖（有 prompt / stock 但圖還沒有）、去背（用到換背景、景深大字等但還沒去背）
p = readProject(name);
const pending = pendingImages(name).length;
await step("產生插圖和背景", pending ? false : "沒有要產生的圖", () => npm("images", name));
const cutFx = [p.background, p.backgrounds?.length, p.depthTexts?.length, p.breakouts?.length, p.cutouts?.length, p.magazines?.length].some(Boolean);
await step("去背", !cutFx ? "沒有用到去背特效" : p.matte || p.greenScreen ? "已經去背過" : false, () => {
  console.log("   （AI 去背，40 秒影片在 Mac 上約 5 分鐘）");
  return npm("matte", name);
});
await step("檢查畫面", false, () => npm("check", name));
await step("輸出成品", flag("--no-render") ? "加了 --no-render" : false, () => npm("render", name));
const min = Math.round((Date.now() - t0) / 60000);
console.log(flag("--no-render") ? `\n✅ 準備好了（${min} 分鐘），要輸出就跑 npm run render -- ${name}` : `\n🎉 完成（${min} 分鐘）：out/${name}.mp4`);

// Claude 在這台電腦上規劃畫面，即時顯示它讀了什麼、改了什麼
function runClaude(text: string) {
  const args = ["-p", text, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--disallowedTools", "Bash(npm run publish*)", "Bash(git *)",
    "--allowedTools", "Read", "Edit", "Write", "Glob", "Grep", "Bash(npm run *)", "Bash(npx remotion *)"];
  return new Promise<boolean>((resolve) => {
    const child = spawn("claude", args, { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
    let buf = "";
    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) if (l.trim()) process.stdout.write(claudeLine(l));
    });
    child.on("error", () => resolve(false));
    child.on("close", (c) => resolve(c === 0));
  });
}
