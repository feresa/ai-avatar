# CLAUDE.md

這是使用者王明智的短影音樣板（Remotion + React + TypeScript）。使用者用中文跟你說要怎麼改影片，你去改剪輯腳本或元件。**一律用繁體中文、口語、簡潔回覆。**

## 專案結構

- `public/projects/<名稱>/project.json`：每支影片的剪輯腳本（型別定義在 `src/types.ts`，欄位說明在 README）
- `public/projects/<名稱>/captions.json`：逐字字幕（`npm run transcribe` 產生），`transcript.txt` 是給人看的逐字稿；有 `script.txt`（講稿）時字幕用講稿的字，`captions.whisper.json` 是原始辨識結果
- `src/Short.tsx`：組合影片（剪接、推近、加深、字幕、標題、音樂）
- `src/components/Hook.tsx`：開場標題、圖示斜線、小膠囊
- `src/components/Captions.tsx`：逐字字幕
- `src/components/Card.tsx`：重點字卡；`Insert.tsx`：插圖 / 插入影片；`Sticker.tsx`：貼圖小動畫
- `Teach.tsx` 教學版型（螢幕錄影 `screens`、AI 對話 `chats`、提示詞打字機 `prompts`，分身小頭像 `pip` 在 `Short.tsx`）
- `BreathGuide.tsx` 呼吸引導圈；調色（`grade`）、進度條（`progress`）在 `Short.tsx`
- `Note.tsx` 便利貼、`Compare.tsx` 前後對比、`Phone.tsx` 手機示範、`Headlines.tsx` 頭條牆、`Orbit.tsx` 卡片環繞；聚光燈、拉遠揭曉、穿越、漏光、故障在 `Short.tsx` / `transitions.ts`（用 `@remotion/effects`）
- 去背：`Backdrop.tsx` 背景、`DepthText.tsx` 景深大字、`Magazine.tsx` 雜誌封面；破框、剪貼、人像層在 `Short.tsx`（綠幕用 `colorKey`，AI 去背用 `matte.webm`）
- 影片用 `@remotion/media` 的 `<Video>`（才能套官方特效）；裁切位置靠 `sourceWidth` / `sourceHeight` / `focusX` / `focusY` 算，這些會自動填
- `src/timeline.ts`：剪掉段落後的時間換算；`src/transitions.ts`：轉場特效
- `scripts/`：`make`（一鍵做片：建專案→字幕→對時→找臉→音樂→Claude 規劃→檢查→輸出，做過的跳過）/ `panel`（瀏覽器控制台：`panel.ts` + `panel.html`）/ `new` / `clip` / `transcribe` / `align` / `fix-captions` / `lead` / `cuts` / `face` / `check` / `green` / `matte` / `music` / `images` / `render` / `variants` / `publish` / `studio` 指令；`synth.ts` 合成音樂和音效

## 踩坑紀錄

遇到錯誤先看 `docs/踩坑紀錄.md`；修好新問題也補進去（症狀、原因、解法）。

## Remotion 官方 skill

改元件、做新特效、處理字幕或渲染問題前，先用 `remotion-best-practices` skill（沒裝的話請使用者跑 `npm run skills`）。只改 project.json 不用。

## 改影片的原則

1. **先改 project.json，不夠才改元件。** 「標題改字」「重點詞」「哪裡推近」「字幕位置」都是改剪輯腳本
2. **時間一律用原始影片的秒數**（看 `transcript.txt` 的 `[mm:ss.s]`），不要自己扣掉剪掉的段落
3. 字幕錯字：使用者有講稿就優先用 `npm run align -- <名稱> 講稿.txt`；沒有講稿才改 `transcript.txt`（行首時間不要動），再跑 `npm run fix-captions -- <名稱>` 套進 `captions.json`；render / studio 也會自動套用
3-1. 字幕比說話慢 / 快：先跑 `npm run lead -- <名稱>`（量聲音和字幕的差距，自動寫進 `captions.lead`），還不對再手動微調
4. 使用者說「講到某句話的時候」：到 `captions.json` 找那幾個字的 `startMs`，換成秒填進去
5. 開場標題每行最好 6 個字以內；第二行用黃色當重點
6. 改元件樣式時，所有專案都會一起變；只想改某一支，就在 project.json 加欄位（並更新 `src/types.ts`）
7. 不要把影片、音檔加進 git（`.gitignore` 已排除）

