// npm run publish -- <專案名> [youtube|instagram|facebook|threads|all] [--yes]
// 把 out/<專案名>.mp4 發佈到各社群平台。標題、說明、標籤、排程寫在 project.json 的 publish
// 第一次使用要先設定 .env（見 README「社群發佈設定」）
import { exec } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import readline from "node:readline/promises";
import type { Project } from "../src/types";
import { ROOT, die, loadEnv, readProject } from "./lib";
import { syncManyChatRule } from "./manychat";

loadEnv();
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const yes = process.argv.includes("--yes");
const name = args[0] ?? die("用法：npm run publish -- 專案名 [youtube|instagram|facebook|threads|all]");
let target = (args[1] ?? "all").toLowerCase();
if (target === "yt") target = "youtube";
if (target === "ig") target = "instagram";
if (target === "fb") target = "facebook";

const validTargets = ["youtube", "instagram", "facebook", "threads", "all"];
if (!validTargets.includes(target)) {
  die("平台只能是 youtube (yt)、instagram (ig)、facebook (fb)、threads 或 all");
}

const p = readProject(name);
const video = path.join(ROOT, "out", `${name}.mp4`);
if (!fs.existsSync(video)) die(`找不到成品 ${path.relative(ROOT, video)}，先跑 npm run render -- ${name}`);

const SECRETS = path.join(ROOT, ".secrets");
const env = (k: string, hint: string) => process.env[k] || die(`.env 裡少了 ${k}\n   ${hint}`);

const textOf = (proj: Project) => {
  const pub = proj.publish ?? {};
  const title = (pub.title ?? proj.hook?.lines.map((l) => l.text).join(" ") ?? name).slice(0, 100);
  const tags = pub.tags ?? [];
  const hashtags = tags.map((t) => `#${t.replace(/^#/, "").replace(/\s+/g, "")}`).join(" ");
  return {
    title,
    description: pub.description ?? "",
    tags,
    hashtags,
    privacy: pub.privacy ?? "private",
    scheduleTime: pub.scheduleTime,
    videoUrl: pub.videoUrl,
  };
};

const parseScheduleUnix = (scheduleTime?: string): number | null => {
  if (!scheduleTime) return null;
  const d = new Date(scheduleTime);
  const ms = d.getTime();
  if (isNaN(ms)) {
    console.warn(`⚠️ 排程時間格式不正確 (${scheduleTime})，請使用 ISO 8601 或 YYYY-MM-DDTHH:mm:ss`);
    return null;
  }
  return Math.floor(ms / 1000);
};

// ---------- YouTube ----------
const YT_TOKEN = path.join(SECRETS, "youtube-token.json");

const openBrowser = (url: string) => {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start \"\"" : "xdg-open";
  exec(`${cmd} "${url}"`);
};

/** 第一次：開瀏覽器登入 Google、同意上傳權限，拿到 refresh token 存在 .secrets/ */
const youtubeLogin = async (clientId: string, clientSecret: string) => {
  const server = http.createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  const redirect = `http://127.0.0.1:${port}`;
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.upload",
      access_type: "offline",
      prompt: "consent",
    });
  console.log("🔑 第一次使用：瀏覽器會打開 Google 登入頁，登入要上傳的 YouTube 帳號並按允許");
  console.log(`   沒有自動打開就複製這個網址：\n   ${url}`);
  openBrowser(url);
  const code = await new Promise<string>((resolve, reject) => {
    server.on("request", (req, res) => {
      const q = new URL(req.url ?? "/", redirect).searchParams;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(q.get("code") ? "<h2>✅ 登入完成，可以關掉這個分頁</h2>" : "<h2>❌ 沒有授權</h2>");
      server.close();
      q.get("code") ? resolve(q.get("code") as string) : reject(new Error(q.get("error") ?? "沒有授權"));
    });
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const tok = (await res.json()) as { refresh_token?: string; error_description?: string };
  if (!tok.refresh_token) die(`Google 登入失敗：${tok.error_description ?? JSON.stringify(tok)}`);
  fs.mkdirSync(SECRETS, { recursive: true });
  fs.writeFileSync(YT_TOKEN, JSON.stringify({ refresh_token: tok.refresh_token }), { mode: 0o600 });
  return tok.refresh_token as string;
};

const youtubeAccessToken = async () => {
  const hint = "到 Google Cloud 建立「電腦版應用程式」的 OAuth 用戶端（步驟見 README）";
  const clientId = env("YOUTUBE_CLIENT_ID", hint);
  const clientSecret = env("YOUTUBE_CLIENT_SECRET", hint);
  const refresh = fs.existsSync(YT_TOKEN)
    ? (JSON.parse(fs.readFileSync(YT_TOKEN, "utf-8")) as { refresh_token: string }).refresh_token
    : await youtubeLogin(clientId, clientSecret);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ refresh_token: refresh, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }),
  });
  const tok = (await res.json()) as { access_token?: string; error?: string };
  if (!tok.access_token) {
    fs.rmSync(YT_TOKEN, { force: true });
    die(`YouTube 授權失效（${tok.error}），再跑一次會重新登入`);
  }
  return tok.access_token as string;
};

