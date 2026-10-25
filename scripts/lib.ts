// 指令共用的小工具
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Project } from "../src/types";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const PROJECTS_DIR = path.join(ROOT, "public", "projects");

export const projectDir = (name: string) => path.join(PROJECTS_DIR, name);

export const die = (msg: string): never => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

export const readProject = (name: string): Project => {
  const file = path.join(projectDir(name), "project.json");
  if (!fs.existsSync(file)) die(`找不到專案「${name}」：${file}\n   先用 npm run new -- ${name} 影片檔 建立`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Project;
};

export const writeProject = (name: string, p: Project) =>
  fs.writeFileSync(path.join(projectDir(name), "project.json"), JSON.stringify(p, null, 2) + "\n");

/** 用 Remotion 內建的 ffmpeg / ffprobe（不用另外安裝） */
export const remotionTool = (tool: "ffmpeg" | "ffprobe", args: string[]) => {
  const r = spawnSync("npx", ["remotion", tool, ...args], { cwd: ROOT, encoding: "utf-8", maxBuffer: 1 << 28 });
  if (r.status !== 0 && tool === "ffprobe") die(`${tool} 失敗：\n${r.stderr}`);
  return r;
};

export const mediaDuration = (file: string) =>
  Number(remotionTool("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout.trim());

/** 重寫 src/projects.ts：public/projects/ 裡每個專案都會出現在 Remotion Studio */
export const syncProjectList = () => {
  const names = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(PROJECTS_DIR, d.name, "project.json")))
    .map((d) => d.name)
    .sort();
  fs.writeFileSync(
    path.join(ROOT, "src", "projects.ts"),
    `// 由 npm run new 自動產生：public/projects/ 底下的專案清單\nexport const PROJECTS: string[] = ${JSON.stringify(names)};\n`,
  );
  return names;
};

export const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, "0")}:${(sec - m * 60).toFixed(1).padStart(4, "0")}`;
};
