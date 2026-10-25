# CLAUDE.md

這是使用者王明智的短影音樣板（Remotion + React + TypeScript）。使用者用中文跟你說要怎麼改影片，你去改剪輯腳本或元件。**一律用繁體中文、口語、簡潔回覆。**

## 專案結構

- `public/projects/<名稱>/project.json`：每支影片的剪輯腳本（型別定義在 `src/types.ts`，欄位說明在 README）
- `public/projects/<名稱>/captions.json`：逐字字幕（`npm run transcribe` 產生），`transcript.txt` 是給人看的逐字稿
- `src/Short.tsx`：組合影片（剪接、推近、加深、字幕、標題、音樂）
- `src/components/Hook.tsx`：開場標題、圖示斜線、小膠囊
- `src/components/Captions.tsx`：逐字字幕
- `src/components/Card.tsx`：重點字卡；`Insert.tsx`：插圖 / 插入影片；`Sticker.tsx`：貼圖小動畫
- `src/timeline.ts`：剪掉段落後的時間換算
- `scripts/`：`new` / `transcribe` / `cuts` / `render` 指令

## 改影片的原則

1. **先改 project.json，不夠才改元件。** 「標題改字」「重點詞」「哪裡推近」「字幕位置」都是改剪輯腳本
2. **時間一律用原始影片的秒數**（看 `transcript.txt` 的 `[mm:ss.s]`），不要自己扣掉剪掉的段落
3. 使用者說「講到某句話的時候」：到 `captions.json` 找那幾個字的 `startMs`，換成秒填進去
4. 開場標題每行最好 6 個字以內；第二行用黃色當重點
5. 改元件樣式時，所有專案都會一起變；只想改某一支，就在 project.json 加欄位（並更新 `src/types.ts`）
6. 不要把影片、音檔加進 git（`.gitignore` 已排除）

## 「照逐字稿規劃畫面」怎麼做

使用者說「幫我規劃畫面」「照內容加效果」時：

1. 讀 `transcript.txt` 抓重點，必要時到 `captions.json` 查精確的字的時間
2. `hook`：開頭 2~3 秒，兩行、每行 6 字內，第二行是最勾人的一句（黃色）
3. `captions.highlight`：3~6 個關鍵詞（主題詞、數字、反差詞）
4. `zooms`：1~3 處，放在最有情緒或最重要的句子，`scale` 1.1~1.2
5. `cards`：講到條列（第一、第二⋯）、數字、結論時放字卡，`dur` 1.2~2 秒，和字幕不要同時塞太多字
6. `stickers`：肯定句 → `check`、否定 / 錯誤做法 → `cross`、喜歡 / 感謝 → `heart`、強調 → `fire` 或 `star`，一支片 3~6 個就好，不要擋到臉
7. `inserts`：講到具體的東西（產品、地點、動作）適合插圖；**專案資料夾裡沒有的圖不要亂填檔名**，改成列清單告訴使用者要準備哪些圖、檔名叫什麼
8. 效果不要太密：同一時間最多「字幕 + 一個字卡或貼圖」；開場標題那幾秒不要再放別的
9. 改完輸出 3~4 張關鍵時間的截圖檢查，再跟使用者說明加了哪些效果、在第幾秒

## 改完要檢查

```bash
npm run typecheck                                   # 型別
npx remotion still <名稱> out/check.png --frame=60  # 輸出一張截圖，打開來看
```

截圖要實際打開看過（標題有沒有被切到、字幕有沒有擋到臉），再跟使用者說改好了。要看動態效果請使用者開 `npm run studio`。
