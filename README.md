# AI 分身短影音樣板（Remotion）

把一支會講話的影片（你自己錄的，或「AI分身工作室」做出來的分身影片）包裝成短影音：

- 開場大標題（白字＋黃字）、上方一排圖示打紅色斜線、下方小膠囊
- 逐字跳出的字幕：正在說的字變黃放大，重點詞一直是黃色
- 自動剪掉停頓
- 重點處鏡頭推近
- 重點字卡（「① 腹式呼吸」）、插圖 / 插入影片（B-roll）、貼圖小動畫（打勾、箭頭、愛心、emoji⋯）
- 直式 9:16（1080×1920）、下半部加深讓字更清楚
- 轉場特效：閃白、推近、甩鏡、滑入、淡黑、故障閃爍、穿越、漏光（附「咻」音效）
- 聚光燈、拉遠揭曉、便利貼字、前後對比、手機示範、頭條牆、卡片環繞（用 Remotion 官方特效庫 `@remotion/effects`）
- 去背特效：景深大字、破框、剪貼、換背景、雜誌封面（綠幕或 AI 去背）
- 一支變多支：同一支片輸出好幾個版本，測哪個比較紅
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
npm run skills   # 安裝 Remotion 官方 skill：Claude 改特效時照官方寫法，比較不會出錯
```

## 最快：一鍵做片

```bash
npm run panel          # 控制台 → 🚀 一鍵做片：填專案名、貼影片路徑 → 按「一鍵做片」
# 或
npm run make -- challenge-d2 ~/路徑/分身影片_1030_0900_第2000步.mp4 [講稿檔] [--music calm|warm|upbeat]
```

自動做完：建專案 → 字幕（有講稿用講稿的字）→ 字幕對時 → 找臉 → 背景音樂 → Claude 規劃畫面 → 檢查 → 輸出 `out/專案名.mp4`。
- 講稿沒給會找影片旁邊同名的 `.txt`（Colab「AI分身工作室」做影片時會自動存）
- 中途失敗，修好再跑同一行，做過的步驟會跳過
- 電腦沒有 Claude Code 時，會印出提示詞，貼給 Claude 規劃好再跑一次就會接著輸出
- 遇到問題先看 [docs/踩坑紀錄.md](docs/踩坑紀錄.md)

## 剪片控制台（不想打指令就用這個）

```bash
npm run panel
```

瀏覽器會打開 http://localhost:3210：
- 上面選影片，每個步驟旁邊會顯示「做過了 / 還沒做 / 要重新輸出」
- 按「勾選建議的下一步」會自動勾好，再按「執行勾選的步驟」就照順序跑，進度即時顯示
- 第 3 區（畫面效果）勾好或寫下想改的，右邊會產生提示詞：可以複製貼給 Claude，或按「交給 Claude 直接跑」（電腦有裝 Claude Code 才能用；Claude 不會自己發佈）
- 輸出好的影片可以直接在右下角播放
- 只有自己的電腦連得到，關掉按 Ctrl+C

## 做一支影片

```bash
# 1. 建立專案（專案名只能用英文、數字和 -）
#    有講稿就加 --script：字幕直接用講稿的字，不會有錯字（強烈建議）
npm run new -- breath-01 ~/Downloads/分身影片.mp4 --script ~/Downloads/講稿.txt

# 2. 自動上字幕（第一次會下載語音模型，約 1.5GB）
npm run transcribe -- breath-01

# 3. 自動剪掉停頓（可略過）
npm run cuts -- breath-01

# 3-1. 自動找臉：直式畫面自動對準臉、推近往臉放大，字卡貼圖可以避開臉（第一次會裝 OpenCV）
npm run face -- breath-01

# 4. 檢查字卡、貼圖有沒有擋到臉、會不會太擠
npm run check -- breath-01

# 4-1. 打開預覽畫面，邊看邊改
npm run studio

# 5. 加背景音樂（可略過；calm 平靜、warm 溫暖、upbeat 輕快）
npm run music -- breath-01 calm

# 6. 輸出成品 → out/breath-01.mp4（有設定插圖會自動產生）
npm run render -- breath-01

