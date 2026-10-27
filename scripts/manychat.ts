// npm run manychat -- <專案名>
// 把 project.json 裡的 autoReply 設定同步到 Vercel 上的 like-manychat
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AutoReply, Project } from "../src/types";
import { ROOT, die, loadEnv, readProject } from "./lib";

loadEnv();

const SECRETS = path.join(ROOT, ".secrets");
const SESSION_FILE = path.join(SECRETS, "like-manychat-session.json");

const env = (k: string, hint: string) => process.env[k] || die(`.env 裡少了 ${k}\n   ${hint}`);

interface SessionData {
  cookie: string;
  expiresAt: number;
}

const getSavedSession = (): string | null => {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8")) as SessionData;
    if (Date.now() < data.expiresAt) return data.cookie;
  } catch {}
  return null;
};

const saveSession = (cookie: string) => {
  fs.mkdirSync(SECRETS, { recursive: true });
  // 30 天效期
  const expiresAt = Date.now() + 29 * 86400 * 1000;
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookie, expiresAt }), { mode: 0o600 });
};

/** 登入 like-manychat 取得 Session Cookie */
const login = async (baseUrl: string): Promise<string> => {
  const email = env("LIKE_MANYCHAT_EMAIL", "like-manychat 的登入帳號（Email）");
  const password = env("LIKE_MANYCHAT_PASSWORD", "like-manychat 的登入密碼");

  console.log(`🔐 正在登入 like-manychat (${baseUrl})...`);
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    die(`like-manychat 登入失敗 (${res.status})：${text}`);
  }

  // 從 Set-Cookie 取得 sid=<token>
  const setCookie = res.headers.get("set-cookie");
  const sidMatch = (setCookie ?? "").match(/sid=([^;]+)/);
  if (!sidMatch || !sidMatch[1]) {
    die("登入成功但未收到 Session Cookie，請確認 like-manychat 設定");
  }

  const token = sidMatch ? sidMatch[1] : "";
  const cookie = `sid=${token}`;
  saveSession(cookie);
  return cookie;
};

/** 取得有效的 Cookie（已過期會自動重新登入） */
const getAuthCookie = async (baseUrl: string): Promise<string> => {
  const saved = getSavedSession();
  if (saved) return saved;
  return await login(baseUrl);
};

export interface SyncResult {
  ok: boolean;
  ruleId?: number;
  action: "created" | "updated" | "skipped";
  name: string;
  postId?: string;
}

/** 將專案的 autoReply 同步到 like-manychat */
export const syncManyChatRule = async (projectName: string, extraPostIds: string[] = []): Promise<SyncResult> => {
  const rawBaseUrl = process.env.LIKE_MANYCHAT_URL;
  if (!rawBaseUrl) {
    console.log("ℹ️ .env 未設定 LIKE_MANYCHAT_URL，略過 like-manychat 同步");
    return { ok: false, action: "skipped", name: projectName };
  }
  const baseUrl = rawBaseUrl.replace(/\/$/, "");

  const p = readProject(projectName);
  const autoReply = p.publish?.autoReply;
  if (!autoReply || !autoReply.keyword || !autoReply.replyText) {
    console.log(`ℹ️ 專案「${projectName}」未在 project.json 設定 publish.autoReply，略過同步`);
    return { ok: false, action: "skipped", name: projectName };
  }

  let cookie = await getAuthCookie(baseUrl);

  // 取得目前所有規則
  let rulesRes = await fetch(`${baseUrl}/api/rules`, {
    headers: { Cookie: cookie },
  });

  // 若 Token 失效則重新登入一次
  if (rulesRes.status === 401) {
    cookie = await login(baseUrl);
    rulesRes = await fetch(`${baseUrl}/api/rules`, {
      headers: { Cookie: cookie },
    });
  }

  if (!rulesRes.ok) {
    die(`like-manychat 讀取規則清單失敗 (${rulesRes.status})：${await rulesRes.text()}`);
  }

  const existingRules = (await rulesRes.json()) as Array<{
    id: number;
    name: string;
    keywords: string;
    post_id?: string;
  }>;

  const ruleName = autoReply.name || `${p.publish?.title || projectName} - 留言自動私訊`;

  // 只用規則名稱比對：同一支影片才更新，不同影片各自一條（關鍵字一樣也不會蓋掉別支影片的規則）
  const match = existingRules.find((r) => r.name === ruleName);
  const myKeywords = autoReply.keyword.split(/[,，]/).map((k) => k.trim()).filter(Boolean);
  const sameKeyword = existingRules.filter(
    (r) => r.id !== match?.id && r.keywords.split(/[,，]/).some((k) => myKeywords.includes(k.trim()))
  );
  if (sameKeyword.length)
    console.log(
      `ℹ️ 其他規則也有相同關鍵字：${sameKeyword.map((r) => `「${r.name}」`).join("、")}（不會被蓋掉；有指定貼文 ID 的話各自只回自己的貼文）`
    );

  // 合併 post_id（來自 project.json、既有規則、以及本次發佈新產生的貼文/影片 ID）
  const mergedPostIds = [
    ...new Set(
      [
        ...(autoReply.postId ? autoReply.postId.split(/[,，]/) : []),
        ...(match?.post_id ? match.post_id.split(/[,，]/) : []),
        ...extraPostIds,
      ]
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ].join(",");

  const rulePayload = {
    name: ruleName,
    channel: autoReply.channel || "comment",
    match_type: autoReply.matchType || "contains",
    keywords: autoReply.keyword,
    post_id: mergedPostIds,
    reply_text: autoReply.replyText,
    public_reply: autoReply.publicReply || "已私訊你囉！請查看你的小盒子信箱～",
    quick_replies: autoReply.quickReplies || "",
    tag: autoReply.tag || "",
    priority: 10,
    enabled: 1,
  };

  const postHint = mergedPostIds ? `，指定貼文：【${mergedPostIds}】` : "";

  if (match) {
    // 更新既有規則
    const updateRes = await fetch(`${baseUrl}/api/rules/${match.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(rulePayload),
    });

    if (!updateRes.ok) {
      die(`更新規則失敗 (${updateRes.status})：${await updateRes.text()}`);
    }

    console.log(`✅ like-manychat：已更新規則「${ruleName}」（ID: ${match.id}，關鍵字：【${autoReply.keyword}】${postHint}）`);
    return { ok: true, ruleId: match.id, action: "updated", name: ruleName, postId: mergedPostIds };
  } else {
    // 新增規則
    const createRes = await fetch(`${baseUrl}/api/rules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(rulePayload),
    });

    if (!createRes.ok) {
      die(`新增規則失敗 (${createRes.status})：${await createRes.text()}`);
    }

    const created = (await createRes.json()) as { id: number };
    console.log(`✅ like-manychat：已新增規則「${ruleName}」（ID: ${created.id}，關鍵字：【${autoReply.keyword}】${postHint}）`);
    return { ok: true, ruleId: created.id, action: "created", name: ruleName, postId: mergedPostIds };
  }
};

// 直接從命令列執行
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs.filter((a) => !a.startsWith("--"));
  const postFlag = rawArgs.find((a) => a.startsWith("--post="));
  const extraPosts = postFlag ? postFlag.slice("--post=".length).split(/[,，]/).filter(Boolean) : [];
  const projectName = args[0] ?? die("用法：npm run manychat -- <專案名> [--post=貼文ID]");
  await syncManyChatRule(projectName, extraPosts);
}
