// 指令共用的小工具
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Caption } from "@remotion/captions";
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

/** 逐字稿怎麼分句：回傳每句包含哪些字幕（captions 的 index） */
export const transcriptGroups = (captions: Caption[]) => {
  const groups: number[][] = [];
  let cur: number[] = [];
  let len = 0;
  captions.forEach((c, i) => {
    cur.push(i);
    len += c.text.trim().length;
    if (/[，。！？,.!?]$/.test(c.text.trim()) || len >= 22) {
      groups.push(cur);
      cur = [];
      len = 0;
    }
  });
  if (cur.length) groups.push(cur);
  return groups;
};

export const writeTranscript = (name: string, captions: Caption[]) => {
  const lines = transcriptGroups(captions).map(
    (g) => `[${fmtTime(captions[g[0]].startMs / 1000)}] ${g.map((i) => captions[i].text.trim()).join("")}`,
  );
  fs.writeFileSync(path.join(projectDir(name), "transcript.txt"), lines.join("\n") + "\n");
  return lines.length;
};

const PUNCT = /^[，。！？、；：,.!?;:「」『』（）()…—\s]$/;

/** 一句改過的文字重新分配到原本那句的時間：每個字平均分，標點黏在前一個字後面 */
const respace = (text: string, startMs: number, endMs: number): Caption[] => {
  const units: string[] = [];
  for (const ch of Array.from(text.trim())) {
    if (PUNCT.test(ch) && units.length) units[units.length - 1] += ch;
    else if (/[A-Za-z0-9]/.test(ch) && units.length && /[A-Za-z0-9]$/.test(units[units.length - 1])) units[units.length - 1] += ch;
    else units.push(ch);
  }
  const step = (endMs - startMs) / Math.max(1, units.length);
  return units.map((u, k) => {
    const s = Math.round(startMs + step * k);
    const e = Math.round(startMs + step * (k + 1));
    return { text: u, startMs: s, endMs: e, timestampMs: Math.round((s + e) / 2), confidence: 1 };
  });
};

/**
 * 使用者改了 transcript.txt（比 captions.json 新）→ 把改過的句子寫回 captions.json。
 * 沒改的句子保留原本逐字時間；改過的句子在原本的時間範圍內重新平均分配。
 */
export const applyTranscript = (name: string, force = false) => {
  const dir = projectDir(name);
  const txt = path.join(dir, "transcript.txt");
  const cap = path.join(dir, "captions.json");
  if (!fs.existsSync(txt) || !fs.existsSync(cap)) return 0;
  if (!force && fs.statSync(txt).mtimeMs <= fs.statSync(cap).mtimeMs) return 0;

  const captions = JSON.parse(fs.readFileSync(cap, "utf-8")) as Caption[];
  const groups = transcriptGroups(captions);
  const lines = fs
    .readFileSync(txt, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ sec: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() }));

  // 每一行對回原本的句子：用行首時間找最接近的那句
  const starts = groups.map((g) => captions[g[0]].startMs / 1000);
  const edits = new Map<number, string>();
  for (const l of lines) {
    let best = 0;
    starts.forEach((s, k) => {
      if (Math.abs(s - l.sec) < Math.abs(starts[best] - l.sec)) best = k;
    });
    if (Math.abs(starts[best] - l.sec) > 0.15) {
      console.warn(`⚠️ 找不到 [${fmtTime(l.sec)}] 這句的原始時間（行首時間不要改），略過：${l.text}`);
      continue;
    }
    edits.set(best, l.text);
  }

  let changed = 0;
  const out: Caption[] = [];
  groups.forEach((g, k) => {
    const old = g.map((i) => captions[i].text.trim()).join("");
    const text = edits.get(k);
    if (text === undefined || text === old) {
      g.forEach((i) => out.push(captions[i]));
      return;
    }
    changed++;
    if (text) out.push(...respace(text, captions[g[0]].startMs, captions[g[g.length - 1]].endMs));
  });

  fs.writeFileSync(cap, JSON.stringify(out, null, 1));
  if (changed) writeTranscript(name, out);
  else fs.utimesSync(cap, new Date(), new Date());
  return changed;
};

/** 每個專案都檢查一次逐字稿有沒有改過 */
export const applyAllTranscripts = () => {
  for (const name of syncProjectList()) {
    const n = applyTranscript(name);
    if (n) console.log(`✏️ ${name}：逐字稿改了 ${n} 句，已更新字幕`);
  }
};