const toYouTube = async () => {
  const t = textOf(p);
  const token = await youtubeAccessToken();
  const size = fs.statSync(video).size;
  const scheduleUnix = parseScheduleUnix(t.scheduleTime);

  const status: Record<string, any> = {
    selfDeclaredMadeForKids: false,
  };
  if (scheduleUnix) {
    // YouTube Data API 要求有 publishAt 時 privacyStatus 必須是 private
    status.privacyStatus = "private";
    status.publishAt = new Date(scheduleUnix * 1000).toISOString();
    console.log(`⏰ YouTube 設定排程公開時間：${new Date(scheduleUnix * 1000).toLocaleString()}`);
  } else {
    status.privacyStatus = t.privacy;
  }

  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify({
      snippet: { title: t.title, description: [t.description, t.hashtags].filter(Boolean).join("\n\n"), tags: t.tags, categoryId: "22" },
      status,
    }),
  });
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) die(`YouTube 上傳失敗：${init.status} ${(await init.text()).slice(0, 400)}`);
  console.log("⬆️ 上傳到 YouTube 中...");
  const up = await fetch(uploadUrl as string, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: fs.readFileSync(video) });
  const json = (await up.json()) as { id?: string; error?: { message: string } };
  if (!json.id) die(`YouTube 上傳失敗：${json.error?.message ?? up.status}`);
  
  if (scheduleUnix) {
    console.log(`✅ YouTube：https://youtube.com/shorts/${json.id}（已排程於 ${new Date(scheduleUnix * 1000).toLocaleString()} 自動公開）`);
  } else {
    console.log(`✅ YouTube：https://youtube.com/shorts/${json.id}（${t.privacy === "public" ? "已公開" : t.privacy === "unlisted" ? "不公開（有連結的人能看）" : "私人，到 YouTube Studio 確認後再公開"}）`);
  }
  return json.id as string;
};

// ---------- Instagram ----------
const toInstagram = async () => {
  const hint = "要有 IG 專業帳號＋Meta 開發者應用程式，步驟見 README";
  const user = env("IG_USER_ID", hint);
  const token = env("IG_ACCESS_TOKEN", hint);
  const G = `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION ?? "v21.0"}`;
  const t = textOf(p);
  const caption = [t.title, t.description, t.hashtags].filter(Boolean).join("\n\n").slice(0, 2200);

  const create = await fetch(`${G}/${user}/media`, {
    method: "POST",
    body: new URLSearchParams({ media_type: "REELS", upload_type: "resumable", caption, share_to_feed: "true", access_token: token }),
  });
  const c = (await create.json()) as { id?: string; uri?: string; error?: { message: string } };
  if (!c.id) die(`IG 建立失敗：${c.error?.message ?? create.status}`);

  console.log("⬆️ 上傳到 Instagram 中...");
  const size = fs.statSync(video).size;
  const up = await fetch(c.uri ?? `https://rupload.facebook.com/ig-api-upload/${process.env.IG_GRAPH_VERSION ?? "v21.0"}/${c.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(size) },
    body: fs.readFileSync(video),
  });
  if (!up.ok) die(`IG 上傳失敗：${up.status} ${(await up.text()).slice(0, 400)}`);

  // 等 IG 處理影片
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = (await (await fetch(`${G}/${c.id}?fields=status_code,status&access_token=${token}`)).json()) as { status_code?: string; status?: string };
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") die(`IG 處理影片失敗：${s.status}`);
    process.stdout.write(`\r   處理中...${(i + 1) * 5} 秒`);
  }
  process.stdout.write("\n");
  const pub = await fetch(`${G}/${user}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: c.id as string, access_token: token }) });
  const pj = (await pub.json()) as { id?: string; error?: { message: string } };
  if (!pj.id) die(`IG 發佈失敗：${pj.error?.message ?? pub.status}`);
  const link = (await (await fetch(`${G}/${pj.id}?fields=permalink&access_token=${token}`)).json()) as { permalink?: string };
  console.log(`✅ Instagram：${link.permalink ?? pj.id}（IG 發佈後就是公開的）`);
  return pj.id as string;
};