# 7. 發佈到 YouTube＋IG（要先設定，見下方「發佈」）
npm run publish -- breath-01
```

第 2 步做完後，`public/projects/breath-01/transcript.txt` 會有逐字稿和時間，可以直接請 Claude Code 照著逐字稿幫你寫標題、挑重點詞、決定哪裡推近。

## 從長片剪短片

一支 30 分鐘的課程或直播，可以挑出好幾支短片：

```bash
npm run new -- class-01 ~/Downloads/呼吸課.mp4
npm run transcribe -- class-01
```

然後跟 Claude Code 說「**幫 class-01 挑幾段適合做短片的**」。Claude 會讀逐字稿，照「開頭勾不勾人、重點清不清楚、實不實用、有沒有情緒、結尾有不有力」打分數，列出候選給你挑。挑好之後它會用：

```bash
npm run clip -- class-01 class-01-a 3:12 3:58
```

剪成新的短片專案（開始、結束會自動對到停頓，不會切到半個字），字幕、找臉的設定都會一起帶過去。

## 用 Claude Code 改影片

在專案資料夾裡開 Claude Code，直接講：

- 「幫 breath-01 加開場標題：第一行『每天五分鐘』，第二行『呼吸改變人生』」
- 「把『呼吸』『專注』設成重點詞」
- 「講到『最重要的是』那句推近」
- 「開頭三個圖示換成：手機、電腦、相機」
- 「字幕再大一點，往上移一點」
- 「字幕比說話慢，再提早一點」（先跑 `npm run lead -- 名稱` 自動量，再微調 `captions.lead`）
- 「加背景音樂 music.mp3，小聲一點」
- 「配一首輕快的背景音樂」（跑 `npm run music`）
- 「在換話題的地方加甩鏡轉場」「每個剪接點都加推近轉場」
- 「講到日出的時候，用 AI 畫一張日出靜坐的圖放上方小視窗」
- 「幫我寫發佈的標題、說明和 hashtag」
- 「**照逐字稿幫我規劃畫面**」：Claude 會依內容寫開場標題、挑重點詞、加推近、字卡、貼圖，需要插圖的地方會告訴你要準備什麼圖
- 「講到三個方法的時候，依序跳出 ①②③ 字卡」
- 「講到『手機』的時候，上方小視窗放 phone.jpg」（圖片先放進專案資料夾）
- 「說『對』的時候跳一個打勾」
- 「講到重點那句加聚光燈」「開頭用拉遠揭曉」
- 「三個步驟用便利貼依序貼上來」「放一面頭條牆，標題是⋯」
- 「放一張練習前、練習後的對比，before 用 old.jpg」

Claude 會去改 `public/projects/breath-01/project.json`（剪輯腳本），預覽畫面會馬上更新。

## 剪輯腳本 project.json

| 欄位 | 說明 |
|---|---|
| `hook` | 開場標題：`lines`（每行文字和顏色）、`badge`（小膠囊）、`icons`（圖示）、`strike`（打斜線）、`from` / `to`（出現時間） |
| `captions` | 字幕：`highlight`（重點詞）、`maxChars`（一行幾個字）、`y`（垂直位置 0~1）、`fontSize`、`lead`（提早幾秒出現，預設 0.15） |
| `zooms` | 推近：`[{ "at": 秒, "dur": 秒, "scale": 1.15 }]` |
| `keep` | 要保留的段落 `[[開始, 結束], ...]`，`null` = 整支保留 |
| `focusX` / `focusY` / `baseZoom` | 直式裁切的焦點和整體放大（`npm run face` 會自動算） |
| `face` | 臉在畫面的位置（`npm run face` 自動填）；`debugFace: true` 會畫出臉的框，檢查用 |
| `cards` | 重點字卡：`[{ "at": 秒, "dur": 秒, "text": "① 腹式呼吸", "sub": "小字" }]` |
| `inserts` | 插圖 / 插入影片：`[{ "at": 秒, "dur": 秒, "src": "photo.jpg", "mode": "full" }]`，`mode` 可選 `full`（蓋滿）、`pip`（上方小視窗）、`top`（上半部） |
| `stickers` | 貼圖小動畫：`[{ "at": 秒, "dur": 秒, "kind": "check" }]`，`kind` 可選 `check` `cross` `arrow` `heart` `star` `fire`，或用 `"emoji": "🌿"`、`"src": "圖.png"`；`x` `y` 位置、`size` 大小、`rotate` 角度、`anim`（`pop` `bounce` `float`） |
| `transitions` | 轉場：`[{ "at": 秒, "type": "flash" }]`，`type` 可選 `flash`（閃白）、`zoom`（推近）、`whip`（甩鏡）、`slide`（滑入）、`fade`（淡黑）、`glitch`（故障閃爍）、`zoomblur`（穿越）、`lightleak`（漏光）；`dur` 長度、`sound: false` 不要咻聲 |
| `spotlights` | 聚光燈（四周變暗、亮在臉上）：`[{ "at": 秒, "dur": 秒 }]`，可加 `strength`（0~1）、`radius`、`x` `y` |
| `reveals` | 拉遠揭曉（從特寫拉遠到全景）：`[{ "at": 秒, "dur": 秒, "from": 2.2 }]` |
| `notes` | 便利貼字：`[{ "at": 秒, "dur": 秒, "text": "每天\n5 分鐘", "color": "yellow" }]`，`color` 可選 `yellow` `pink` `blue` `green` |
| `compares` | 前後對比：`[{ "at": 秒, "dur": 秒, "before": "before.jpg", "beforeLabel": "練習前", "afterLabel": "練習後" }]`，左邊放 before 圖片／影片，右邊是現在的畫面 |
| `phones` | 手機示範：`[{ "at": 秒, "dur": 秒, "src": "app.png" }]`，螢幕裡放圖片或影片 |
| `headlines` | 頭條牆（剪報一張張貼上）：`[{ "at": 秒, "dur": 秒, "items": [{ "text": "每天呼吸五分鐘", "tag": "頭條", "date": "2026.10.28" }] }]`，最多 6 張 |
| `orbits` | 卡片環繞（頭上一圈卡片在轉）：`[{ "at": 秒, "dur": 秒, "items": ["腹式呼吸", "photo.jpg", "長吐氣"] }]`，可以放文字或圖片 |
| `greenScreen` | 綠幕去背（官方 `colorKey`）：`npm run green` 自動偵測綠布顏色並開啟；可調 `similarity`（去多少）、`spill`（去綠光） |
| `matte` | AI 去背的影片（`npm run matte` 自動產生 `matte.webm`）；不是綠幕拍的影片用這個 |
| `background` | 綠幕去背後的背景：圖片／影片檔名，或顏色 `"#F2E8D5"` |
| `backgrounds` | 某段時間換背景：`[{ "at": 秒, "dur": 秒, "src": "beach.jpg" }]` |
| `depthTexts` | 景深大字（字在人的後面）：`[{ "at": 秒, "dur": 秒, "text": "呼吸", "color": "yellow" }]` |
| `breakouts` | 破框（頭衝出框外）：`[{ "at": 秒, "dur": 秒, "backdrop": "#EFE8DC" }]` |
| `cutouts` | 剪貼（人像變貼紙、白邊陰影、紙背景）：`[{ "at": 秒, "dur": 秒, "backdrop": "#F6D98B" }]` |
| `magazines` | 雜誌封面：`[{ "at": 秒, "dur": 秒, "title": "靜心", "issue": "ISSUE 01 · 2026", "lines": ["5 天挑戰", "每天 5 分鐘"] }]` |
| `variants` | 一支變多支：`[{ "name": "b", "hook": { ...另一個開場標題... } }]`，每個版本只寫不一樣的地方，`npm run variants` 全部輸出 |
| `cutTransition` | 每個剪接點（剪掉停頓的地方）都自動加的轉場，例如 `"zoom"`；`null` = 不加 |
| `music` / `sfx` | 背景音樂、音效（音檔放在專案資料夾裡；`npm run music` 會自動產生）。內建音效：`sfx/whoosh.wav`（咻）、`sfx/pop.wav`（啵），貼圖加 `"sound": true` 會自動配「啵」 |
| `publish` | 發佈用的文字：`title` 標題、`description` 說明、`tags` 標籤、`scheduleTime` 排程時間、`videoUrl` 公開網址（Threads 專用）、`privacy`（YouTube：`private` 私人 / `unlisted` 不公開 / `public` 公開，預設 private） |

所有時間都用**原始影片的秒數**（跟 transcript.txt 一樣），剪掉的段落程式會自動換算。

圖示想用真的 App 圖案：把 PNG 放到 `public/icons/`，`icons` 裡寫 `{ "src": "icons/xxx.png" }`。

## 去背：景深大字、破框、剪貼、換背景、雜誌封面

這 5 個特效要先把人從背景切出來，兩種方法：

- **綠幕拍的（最乾淨）**：`npm run green -- breath-02`，自動偵測綠布顏色，用 Remotion 官方 `colorKey` 去背。再在 project.json 加 `"background": "背景圖.jpg"`
- **一般影片**：`npm run matte -- breath-01`，用 AI（RobustVideoMatting）去背，產生 `matte.webm`。第一次會裝 PyTorch（約 5 分鐘）。Mac 會用顯示卡，一支 40 秒的影片大約幾分鐘
- **一般影片、想更快**：用雲端硬碟 `AI分身素材/AI去背.ipynb`（Colab GPU），做好的 `原檔名_去背.webm` 下載後跑 `npm run matte -- breath-01 --file ~/Downloads/原檔名_去背.webm` 放進專案（長度對不上會提醒）

去背好之後，跟 Claude 說「講到呼吸的時候放景深大字」「開頭做成雜誌封面」就可以了。

## 一支變多支（測試哪個版本比較紅）

在 project.json 加 `variants`，每個版本只寫跟原版不一樣的地方：

```json
"variants": [
  { "name": "b", "hook": { "from": 0, "to": 3, "lines": [{ "text": "睡不著？" }, { "text": "試試這招", "color": "yellow" }] } },
  { "name": "c", "magazines": [{ "at": 0, "dur": 3, "title": "靜心" }] }
]
```

`npm run variants -- breath-01` 會輸出 `out/breath-01.mp4`（原版）、`out/breath-01-b.mp4`、`out/breath-01-c.mp4`。分幾天發，看哪個觀看數高，之後就用那種開場。

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
npm run publish -- breath-01            # 依 .env 有設定金鑰的平台全部發佈（YouTube/IG/FB/Threads）
npm run publish -- breath-01 youtube    # 只發 YouTube (簡稱 yt)
npm run publish -- breath-01 instagram  # 只發 IG (簡稱 ig)
npm run publish -- breath-01 facebook   # 只發 Facebook Reels (簡稱 fb)
npm run publish -- breath-01 threads    # 只發 Threads
```

