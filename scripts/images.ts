// npm run images -- <專案名>
// 自動產生插圖：project.json 的 inserts 裡有 prompt（AI 畫圖）或 stock（圖庫照片），而且圖還不存在，就自動產生
//   AI 畫圖：.env 有 OPENAI_API_KEY 用 OpenAI；沒有就用免費的 Pollinations
//   圖庫照片：.env 要有 PEXELS_API_KEY（免費申請：https://www.pexels.com/api/）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { die, loadEnv, projectDir, readProject } from "./lib";

const STYLE = "，直式構圖，溫暖自然光，乾淨簡約，畫面中不要有文字";

const save = async (res: Response, file: string) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}：${(await res.text()).slice(0, 300)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
};

const fromOpenAI = async (prompt: string, file: string) => {
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1", prompt: prompt + STYLE, size: "1024x1536", n: 1 }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}：${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
  const d = json.data[0];
  if (d.b64_json) fs.writeFileSync(file, Buffer.from(d.b64_json, "base64"));
  else if (d.url) await save(await fetch(d.url), file);
  else throw new Error("OpenAI 沒有回傳圖片");
};

const fromPollinations = async (prompt: string, file: string, seed: number) => {
  const base = process.env.POLLINATIONS_URL ?? "https://image.pollinations.ai";
  const url = `${base}/prompt/${encodeURIComponent(prompt + STYLE)}?width=1080&height=1920&nologo=true&seed=${seed}`;
  await save(await fetch(url, { signal: AbortSignal.timeout(120_000) }), file);
};

const fromPexels = async (query: string, file: string) => {
  const key = process.env.PEXELS_API_KEY ?? die("用圖庫照片要先在 .env 填 PEXELS_API_KEY（免費申請：https://www.pexels.com/api/）");
  const base = process.env.PEXELS_URL ?? "https://api.pexels.com";
  const res = await fetch(`${base}/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=1`, {
    headers: { Authorization: key },
  });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}：${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { photos: { src: { large2x: string }; photographer: string }[] };
  if (!json.photos.length) throw new Error(`Pexels 找不到「${query}」的照片，換個關鍵字（英文較準）`);
  await save(await fetch(json.photos[0].src.large2x), file);
  console.log(`   📷 攝影：${json.photos[0].photographer}（Pexels）`);
};

/** 需要產生、但還不存在的插圖 */
export const pendingImages = (name: string) =>
  (readProject(name).inserts ?? []).filter(
    (ins) => (ins.prompt || ins.stock) && !fs.existsSync(path.join(projectDir(name), ins.src)),
  );

export const generateImages = async (name: string) => {
  loadEnv();
  const todo = pendingImages(name);
  if (!todo.length) return 0;
  let ok = 0;
  for (const [i, ins] of todo.entries()) {
    const file = path.join(projectDir(name), ins.src);
    const what = ins.stock ? `圖庫：${ins.stock}` : `AI：${ins.prompt}`;
    console.log(`🖼️ (${i + 1}/${todo.length}) ${ins.src} ← ${what}`);
    try {
      if (/\.(mp4|mov|webm|m4v)$/i.test(ins.src)) throw new Error("自動產生只支援圖片，src 請用 .jpg / .png");
      if (ins.stock) await fromPexels(ins.stock, file);
      else if (process.env.OPENAI_API_KEY) await fromOpenAI(ins.prompt as string, file);
      else await fromPollinations(ins.prompt as string, file, 1000 + i);
      ok++;
    } catch (e) {
      fs.rmSync(file, { force: true });
      console.error(`   ❌ 失敗：${(e as Error).message}`);
    }
  }
  return ok;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] ?? die("用法：npm run images -- 專案名");
  readProject(name);
  const todo = pendingImages(name);
  if (!todo.length) {
    console.log("沒有要產生的插圖（inserts 裡要有 prompt 或 stock，而且圖還不存在）");
    console.log("   想重新產生某張：把那張圖刪掉再跑一次");
  } else {
    const ok = await generateImages(name);
    console.log(`✅ 產生 ${ok}/${todo.length} 張插圖`);
    if (ok < todo.length) process.exit(1);
  }
}