// ---------- Facebook Reels ----------
const toFacebook = async () => {
  const hint = "要有 FB 粉絲專頁 ID 與具備發布權限的 Page Access Token（見 README）";
  const pageId = env("FB_PAGE_ID", hint);
  const token = env("FB_PAGE_ACCESS_TOKEN", hint);
  const G = `https://graph.facebook.com/${process.env.FB_GRAPH_VERSION ?? "v21.0"}`;
  const t = textOf(p);
  const description = [t.title, t.description, t.hashtags].filter(Boolean).join("\n\n");

  console.log("⬆️ 正在向 Facebook 初始化 Reels 上傳...");
  const initRes = await fetch(`${G}/${pageId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "start",
      access_token: token,
    }),
  });
  const init = (await initRes.json()) as { video_id?: string; upload_url?: string; error?: { message: string } };
  if (!init.video_id || !init.upload_url) die(`Facebook 建立 Reels 失敗：${init.error?.message ?? initRes.statusText}`);
  const uploadUrl = init.upload_url as string;
  const videoId = init.video_id as string;

  console.log("⬆️ 上傳影片到 Facebook 中...");
  const size = fs.statSync(video).size;
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      offset: "0",
      file_size: String(size),
    },
    body: fs.readFileSync(video),
  });
  if (!up.ok) die(`Facebook 影片資料上傳失敗：${up.status} ${(await up.text()).slice(0, 400)}`);

  console.log("⬆️ 正在完成 Facebook 發佈設定...");
  const scheduleUnix = parseScheduleUnix(t.scheduleTime);
  const finishParams: Record<string, string> = {
    upload_phase: "finish",
    video_id: videoId,
    access_token: token,
    description,
    title: t.title,
  };

  if (scheduleUnix) {
    finishParams.video_state = "SCHEDULED";
    finishParams.scheduled_publish_time = String(scheduleUnix);
  } else {
    finishParams.video_state = "PUBLISHED";
  }

  const finishRes = await fetch(`${G}/${pageId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(finishParams),
  });
  const finish = (await finishRes.json()) as { success?: boolean; error?: { message: string } };
  if (!finish.success) die(`Facebook 完成發佈失敗：${finish.error?.message ?? JSON.stringify(finish)}`);

  if (scheduleUnix) {
    console.log(`✅ Facebook Reels：已排程於 ${new Date(scheduleUnix * 1000).toLocaleString()} 自動發佈（Video ID: ${init.video_id}）`);
  } else {
    console.log(`✅ Facebook Reels：發佈成功（Video ID: ${init.video_id}）`);
  }
  return init.video_id as string;
};

// ---------- Threads ----------
const toThreads = async () => {
  const hint = "要有 Threads User ID 與具備 threads_content_publish 權限的 Access Token（見 README）";
  const userId = env("THREADS_USER_ID", hint);
  const token = env("THREADS_ACCESS_TOKEN", hint);
  const t = textOf(p);

  const videoUrl: string | null = t.videoUrl || (process.env.PUBLIC_VIDEO_BASE_URL ? `${process.env.PUBLIC_VIDEO_BASE_URL.replace(/\/$/, "")}/${name}.mp4` : null);
  if (!videoUrl) {
    die(`Threads 發佈失敗：Threads API 必須透過公開 URL 下載影片。\n` +
        `請在 project.json 的 publish.videoUrl 填入外部網址，\n` +
        `或在 .env 設定 PUBLIC_VIDEO_BASE_URL（如 https://your-bucket.r2.dev）`);
  }

  const G = "https://graph.threads.net/v1.0";
  // Threads 限制文字最多 500 字元
  const text = [t.title, t.description, t.hashtags].filter(Boolean).join("\n\n").slice(0, 500);

  console.log("⬆️ 正在向 Threads 建立影片容器...");
  const createRes = await fetch(`${G}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "VIDEO",
      video_url: videoUrl as string,
      text,
      access_token: token,
    }),
  });
  const container = (await createRes.json()) as { id?: string; error?: { message: string } };
  if (!container.id) die(`Threads 建立容器失敗：${container.error?.message ?? createRes.statusText}`);
  const containerId = container.id as string;

  console.log("⬆️ 等待 Threads 轉碼處理影片...");
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const sRes = await fetch(`${G}/${containerId}?fields=status,status_code&access_token=${token}`);
    const s = (await sRes.json()) as { status_code?: string; status?: string; error?: { message: string } };
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") die(`Threads 處理影片失敗：${s.status ?? s.error?.message}`);
    process.stdout.write(`\r   處理中...${(i + 1) * 5} 秒`);
  }
  process.stdout.write("\n");

  const pubRes = await fetch(`${G}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: token,
    }),
  });
  const pub = (await pubRes.json()) as { id?: string; error?: { message: string } };
  if (!pub.id) die(`Threads 發佈失敗：${pub.error?.message ?? pubRes.statusText}`);

  console.log(`✅ Threads：發佈成功（Post ID: ${pub.id}）`);
  return pub.id as string;
};