發佈前會列出標題、平台與排程時間，問你「確定要發佈嗎？」，按 `y` 才會上傳。
- **YouTube**：支援 `scheduleTime` 排程公開（ISO 8601 或 `YYYY-MM-DDTHH:mm:ss`）；預設為 `private`，發布後可到 YouTube Studio 確認。
- **Facebook Reels**：支援 `scheduleTime` 排程發布（需在 10 分鐘 ~ 75 天內）。
- **Instagram Reels**：目前 API 發佈後即公開。
- **Threads**：需要將影片上傳至公開 URL（可在 `publish.videoUrl` 或 `.env` 的 `PUBLIC_VIDEO_BASE_URL` 設定）。

### 第一次設定 YouTube（約 10 分鐘，只要做一次）

1. 到 https://console.cloud.google.com/ 建一個專案
2. 「API 和服務」→「程式庫」→ 搜尋 **YouTube Data API v3** → 啟用
3. 「OAuth 同意畫面」→ 外部 → 填 App 名稱和你的 Email →「測試使用者」加入你自己的 Gmail
4. 「憑證」→「建立憑證」→「OAuth 用戶端 ID」→ 應用程式類型選 **電腦版應用程式**
5. 把用戶端 ID、用戶端密鑰填進 `.env` 的 `YOUTUBE_CLIENT_ID`、`YOUTUBE_CLIENT_SECRET`
6. 第一次 `npm run publish` 會開瀏覽器請你登入、按允許（出現「Google 尚未驗證這個應用程式」按「繼續」），之後就不用再登入

