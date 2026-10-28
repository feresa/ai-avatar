// npm run panel
// 剪片控制台：在瀏覽器裡看每支影片做到哪一步，勾要做的步驟直接跑，或產生提示詞交給 Claude
// 只開在自己電腦（127.0.0.1），別人連不進來
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { PROJECTS_DIR, ROOT, readProject } from "./lib";

const PORT = Number(process.env.PANEL_PORT ?? 3210);
const OUT = path.join(ROOT, "out");
const NAME = /^[a-zA-Z0-9-]+$/;
const hasClaude = spawnSync("claude", ["--version"], { encoding: "utf-8" }).status === 0;

// ---------- 每支影片的狀態 ----------
const exists = (...p: string[]) => fs.existsSync(path.join(...p));
const mtime = (f: string) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);

const projectState = (name: string) => {
  const dir = path.join(PROJECTS_DIR, name);
  const p = readProject(name);
  const projMtime = mtime(path.join(dir, "project.json"));
  const outs = fs.existsSync(OUT)
    ? fs
        .readdirSync(OUT)
        .filter((f) => f === `${name}.mp4` || (p.variants ?? []).some((v) => f === `${name}-${v.name}.mp4`))
        .map((f) => ({ file: f, stale: mtime(path.join(OUT, f)) < projMtime, at: mtime(path.join(OUT, f)) }))
    : [];
  const missingImages = (p.inserts ?? []).filter((i) => !exists(dir, i.src)).length;
  return {
    name,
    durationSec: p.durationSec,
    done: {
      video: exists(dir, p.video),
      transcribe: exists(dir, "captions.json"),
      script: exists(dir, "script.txt"),
      align: exists(dir, "script.txt") && exists(dir, "captions.whisper.json"),
      lead: p.captions?.lead !== undefined,
      face: !!p.face,
      cuts: !!p.keep?.length,
      cutout: (!!p.matte && exists(dir, p.matte)) || !!p.greenScreen,
      music: !!p.music,
      plan: !!(p.hook || p.cards?.length || p.stickers?.length),
      images: (p.inserts ?? []).length > 0 && missingImages === 0,
      publishText: !!p.publish,
      render: outs.some((o) => o.file === `${name}.mp4`),
    },
    missingImages,
    variants: (p.variants ?? []).map((v) => v.name),
    outs,
  };
};

const state = () => ({
  claude: hasClaude,
  running: job ? { label: job.label } : null,
  projects: fs
    .readdirSync(PROJECTS_DIR)
    .filter((d) => NAME.test(d) && exists(PROJECTS_DIR, d, "project.json"))
    .map((d) => {
      try {
        return projectState(d);
      } catch (e) {
        return { name: d, error: (e as Error).message };
      }
    }),
});

// ---------- 可以直接跑的步驟（只准跑這些） ----------
type Step = { id: string; args?: Record<string, string | string[]> };
const str = (v: unknown, re = /^[\w.\-:/ ~一-鿿]*$/) => {
  const s = String(v ?? "").trim();
  if (!re.test(s)) throw new Error(`參數有怪字元：${s}`);
  return s;
};
const command = (name: string, s: Step): string[] => {
  const a = s.args ?? {};
  switch (s.id) {
    case "transcribe":
    case "align":
    case "lead":
    case "face":
    case "matte":
    case "green":
    case "images":
    case "check":
    case "render":
      return [s.id, name];
    case "cuts":
      return ["cuts", name, ...(a.min ? [str(a.min, /^[\d.]+$/)] : [])];
    case "music":
      return ["music", name, str(a.style ?? "calm", /^(calm|warm|upbeat)$/)];
    case "matteFile":
      return ["matte", name, "--file", str(a.file, /^[^\0]+\.webm$/i)];
    case "variants":
      return ["variants", name, ...((a.names as string[] | undefined) ?? []).map((v) => str(v, NAME))];
    case "publish":
      return ["publish", name, str(a.platform ?? "all", /^(youtube|instagram|facebook|threads|all)$/), "--yes"];
    case "clip":
      return ["clip", name, str(a.newName, NAME), str(a.start, /^[\d.:]+$/), str(a.end, /^[\d.:]+$/)];
    default:
      throw new Error(`不認得的步驟：${s.id}`);
  }
};
const LABEL: Record<string, string> = {
  transcribe: "上字幕",
  align: "講稿對齊",
  lead: "字幕對時",
  face: "找臉",
  cuts: "剪停頓",
  matte: "AI 去背",
  matteFile: "放入 Colab 去背檔",
  green: "綠幕去背",
  music: "背景音樂",
  images: "產生插圖",
  check: "檢查畫面",
  render: "輸出成品",
  variants: "輸出多版本",
  publish: "發佈",
  clip: "剪出短片",
  new: "建立專案",
  claude: "Claude 處理",
};

// ---------- 執行佇列 + 即時輸出（SSE） ----------
let job: { label: string; child?: ChildProcess; stopped?: boolean } | null = null;
const clients = new Set<http.ServerResponse>();
let history = "";
const emit = (type: string, data: unknown) => {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  if (type === "log") history = (history + (data as string)).slice(-200_000);
  for (const c of clients) c.write(msg);
};

const runOne = (cmd: string, args: string[]) =>
  new Promise<number>((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, FORCE_COLOR: "0" } });
    if (job) job.child = child;
    child.stdout.on("data", (d: Buffer) => emit("log", d.toString()));
    child.stderr.on("data", (d: Buffer) => emit("log", d.toString()));
    child.on("error", (e) => emit("log", `❌ ${e.message}\n`));
    child.on("close", (code) => resolve(code ?? 1));
  });