// ---------- 開始 ----------
const t = textOf(p);
console.log(`📦 ${path.relative(ROOT, video)}`);
console.log(`   標題：${t.title}`);
if (t.description) console.log(`   說明：${t.description.replace(/\n/g, " ").slice(0, 80)}`);
if (t.hashtags) console.log(`   標籤：${t.hashtags}`);
if (t.scheduleTime) console.log(`   排程時間：${t.scheduleTime}`);
console.log(`   指定發布目標：${target}`);

if (!yes) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question("確定要發佈嗎？(y/N) ");
  rl.close();
  if (a.trim().toLowerCase() !== "y") die("取消，沒有發佈");
}

const publishedPostIds: string[] = [];

if (target === "youtube") {
  publishedPostIds.push(await toYouTube());
} else if (target === "instagram") {
  publishedPostIds.push(await toInstagram());
} else if (target === "facebook") {
  publishedPostIds.push(await toFacebook());
} else if (target === "threads") {
  publishedPostIds.push(await toThreads());
} else if (target === "all") {
  // all 模式：依序執行已設定的平台
  let publishedAny = false;

  // 1. YouTube
  if (process.env.YOUTUBE_CLIENT_ID || fs.existsSync(YT_TOKEN)) {
    try {
      publishedPostIds.push(await toYouTube());
      publishedAny = true;
    } catch (e: any) {
      console.error(`❌ YouTube 發佈失敗：${e.message}`);
    }
  } else {
    console.log("ℹ️ .env 未設定 YOUTUBE_CLIENT_ID，略過 YouTube");
  }

  // 2. Instagram
  if (process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN) {
    try {
      publishedPostIds.push(await toInstagram());
      publishedAny = true;
    } catch (e: any) {
      console.error(`❌ Instagram 發佈失敗：${e.message}`);
    }
  } else {
    console.log("ℹ️ .env 未設定 IG_USER_ID / IG_ACCESS_TOKEN，略過 Instagram");
  }

  // 3. Facebook
  if (process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN) {
    try {
      publishedPostIds.push(await toFacebook());
      publishedAny = true;
    } catch (e: any) {
      console.error(`❌ Facebook 發佈失敗：${e.message}`);
    }
  } else {
    console.log("ℹ️ .env 未設定 FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN，略過 Facebook");
  }

  // 4. Threads
  if (process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN) {
    try {
      publishedPostIds.push(await toThreads());
      publishedAny = true;
    } catch (e: any) {
      console.error(`❌ Threads 發佈失敗：${e.message}`);
    }
  } else {
    console.log("ℹ️ .env 未設定 THREADS_USER_ID / THREADS_ACCESS_TOKEN，略過 Threads");
  }

  if (!publishedAny) {
    die("沒有任何平台的金鑰設定完成，請先編輯 .env 填入要發佈的平台資料");
  }
}

// 若有設定 autoReply，自動將留言私訊規則（含本次發佈的貼文/影片 ID）同步至 like-manychat
if (p.publish?.autoReply) {
  try {
    await syncManyChatRule(name, publishedPostIds);
  } catch (e: any) {
    console.warn(`⚠️ like-manychat 同步失敗：${e.message}`);
  }
}