### 第一次設定 Instagram / Facebook（約 20 分鐘，只要做一次）

1. IG 要是**專業帳號**（商業或創作者），並連結一個 Facebook 粉絲專頁
2. 到 https://developers.facebook.com/ 建立應用程式（類型選「商業」）
3. 用「Graph API 測試工具」取得權杖：
   - **Instagram** 勾選：`instagram_basic`、`instagram_content_publish`、`pages_show_list`、`pages_read_engagement`
   - **Facebook** 勾選：`pages_show_list`、`pages_read_engagement`、`pages_manage_posts`
   - 換成粉絲專頁的長期權杖（Page Access Token）
4. 查詢 ID 並填入 `.env`：
   - IG：查 `me/accounts?fields=instagram_business_account`，填進 `IG_USER_ID` 與 `IG_ACCESS_TOKEN`
   - FB：粉絲專頁 ID 填進 `FB_PAGE_ID`，粉專權杖填進 `FB_PAGE_ACCESS_TOKEN`

### 第一次設定 Threads

1. 到 Meta 開發者平台應用程式新增 **Threads** 使用案例
2. 取得具備 `threads_basic` 與 `threads_content_publish` 權限的 User Token
3. 填進 `.env` 的 `THREADS_USER_ID` 與 `THREADS_ACCESS_TOKEN`
4. 因 Threads 官方限制必須由伺服器爬取公開網址，請在 `.env` 設定 `PUBLIC_VIDEO_BASE_URL` 或在 `project.json` 的 `publish.videoUrl` 填入影片下載連結。

