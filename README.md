# AI 分身短影音樣板（Remotion）

把一支會講話的影片（你自己錄的，或「AI分身工作室」做出來的分身影片）包裝成短影音：

- 開場大標題（白字＋黃字）、上方一排圖示打紅色斜線、下方小膠囊
- 逐字跳出的字幕：正在說的字變黃放大，重點詞一直是黃色
- 自動剪掉停頓
- 重點處鏡頭推近
- 重點字卡（「① 腹式呼吸」）、插圖 / 插入影片（B-roll）、貼圖小動畫（打勾、箭頭、愛心、emoji⋯）
- 直式 9:16（1080×1920）、下半部加深讓字更清楚
- 轉場特效：閃白、推近、甩鏡、滑入、淡黑、故障閃爍（附「咻」音效）
- 自動配樂（程式合成，沒有版權問題）、貼圖「啵」音效
- 自動產生插圖（AI 畫圖或免費圖庫照片）
- 一個指令發佈到 YouTube Shorts、Instagram Reels

全部都是程式產生的，不用開剪輯軟體。想改什麼，直接跟 Claude Code 說就好（例如「第 12 秒那句推近一點」「標題改成⋯」）。

---

## 第一次安裝（只要做一次）

1. 安裝 **Node.js 20 以上**：https://nodejs.org （選 LTS）
2. 安裝 **Claude Code**：https://claude.com/claude-code
3. Mac 要先裝編譯工具（自動上字幕會用到）：打開「終端機」輸入 `xcode-select --install`
4. 下載這個專案，在專案資料夾裡執行：

```bash
npm install
```

## 做一支影片

```bash
# 1. 建立專案（專案名只能用英文、數字和 -）
npm run new -- breath-01 ~/Downloads/分身影片.mp4

# 2. 自動上字幕（第一次會下載語音模型，約 1.5GB）
npm run transcribe -- breath-01

# 3. 自動剪掉停頓（可略過）
npm run cuts -- breath-01

# 4. 打開預覽畫面，邊看邊改
npm run studio

# 5. 加背景音樂（可略過；calm 平靜、warm 溫暖、upbeat 輕快）
npm run music -- breath-01 calm

# 6. 輸出成品 → out/breath-01.mp4（有設定插圖會自動產生）
npm run render -- breath-01

# 7. 發佈到 YouTube＋IG（要先設定，見下方「發佈」）
npm run publish -- breath-01
```

第 2 步做完後，`public/projects/breath-01/transcript.txt` 會有逐字稿和時間，可以直接請 Claude Code 照著逐字稿幫你寫標題、挑重點詞、決定哪裡推近。

## 用 Claude Code 改影片

在專案資料夾裡開 Claude Code，直接講：

- 「幫 breath-01 加開場標題：第一行『每天五分鐘』，第二行『呼吸改變人生』」
- 「把『呼吸』『專注』設成重點詞」
- 「講到『最重要的是』那句推近」
- 「開頭三個圖示換成：手機、電腦、相機」
- 「字幕再大一點，往上移一點」
- 「字幕比說話慢，再提早一點」（調 `captions.lead`）
- 「加背景音樂 music.mp3，小聲一點」
- 「配一首輕快的背景音樂」（跑 `npm run music`）
- 「在換話題的地方加甩鏡轉場」「每個剪接點都加推近轉場」
- 「講到日出的時候，用 AI 畫一張日出靜坐的圖放上方小視窗」
- 「幫我寫發佈的標題、說明和 hashtag」
- 「**照逐字稿幫我規劃畫面**」：Claude 會依內容寫開場標題、挑重點詞、加推近、字卡、貼圖，需要插圖的地方會告訴你要準備什麼圖
- 「講到三個方法的時候，依序跳出 ①②③ 字卡」
- 「講到『手機』的時候，上方小視窗放 phone.jpg」（圖片先放進專案資料夾）
- 「說『對』的時候跳一個打勾」

Claude 會去改 `public/projects/breath-01/project.json`（剪輯腳本），預覽畫面會馬上更新。

## 剪輯腳本 project.json

| 欄位 | 說明 |
|---|---|
| `hook` | 開場標題：`lines`（每行文字和顏色）、`badge`（小膠囊）、`icons`（圖示）、`strike`（打斜線）、`from` / `to`（出現時間） |
| `captions` | 字幕：`highlight`（重點詞）、`maxChars`（一行幾個字）、`y`（垂直位置 0~1）、`fontSize`、`lead`（提早幾秒出現，預設 0.15） |
| `zooms` | 推近：`[{ "at": 秒, "dur": 秒, "scale": 1.15 }]` |
| `keep` | 要保留的段落 `[[開始, 結束], ...]`，`null` = 整支保留 |
| `focusX` / `focusY` / `baseZoom` | 直式裁切的焦點和整體放大 |
| `cards` | 重點字卡：`[{ "at": 秒, "dur": 秒, "text": "① 腹式呼吸", "sub": "小字" }]` |
| `inserts` | 插圖 / 插入影片：`[{ "at": 秒, "dur": 秒, "src": "photo.jpg", "mode": "full" }]`，`mode` 可選 `full`（蓋滿）、`pip`（上方小視窗）、`top`（上半部） |
| `stickers` | 貼圖小動畫：`[{ "at": 秒, "dur": 秒, "kind": "check" }]`，`kind` 可選 `check` `cross` `arrow` `heart` `star` `fire`，或用 `"emoji": "🌿"`、`"src": "圖.png"`；`x` `y` 位置、`size` 大小、`rotate` 角度、`anim`（`pop` `bounce` `float`） |
| `transitions` | 轉場：`[{ "at": 秒, "type": "flash" }]`，`type` 可選 `flash`（閃白）、`zoom`（推近）、`whip`（甩鏡）、`slide`（滑入）、`fade`（淡黑）、`glitch`（故障閃爍）；`dur` 長度、`sound: false` 不要咻聲 |
| `cutTransition` | 每個剪接點（剪掉停頓的地方）都自動加的轉場，例如 `"zoom"`；`null` = 不加 |
| `music` / `sfx` | 背景音樂、音效（音檔放在專案資料夾裡；`npm run music` 會自動產生）。內建音效：`sfx/whoosh.wav`（咻）、`sfx/pop.wav`（啵），貼圖加 `"sound": true` 會自動配「啵」 |
| `publish` | 發佈用的文字：`title` 標題、`description` 說明、`tags` 標籤、`privacy`（YouTube：`private` 私人 / `unlisted` 不公開 / `public` 公開，預設 private） |