## 「照逐字稿規劃畫面」怎麼做

使用者說「幫我規劃畫面」「照內容加效果」時：

0. project.json 沒有 `face` 就先跑 `npm run face -- <名稱>`（找臉）；字卡、貼圖的 `y` 放在臉的下方（`face.y + face.h` 之後）、字幕上方，貼圖可以放臉的左右兩邊
1. 讀 `transcript.txt` 抓重點，必要時到 `captions.json` 查精確的字的時間
2. `hook`：開頭 2~3 秒，兩行、每行 6 字內，第二行是最勾人的一句（黃色）
3. `captions.highlight`：3~6 個關鍵詞（主題詞、數字、反差詞）
4. `zooms`：1~3 處，放在最有情緒或最重要的句子，`scale` 1.1~1.2
5. `cards`：講到條列（第一、第二⋯）、數字、結論時放字卡，`dur` 1.2~2 秒，和字幕不要同時塞太多字
6. `stickers`：肯定句 → `check`、否定 / 錯誤做法 → `cross`、喜歡 / 感謝 → `heart`、強調 → `fire` 或 `star`，一支片 3~6 個就好，不要擋到臉
7. `inserts`：講到具體的東西（產品、地點、動作）適合插圖。專案資料夾裡有的圖直接用；沒有的就加 `prompt`（中文描述畫面，具體寫人物、動作、場景、光線）或 `stock`（英文圖庫關鍵字），`src` 用 `img-1.jpg`、`img-2.jpg`⋯，再跑 `npm run images -- <名稱>` 產生並打開來看。產品圖（例如美安產品）不要用 AI 畫，請使用者提供真實照片
8. `transitions`：換話題、段落轉折（「接著」「很多朋友問我」「我的回答」）放 1~3 個，`whip` 或 `flash` 最常用；開場標題結束時可放一個 `flash`。不要每句都放
9. `music`：跑 `npm run music -- <名稱> <風格>`，靜心呼吸用 `calm`、生活分享用 `warm`、教學清單用 `upbeat`
10. `publish`：照內容寫標題（20 字內、有吸引力）、說明（2~3 句＋行動呼籲）、5~8 個中文 hashtag；`privacy` 保持 `private`。**不要自己跑 `npm run publish`**，發佈要使用者自己下指令
9-1. 每支片都要有：`grade`（調色：靜心、生活用 `warm`，教學、科技用 `fresh`，畫面偏暗用 `bright`）、`progress: true`（進度條）
9-2. `breaths`（呼吸引導圈）：講到吸氣、吐氣、呼吸練習時放，`pattern` 照講的節奏對齊（例如從「吸氣」開始到「吐氣」之前是吸幾秒）；同一時間不要再放字卡，圓在臉下方、字幕上方（預設 y 0.64，check 有警告就照建議調 `y`、`size`）
10-1. 進階特效（用 Remotion 官方特效庫，一支片挑 2~4 個，不要全部塞）：
   - `spotlights`：最重要、最有情緒的一句，0.8~2 秒
   - `reveals`：開場或轉換場景時，從特寫拉遠
   - `notes`：短句提醒、口訣、數字（10 字以內），可以依序貼 2~3 張
   - `headlines`：開場引起好奇、或總結「大家都在說」的時候，3~4 張
   - `orbits`：列舉很多項目時（方法、好處、關鍵字）
   - `compares`：有前後差異的內容；**before 的圖要使用者提供**，不要亂填
   - `phones`：示範 App、網站、截圖；**手機裡的圖要使用者提供**
   - 轉場 `zoomblur`（穿越）適合換段落，`lightleak`（漏光）適合溫暖、靜心、戶外的氛圍