const runQueue = async (label: string, list: { label: string; cmd: string; args: string[] }[]) => {
  job = { label };
  emit("state", state());
  for (const [i, it] of list.entries()) {
    if (job.stopped) break;
    emit("step", { i, label: it.label, status: "running" });
    emit("log", `\n━━━ ${it.label} ━━━\n`);
    const code = await runOne(it.cmd, it.args);
    emit("step", { i, label: it.label, status: code === 0 ? "ok" : "fail" });
    if (code !== 0) {
      emit("log", job.stopped ? "\n⏹ 已停止\n" : `\n❌ ${it.label} 失敗，後面的步驟先不跑\n`);
      break;
    }
  }
  job = null;
  emit("done", {});
  emit("state", state());
};

// ---------- 伺服器 ----------
const body = (req: http.IncomingMessage) =>
  new Promise<any>((resolve, reject) => {
    let s = "";
    req.on("data", (d) => (s += d));
    req.on("end", () => {
      try {
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
const json = (res: http.ServerResponse, code: number, data: unknown) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
};

const sendVideo = (req: http.IncomingMessage, res: http.ServerResponse, file: string) => {
  const size = fs.statSync(file).size;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (!m) {
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": size, "Accept-Ranges": "bytes" });
    return fs.createReadStream(file).pipe(res);
  }
  const start = m[1] ? Number(m[1]) : 0;
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  res.writeHead(206, { "Content-Type": "video/mp4", "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes" });
  fs.createReadStream(file, { start, end }).pipe(res);
};

const server = http.createServer(async (req, res) => {
  // 只接受從本機網址打開的頁面（擋掉其他網站偷偷呼叫）
  const host = req.headers.host ?? "";
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return json(res, 403, { error: "只能從本機使用" });
  const origin = req.headers.origin;
  if (req.method === "POST" && origin && new URL(origin).host !== host) return json(res, 403, { error: "只能從本機使用" });

  const url = new URL(req.url ?? "/", `http://${host}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(ROOT, "scripts", "panel.html")));
    }
    if (req.method === "GET" && url.pathname === "/api/state") return json(res, 200, state());
    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(`event: log\ndata: ${JSON.stringify(history)}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/out/")) {
      const f = path.basename(decodeURIComponent(url.pathname.slice(5)));
      const file = path.join(OUT, f);
      if (!f.endsWith(".mp4") || !fs.existsSync(file)) return json(res, 404, { error: "沒有這個檔案" });
      return sendVideo(req, res, file);
    }
    if (req.method === "GET" && url.pathname === "/api/transcript") {
      const name = str(url.searchParams.get("name"), NAME);
      const f = path.join(PROJECTS_DIR, name, "transcript.txt");
      return json(res, 200, { text: fs.existsSync(f) ? fs.readFileSync(f, "utf-8") : "" });
    }

    if (req.method !== "POST") return json(res, 404, { error: "找不到" });
    const b = await body(req);

    if (url.pathname === "/api/stop") {
      if (job) {
        job.stopped = true;
        job.child?.kill("SIGINT");
      }
      return json(res, 200, { ok: true });
    }
    if (job) return json(res, 409, { error: `「${job.label}」還在跑，等它跑完或先按停止` });

    if (url.pathname === "/api/run") {
      const name = str(b.name, NAME);
      if (!exists(PROJECTS_DIR, name, "project.json")) throw new Error(`找不到專案：${name}`);
      const steps: Step[] = b.steps ?? [];
      if (!steps.length) throw new Error("沒有勾任何步驟");
      if (typeof b.script === "string" && b.script.trim()) fs.writeFileSync(path.join(PROJECTS_DIR, name, "script.txt"), b.script.trim() + "\n");
      const list = steps.map((s) => ({ label: LABEL[s.id] ?? s.id, cmd: "npm", args: ["run", "-s", ...command(name, s).flatMap((x, i) => (i === 0 ? [x, "--"] : [x]))] }));
      runQueue(`${name}：${list.map((l) => l.label).join(" → ")}`, list);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/api/new") {
      const name = str(b.name, NAME);
      const video = String(b.video ?? "").trim().replace(/^['"]|['"]$/g, "").replace(/^~(?=\/)/, process.env.HOME ?? "~");
      if (!fs.existsSync(video)) throw new Error(`找不到影片：${video}`);
      const args = ["run", "-s", "new", "--", name, video];
      const then = [{ label: "建立專案", cmd: "npm", args }];
      if (b.transcribe) then.push({ label: "上字幕", cmd: "npm", args: ["run", "-s", "transcribe", "--", name] });
      runQueue(`${name}：建立專案`, then);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/api/studio") {
      const child = spawn("npm", ["run", "-s", "studio"], { cwd: ROOT, detached: true, stdio: "ignore" });
      child.unref();
      return json(res, 200, { ok: true, url: "http://localhost:3000" });
    }
    if (url.pathname === "/api/claude") {
      if (!hasClaude) throw new Error("這台電腦找不到 claude 指令（Claude Code）");
      const prompt = String(b.prompt ?? "").trim();
      if (!prompt) throw new Error("提示詞是空的");
      runQueue("Claude 處理中", [
        {
          label: "Claude 處理",
          cmd: "claude",
          args: ["-p", prompt, "--permission-mode", "acceptEdits", "--disallowedTools", "Bash(npm run publish*)", "--allowedTools", "Read", "Edit", "Write", "Glob", "Grep", "Bash(npm run *)", "Bash(npx remotion *)"],
        },
      ]);
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: "找不到" });
  } catch (e) {
    return json(res, 400, { error: (e as Error).message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  console.log(`🎬 剪片控制台：${url}（關掉按 Ctrl+C）`);
  if (!process.env.PANEL_NO_OPEN) spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
});