### 串接 like-manychat（留言自動私訊）

1. 在 `.env` 填入你的 like-manychat 部署網址與管理員登入帳密：
   ```env
   LIKE_MANYCHAT_URL=https://your-like-manychat.vercel.app
   LIKE_MANYCHAT_EMAIL=your-email@example.com
   LIKE_MANYCHAT_PASSWORD=your-password
   ```
2. 在 `project.json` 的 `publish` 設定 `autoReply`：
   ```json
   "publish": {
     "title": "深呼吸放鬆法",
     "autoReply": {
       "keyword": "呼吸",
       "replyText": "哈囉！這是深呼吸放鬆指引：https://example.com/guide",
       "publicReply": "已私訊你囉！請查看你的小盒子信箱～",
       "tag": "呼吸短影音"
     }
   }
   ```
3. 發佈時（`npm run publish`）會自動同步到 like-manychat 建立或更新規則；也可以隨時手動同步：
   ```bash
   npm run manychat -- breath-01
   ```

## 常見問題

- **字幕用講稿**：AI分身工作室做的影片本來就有講稿，把講稿（`SCRIPT` 那段文字）存成 .txt，建專案時加 `--script 講稿.txt`，或事後跑 `npm run align -- 專案名 講稿.txt`。字用講稿的，語音辨識只拿來對時間
- **字幕有錯字**：直接改 `transcript.txt`，存檔就好，**行首的 `[00:04.0]` 時間不要動**。
  - `npm run render` 會自動把改過的字套進字幕
  - `npm run studio` 開著的時候改也可以，終端機會顯示「已更新字幕」，預覽畫面按 F5 重新整理
  - 想手動套用：`npm run fix-captions -- 專案名`
  - 改過的那句字幕會在原本的時間內平均分配，沒改的句子時間不變
- **語音模型**：預設 `medium`；想更準可以 `WHISPER_MODEL=large-v3 npm run transcribe -- 專案名`（比較慢）
- **影片、音檔不會上傳到 GitHub**（太大），只有剪輯腳本和字幕會

字型：Noto Sans TC Black（SIL Open Font License，見 `public/fonts/LICENSE-OFL.txt`）。