10-2. 去背特效（要有 `greenScreen` 或 `matte`；都沒有就先問使用者是綠幕拍的嗎：是就跑 `npm run green`，不是就跑 `npm run matte`，matte 要跑幾分鐘先告訴使用者；Mac 太慢可以改用雲端硬碟的 `AI去背.ipynb`（Colab），做好用 `npm run matte -- <名稱> --file <下載的_去背.webm>` 放進專案）：
   - `depthTexts`：主題詞（2~4 字），開場或講到核心概念時，1.5~2.5 秒
   - `magazines`：開場最吸睛，title 2~3 字、lines 2~3 句
   - `breakouts`：講到「突破」「走出去」或情緒高點
   - `cutouts`：輕鬆、可愛、分享的段落
   - `backgrounds`：講到某個地方或情境時換背景，圖要使用者提供或用 `npm run images` 產生
   - `background`：整支換背景（例如靜心片換成清晨森林、教學片換成簡約書房），一樣要有 `matte` 或 `greenScreen`
   - 一支片去背特效 1~2 個就好，和第 10-1 的進階特效加起來不超過 4 個
10-3. 使用者想「測試哪個開場比較好」：在 `variants` 寫 2~3 個版本（只改 hook 或開場特效），請使用者跑 `npm run variants`
11. 效果不要太密：同一時間最多「字幕 + 一個字卡或貼圖」；開場標題那幾秒不要再放別的
12. 改完先跑 `npm run check -- <名稱>`，有警告就照建議修到沒有；再輸出 3~4 張關鍵時間的截圖檢查（可暫時加 `"debugFace": true` 看臉的框，檢查完拿掉），再跟使用者說明加了哪些效果、在第幾秒

## 教 AI、教工具的影片怎麼規劃

照「照逐字稿規劃畫面」做，另外：

1. 講到「打開／點／輸入」這類操作：用 `screens`。**螢幕錄影或截圖要使用者提供**（放進專案資料夾），沒有就先問；講到「點這裡」用 `focus` 放大那一區
2. 講到「我問 AI…它回答…」：用 `chats`，`messages` 照講的內容寫，AI 回答要短（一則 40 字內），太長就摘要
3. 講到提示詞、指令：用 `prompts`，`text` 放完整提示詞（觀眾會暫停抄），`dur` 至少 4 秒
4. 這三種會把分身縮成右邊小頭像（`pip`），同一時間不要再放字卡、貼圖；中間穿插回到全臉講話，不要整支都是小頭像
5. `grade` 用 `fresh`、音樂用 `upbeat`；結尾放「留言關鍵字領提示詞」的字卡，`publish.autoReply` 私訊完整提示詞

## 「從長片挑短片」怎麼做

使用者給一支長影片（課程、直播、訪談），說「挑幾段做短片」時：

1. 長片先照一般流程建專案、上字幕（`npm run new` → `npm run transcribe`，有講稿就 `align`）
2. 讀整份 `transcript.txt`，挑 3~5 段候選，每段 **20~60 秒**、從一句話的開頭到結尾，不要從中間開始
3. 每段照下面 5 項各打 1~5 分（滿分 25），列成表給使用者看：時間、開頭第一句、總分、一句話說為什麼
   - **開頭勾人**：前 3 秒就有問題、反差、數字或痛點（「很多人以為⋯其實⋯」「我只做一件事」）
   - **一段一重點**：只講一件事，不用前後文也聽得懂
   - **實用**：觀眾看完馬上可以做（步驟、方法、口訣）
   - **情緒**：有故事、有感受、有真心話
   - **結尾有力**：最後一句是結論、金句或行動呼籲，不是講到一半
4. **等使用者挑**（用 AskUserQuestion，可複選），不要自己全部剪
5. 使用者挑好就用 `npm run clip -- <長片> <新名稱> <開始> <結束>` 一段一段剪（會自動對到停頓），新名稱用 `<長片>-a`、`-b`⋯
6. 每段再照「照逐字稿規劃畫面」做；開場標題要能單獨看懂，不要寫「接著」「剛剛說的」

## 改完要檢查

```bash
npm run typecheck                                   # 型別
npx remotion still <名稱> out/check.png --frame=60  # 輸出一張截圖，打開來看
```

截圖要實際打開看過（標題有沒有被切到、字幕有沒有擋到臉），再跟使用者說改好了。要看動態效果請使用者開 `npm run studio`。
