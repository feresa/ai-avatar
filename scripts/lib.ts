// 指令共用的小工具
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
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
    `// 自動產生，不要手動改（也不進 git）：public/projects/ 底下的專案清單\nexport const PROJECTS: string[] = ${JSON.stringify(names)};\n`,
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
    ensureSourceSize(name);
    const n = applyTranscript(name);
    if (n) console.log(`✏️ ${name}：逐字稿改了 ${n} 句，已更新字幕`);
  }
};

/** 讀專案根目錄的 .env（API 金鑰放這裡，不會進 git） */
export const loadEnv = () => {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
};

// ---------- 講稿對齊：字幕用講稿的字（100% 正確），語音辨識只拿來對時間 ----------

const SKIP = /[\s，。！？、；：,.!?;:「」『』（）()…—~～"'“”‘’《》〈〉\-]/;
// 常見異體字、全形半形：比對時視為同一個字
const SAME: Record<string, string> = { 臺: "台", 裏: "裡", 着: "著", 爲: "為", 綫: "線", 峯: "峰", 羣: "群", 衆: "眾" };
const norm = (ch: string) => {
  const c = ch.normalize("NFKC").toLowerCase();
  return SAME[c] ?? c;
};

/**
 * 講稿和語音辨識逐字對齊（最長共同子序列）。
 * 對到的字用辨識的時間；沒對到的字（辨識聽錯、漏聽）在前後對到的字之間平均分配。
 */
export const alignScript = (whisper: Caption[], script: string) => {
  // 辨識結果拆成一個一個字，每個字分到所屬詞的一段時間
  const heard: { ch: string; start: number; end: number }[] = [];
  for (const c of whisper) {
    const chars = Array.from(c.text.trim()).filter((ch) => !SKIP.test(ch));
    const step = (c.endMs - c.startMs) / Math.max(1, chars.length);
    chars.forEach((ch, k) => heard.push({ ch: norm(ch), start: c.startMs + step * k, end: c.startMs + step * (k + 1) }));
  }
  // 講稿：每個字一個單位，標點黏在前一個字後面；英文、數字連在一起
  const units: { text: string; key: string }[] = [];
  for (const ch of Array.from(script.replace(/\r/g, ""))) {
    if (SKIP.test(ch)) {
      if (units.length && !/\s/.test(ch)) units[units.length - 1].text += ch;
      continue;
    }
    units.push({ text: ch, key: norm(ch) });
  }
  const n = units.length;
  const m = heard.length;
  if (!n) return { captions: [] as Caption[], matched: 0, total: 0 };

  // 最長共同子序列
  const W = m + 1;
  const dp = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i * W + j] = units[i].key === heard[j].ch ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
  const match = new Array<number>(n).fill(-1);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (units[i].key === heard[j].ch) match[i++] = j++;
    else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
    else j++;
  }

  // 每個講稿字的時間
  const times: { start: number; end: number }[] = new Array(n);
  const first = heard[0]?.start ?? 0;
  const last = heard[m - 1]?.end ?? n * 250;
  for (let i = 0; i < n; ) {
    if (match[i] >= 0) {
      const h = heard[match[i]];
      times[i++] = { start: h.start, end: h.end };
      continue;
    }
    // 一段連續沒對到的字：夾在前後對到的字中間平均分
    let k = i;
    while (k < n && match[k] < 0) k++;
    const from = i > 0 ? times[i - 1].end : k < n ? Math.min(first, heard[match[k]].start) : first;
    const to = k < n ? heard[match[k]].start : last;
    const span = Math.max(0, to - from);
    const step = span / (k - i);
    for (let x = i; x < k; x++) times[x] = { start: from + step * (x - i), end: from + step * (x - i + 1) };
    i = k;
  }

  const captions: Caption[] = units.map((u, i) => ({
    text: u.text,
    startMs: Math.round(times[i].start),
    endMs: Math.round(Math.max(times[i].end, times[i].start + 1)),
    timestampMs: Math.round((times[i].start + times[i].end) / 2),
    confidence: match[i] >= 0 ? 1 : 0.5,
  }));
  return { captions, matched: match.filter((x) => x >= 0).length, total: n };
};