所有時間都用**原始影片的秒數**（跟 transcript.txt 一樣），剪掉的段落程式會自動換算。

圖示想用真的 App 圖案：把 PNG 放到 `public/icons/`，`icons` 裡寫 `{ "src": "icons/xxx.png" }`。

## 自動產生插圖

在 `inserts` 裡加 `prompt`（AI 畫圖）或 `stock`（圖庫真實照片），`src` 填想要的檔名：

```json
"inserts": [
  { "at": 13.5, "dur": 2, "src": "img-1.jpg", "mode": "pip", "prompt": "清晨陽光下，一個人盤腿靜坐深呼吸" },
  { "at": 20, "dur": 1.5, "src": "img-2.jpg", "mode": "full", "stock": "sunrise meditation" }
]
```

跑 `npm run images -- 專案名`（`npm run render` 也會自動做）。圖已經存在就不會重畫；不滿意就把那張圖刪掉再跑一次，或改 prompt。

- AI 畫圖：`.env` 有 `OPENAI_API_KEY` 就用 OpenAI（品質好，每張約 1~2 元台幣）；沒有就用免費的 Pollinations（品質普通、偶爾比較慢）
- 圖庫照片：免費申請 Pexels 金鑰 https://www.pexels.com/api/ ，填進 `.env` 的 `PEXELS_API_KEY`；關鍵字用英文比較準

`.env` 的寫法：把 `.env.example` 複製一份改名成 `.env`，填上金鑰。`.env` 不會上傳到 GitHub。

## 發佈到 YouTube / Instagram

先在 `project.json` 的 `publish` 寫好標題、說明、標籤（可以請 Claude 照逐字稿幫你寫），然後：

```bash
npm run publish -- breath-01            # YouTube＋IG 都發
npm run publish -- breath-01 youtube    # 只發 YouTube
npm run publish -- breath-01 instagram  # 只發 IG
```

發佈前會列出標題、平台，問你「確定要發佈嗎？」，按 `y` 才會上傳。YouTube 預設是**私人**，到 YouTube Studio 看過再公開；IG 發佈後就是公開的。

### 第一次設定 YouTube（約 10 分鐘，只要做一次）

1. 到 https://console.cloud.google.com/ 建一個專案
2. 「API 和服務」→「程式庫」→ 搜尋 **YouTube Data API v3** → 啟用
3. 「OAuth 同意畫面」→ 外部 → 填 App 名稱和你的 Email →「測試使用者」加入你自己的 Gmail
4. 「憑證」→「建立憑證」→「OAuth 用戶端 ID」→ 應用程式類型選 **電腦版應用程式**
5. 把用戶端 ID、用戶端密鑰填進 `.env` 的 `YOUTUBE_CLIENT_ID`、`YOUTUBE_CLIENT_SECRET`
6. 第一次 `npm run publish` 會開瀏覽器請你登入、按允許（出現「Google 尚未驗證這個應用程式」按「繼續」），之後就不用再登入

### 第一次設定 Instagram（約 20 分鐘，只要做一次）

1. IG 要是**專業帳號**（商業或創作者），並連結一個 Facebook 粉絲專頁
2. 到 https://developers.facebook.com/ 建立應用程式（類型選「商業」），加入 **Instagram** 產品
3. 用「Graph API 測試工具」取得權杖，勾選 `instagram_basic`、`instagram_content_publish`、`pages_show_list`、`pages_read_engagement`，再換成**長期權杖**（60 天）
4. 查你的 IG 帳號 ID：在測試工具查 `me/accounts?fields=instagram_business_account`
5. 填進 `.env` 的 `IG_ACCESS_TOKEN`、`IG_USER_ID`

權杖 60 天會過期，到期再到測試工具換一個新的。

## 常見問題

- **字幕有錯字**：直接改 `transcript.txt`，存檔就好，**行首的 `[00:04.0]` 時間不要動**。
  - `npm run render` 會自動把改過的字套進字幕
  - `npm run studio` 開著的時候改也可以，終端機會顯示「已更新字幕」，預覽畫面按 F5 重新整理
  - 想手動套用：`npm run fix-captions -- 專案名`
  - 改過的那句字幕會在原本的時間內平均分配，沒改的句子時間不變
- **語音模型**：預設 `medium`；想更準可以 `WHISPER_MODEL=large-v3 npm run transcribe -- 專案名`（比較慢）
- **影片、音檔不會上傳到 GitHub**（太大），只有剪輯腳本和字幕會

字型：Noto Sans TC Black（SIL Open Font License，見 `public/fonts/LICENSE-OFL.txt`）。
