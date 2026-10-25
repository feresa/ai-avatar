# CLAUDE.md

這是使用者王明智的短影音樣板（Remotion + React + TypeScript）。使用者用中文跟你說要怎麼改影片，你去改剪輯腳本或元件。**一律用繁體中文、口語、簡潔回覆。**

## 專案結構

- `public/projects/<名稱>/project.json`：每支影片的剪輯腳本（型別定義在 `src/types.ts`，欄位說明在 README）
- `public/projects/<名稱>/captions.json`：逐字字幕（`npm run transcribe` 產生），`transcript.txt` 是給人看的逐字稿
- `src/Short.tsx`：組合影片（剪接、推近、加深、字幕、標題、音樂）
- `src/components/Hook.tsx`：開場標題、圖示斜線、小膠囊
- `src/components/Captions.tsx`：逐字字幕
- `src/timeline.ts`：剪掉段落後的時間換算
- `scripts/`：`new` / `transcribe` / `cuts` / `render` 指令

## 改影片的原則

1. **先改 project.json，不夠才改元件。** 「標題改字」「重點詞」「哪裡推近」「字幕位置」都是改剪輯腳本
2. **時間一律用原始影片的秒數**（看 `transcript.txt` 的 `[mm:ss.s]`），不要自己扣掉剪掉的段落
3. 使用者說「講到某句話的時候」：到 `captions.json` 找那幾個字的 `startMs`，換成秒填進去
4. 開場標題每行最好 6 個字以內；第二行用黃色當重點
5. 改元件樣式時，所有專案都會一起變；只想改某一支，就在 project.json 加欄位（並更新 `src/types.ts`）
6. 不要把影片、音檔加進 git（`.gitignore` 已排除）

## 改完要檢查

```bash
npm run typecheck                                   # 型別
npx remotion still <名稱> out/check.png --frame=60  # 輸出一張截圖，打開來看
```

截圖要實際打開看過（標題有沒有被切到、字幕有沒有擋到臉），再跟使用者說改好了。要看動態效果請使用者開 `npm run studio`。