/** 專案資料夾裡有講稿（script.txt）就用講稿當字幕；回傳對齊率，沒有講稿回傳 null */
export const applyScript = (name: string) => {
  const dir = projectDir(name);
  const scriptFile = path.join(dir, "script.txt");
  const raw = path.join(dir, "captions.whisper.json");
  if (!fs.existsSync(scriptFile) || !fs.existsSync(raw)) return null;
  const whisper = JSON.parse(fs.readFileSync(raw, "utf-8")) as Caption[];
  const { captions, matched, total } = alignScript(whisper, fs.readFileSync(scriptFile, "utf-8"));
  fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify(captions, null, 1));
  writeTranscript(name, captions);
  return { rate: total ? matched / total : 0, total };
};

/** 找出影片裡的停頓：每 20ms 算一次音量，比說話音量（前 10% 大聲）低 20dB 以上、持續 minPause 秒以上 */
export const findPauses = (video: string, minPause: number) => {
  const wav = path.join(os.tmpdir(), `pauses-${process.pid}.wav`);
  remotionTool("ffmpeg", ["-y", "-v", "error", "-i", video, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
  if (!fs.existsSync(wav)) die("讀不到影片的聲音");
  const buf = fs.readFileSync(wav);
  fs.rmSync(wav);
  const dataAt = buf.indexOf("data") + 8; // 跳過 WAV 檔頭
  const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + dataAt, buf.byteOffset + dataAt + Math.floor((buf.length - dataAt) / 2) * 2));
  if (!pcm.length) die("讀不到影片的聲音");
  const WIN = 320; // 20ms
  const db: number[] = [];
  for (let i = 0; i + WIN <= pcm.length; i += WIN) {
    let sum = 0;
    for (let k = i; k < i + WIN; k++) sum += pcm[k] * pcm[k];
    db.push(10 * Math.log10(sum / WIN + 1e-9));
  }
  const loud = [...db].sort((a, b) => a - b)[Math.floor(db.length * 0.9)];
  const quiet = db.map((d) => d < loud - 20);
  const pauses: { start: number; end: number }[] = [];
  let from = -1;
  for (let i = 0; i <= quiet.length; i++) {
    const q = quiet[i] ?? false;
    if (q && from < 0) from = i;
    if (!q && from >= 0) {
      if ((i - from) * 0.02 >= minPause) pauses.push({ start: from * 0.02, end: i * 0.02 });
      from = -1;
    }
  }
  return pauses;
};

/** "1:23.5" 或 "83.5" → 秒 */
export const parseTime = (s: string) => {
  const m = s.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) die(`看不懂的時間：${s}（用 83.5 或 1:23.5）`);
  return Number(m![1] ?? 0) * 60 + Number(m![2]);
};

/** 原始影片的寬高沒填就自動量（直式裁切對準臉要用） */
export const ensureSourceSize = (name: string) => {
  const p = readProject(name);
  if (p.sourceWidth && p.sourceHeight) return p;
  const r = remotionTool("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation", "-of", "json",
    path.join(projectDir(name), p.video),
  ]);
  try {
    const s = (JSON.parse(r.stdout) as { streams: { width: number; height: number; side_data_list?: { rotation?: number }[] }[] }).streams[0];
    // 手機直拍的影片常常是「橫的畫面＋旋轉 90 度」
    const rot = Math.abs(s.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) % 180;
    const next = { ...p, sourceWidth: rot === 90 ? s.height : s.width, sourceHeight: rot === 90 ? s.width : s.height };
    writeProject(name, next);
    return next;
  } catch {
    return p;
  }
};

/** 預覽畫面（npm run studio）開著時會佔用 3000 埠，輸出要用另一個沒人用的埠，不然會連到預覽畫面 */
export const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
