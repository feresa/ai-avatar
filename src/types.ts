// 每支影片一個「剪輯腳本」：public/projects/<專案名>/project.json
// 所有時間都用「原始影片的秒數」（跟 transcript.txt 上的時間一樣），剪掉的段落程式會自動換算
import type { Caption } from "@remotion/captions";

export type HookLine = { text: string; color?: "white" | "yellow" | string };

export type HookIcon = {
  /** public/ 裡的圖片路徑，例如 "icons/premiere.png"；沒有圖就用 label 畫一個方塊 */
  src?: string;
  label?: string;
  bg?: string;
};

export type Hook = {
  /** 開場標題出現的時間（秒） */
  from: number;
  to: number;
  lines: HookLine[];
  /** 標題下方的小膠囊 */
  badge?: string;
  /** 上方一排圖示，strike = 打紅色斜線 */
  icons?: HookIcon[];
  strike?: boolean;
  /** 標題的垂直位置（0 = 最上、1 = 最下） */
  y?: number;
};

export type Zoom = {
  /** 推近開始的時間（秒） */
  at: number;
  /** 推近持續多久（秒），結束後拉回 */
  dur: number;
  /** 放大倍率，例如 1.15 */
  scale: number;
};

export type Sfx = { at: number; src: string; volume?: number };

/** 重點字卡：畫面中間跳出大字，例如「① 腹式呼吸」 */
export type Card = {
  at: number;
  dur: number;
  text: string;
  /** 大字下面的小字（可省略） */
  sub?: string;
  color?: "white" | "yellow" | string;
  /** 垂直位置（0 = 最上、1 = 最下），預設 0.42 */
  y?: number;
};

/** 插圖 / 插入影片（B-roll）：圖片或影片檔放在專案資料夾 */
export type Insert = {
  at: number;
  dur: number;
  src: string;
  /** full = 蓋滿整個畫面；pip = 上方小視窗；top = 上半部 */
  mode?: "full" | "pip" | "top";
  /** 圖片慢慢推近（預設開） */
  kenBurns?: boolean;
  /** 插入影片從第幾秒開始播 */
  start?: number;
  /** 圖片上的說明小字（可省略） */
  label?: string;
  /** 自動產生插圖：AI 畫圖的描述（npm run images 會照這段文字產生 src 這張圖） */
  prompt?: string;
  /** 自動產生插圖：改用免費圖庫 Pexels 的真實照片，填搜尋關鍵字（英文較準） */
  stock?: string;
};

export type TransitionType = "flash" | "zoom" | "whip" | "slide" | "fade" | "glitch" | "zoomblur" | "lightleak";

/** 轉場特效：在某個時間點閃白、推近、甩鏡、滑入、淡黑、故障閃爍 */
export type Transition = {
  at: number;
  type: TransitionType;
  /** 持續多久（秒），預設 0.35 */
  dur?: number;
  /** 加「咻」的音效（預設開） */
  sound?: boolean;
};

/** 貼圖小動畫：內建 check / cross / arrow / heart / star / fire，或任何 emoji 文字、或圖片檔 */
export type Sticker = {
  at: number;
  dur: number;
  kind?: "check" | "cross" | "arrow" | "heart" | "star" | "fire";
  emoji?: string;
  src?: string;
  /** 位置（0~1），預設在右上方 */
  x?: number;
  y?: number;
  /** 大小（佔畫面寬度的比例），預設 0.2 */
  size?: number;
  /** 轉幾度（箭頭指向用） */
  rotate?: number;
  anim?: "pop" | "bounce" | "float";
  /** 跳出來時加「啵」的音效 */
  sound?: boolean;
};

/** like-manychat 留言自動私訊 / 關鍵字規則設定 */
export type AutoReply = {
  /** 觸發關鍵字（逗號分隔），例如 "呼吸,深呼吸,+1" */
  keyword: string;
  /** 規則名稱（選填，預設為影片標題 + 留言自動私訊） */
  name?: string;
  /** 指定貼文 / 影片 ID（逗號分隔，選填；發佈時會自動帶入各平台產生的 Post/Video ID） */
  postId?: string;
  /** 私訊內容（粉絲在 IG / FB 留言後機器人私訊回傳；Threads / YouTube 則作為公開留言回覆） */
  replyText: string;
  /** 留言公開回覆（選填，在 IG / FB 留言底下公開回覆一句） */
  publicReply?: string;
  /** 適用頻道：any | comment | ig_comment | fb_comment | threads_reply | yt_comment | dm，預設 comment */
  channel?: "any" | "comment" | "ig_comment" | "fb_comment" | "threads_reply" | "yt_comment" | "dm";
  /** 匹配模式：contains | exact | regex，預設 contains */
  matchType?: "contains" | "exact" | "regex";
  /** 標籤（命中時自動幫聯絡人貼上的標籤） */
  tag?: string;
  /** 快速回覆按鈕（逗號分隔） */
  quickReplies?: string;
};

/** 聚光燈：畫面四周變暗，焦點在臉（或指定位置） */
export type Spotlight = {
  at: number;
  dur: number;
  /** 變暗程度 0~1，預設 0.8 */
  strength?: number;
  /** 亮的範圍 0~1，預設 0.32 */
  radius?: number;
  /** 亮的中心（0~1），預設是臉的位置 */
  x?: number;
  y?: number;
};

/** 拉遠揭曉：從很近的特寫，一路拉遠到整個畫面 */
export type Reveal = {
  at: number;
  dur: number;
  /** 一開始放大幾倍，預設 2.2 */
  from?: number;
};

/** 便利貼字 */
export type Note = {
  at: number;
  dur: number;
  text: string;
  color?: "yellow" | "pink" | "blue" | "green";
  /** 位置（0~1），預設右邊、臉的下方 */
  x?: number;
  y?: number;
  /** 轉幾度，預設 4 */
  rotate?: number;
  /** 大小（佔畫面寬度），預設 0.36 */
  size?: number;
};

/** 前後對比：左邊 before（圖片或影片）、右邊 after（現在的畫面） */
export type Compare = {
  at: number;
  dur: number;
  /** before 的圖片或影片（放在專案資料夾） */
  before: string;
  beforeLabel?: string;
  afterLabel?: string;
};

/** 手機示範：畫面中跳出一支手機，螢幕裡放圖片或影片 */
export type Phone = {
  at: number;
  dur: number;
  src: string;
  /** 位置（0~1），預設右邊 */
  x?: number;
  y?: number;
  /** 大小（手機寬度佔畫面寬度），預設 0.34 */
  size?: number;
  /** 傾斜角度，預設 -8 */
  tilt?: number;
  /** 影片從第幾秒開始播 */
  start?: number;
};

/** 頭條牆：剪報一張一張貼上來 */
export type Headline = {
  at: number;
  dur: number;
  items: { text: string; tag?: string; date?: string }[];
};

/** 卡片環繞：一圈卡片（圖片或文字）在頭上繞 */
export type Orbit = {
  at: number;
  dur: number;
  /** 圖片檔名（放在專案資料夾）或文字 */
  items: string[];
  /** 環的高度（0~1），預設 0.12（頭頂上方） */
  y?: number;
  /** 繞幾圈，預設 0.5 */
  turns?: number;
};

/** 景深大字：超大的字放在人的後面（要有去背：greenScreen 或 matte） */
export type DepthText = {
  at: number;
  dur: number;
  text: string;
  color?: "white" | "yellow" | string;
  /** 字的垂直位置（0~1），預設在頭的高度 */
  y?: number;
  /** 字的大小（佔畫面寬度），預設依字數自動 */
  size?: number;
};

/** 破框：畫面縮成一張卡片，人的頭和肩膀衝出框外（要有去背） */
export type Breakout = {
  at: number;
  dur: number;
  /** 框外面的背景：圖片／影片檔名，或顏色（預設米白） */
  backdrop?: string;
};

/** 剪貼：人像變成剪下來的貼紙（白邊＋陰影），背景換成紙（要有去背） */
export type Cutout = {
  at: number;
  dur: number;
  /** 背景顏色（預設奶油黃）或圖片 */
  backdrop?: string;
  /** 白邊顏色，預設白色 */
  outline?: string;
};

/** 換背景：某段時間把背景換成圖片或影片（要有去背） */
export type Background = {
  at: number;
  dur: number;
  src: string;
};

/** 雜誌封面：大標題在頭的後面，封面小標在前面（要有去背） */
export type Magazine = {
  at: number;
  dur: number;
  /** 雜誌大標題（2~4 字最好看） */
  title: string;
  /** 上方小字，例如 "ISSUE 01 · 2026" */
  issue?: string;
  /** 封面小標（2~3 句），第一句放左邊、其他放右邊 */
  lines?: string[];
  color?: string;
};

/** 綠幕去背的設定（官方 colorKey） */
export type GreenScreen = {
  /** 綠幕的顏色（npm run green 會自動偵測） */
  color?: string;
  /** 相似度：越大去掉越多，預設 0.2 */
  similarity?: number;
  /** 邊緣柔化，預設 0.08 */
  smoothness?: number;
  /** 去掉頭髮、皮膚邊緣反射的綠光，預設 0.35 */
  spill?: number;
};

/** 發佈到各大社群平台（YouTube / Instagram / Facebook / Threads）用的文字與設定 */
export type PublishPlatform = "youtube" | "instagram" | "facebook" | "threads";

export type Publish = {
  title?: string;
  description?: string;
  tags?: string[];
  /** YouTube 公開程度，預設 private（先自己看過再公開） */
  privacy?: "private" | "unlisted" | "public";
  /** 排程發佈時間（ISO 8601 或 YYYY-MM-DD HH:mm，如 "2026-10-27T10:00:00Z"） */
  scheduleTime?: string;
  /** 公開影片網址（Threads 限制必須提供外部公開 URL 供爬取） */
  videoUrl?: string;
  /** 預設要發布的平台清單 */
  platforms?: PublishPlatform[];
  /** 留言自動私訊規則（可自動同步至 like-manychat） */
  autoReply?: AutoReply;
};

export type Project = {
  /** 影片檔名（放在同一個專案資料夾） */
  video: string;
  /** 原始影片長度（秒），npm run new 會自動填 */
  durationSec: number;
  fps?: number;
  width?: number;
  height?: number;
  /** 直式裁切的焦點：0~1，0.5 = 置中；人在畫面偏上就把 focusY 調小 */
  focusX?: number;
  focusY?: number;
  /** 整支片的基本放大（臉太小時調大，例如 1.2） */
  baseZoom?: number;
  /** 臉在成品畫面的位置（0~1，npm run face 自動填）；推近會往臉放大 */
  face?: { x: number; y: number; w: number; h: number };
  /** 畫出臉的框（檢查位置用，輸出前記得關掉） */
  debugFace?: boolean;
  /** 要保留的段落 [開始秒, 結束秒]；沒填 = 整支保留。npm run cuts 會自動填（剪掉停頓） */
  keep?: [number, number][] | null;
  hook?: Hook | null;
  captions?: {
    enabled?: boolean;
    /** 要用黃色強調的詞 */
    highlight?: string[];
    /** 一行最多幾個字 */
    maxChars?: number;
    /** 字幕的垂直位置（0 = 最上、1 = 最下） */
    y?: number;
    /** 開場標題出現時先不顯示字幕 */
    hideDuringHook?: boolean;
    fontSize?: number;
    /** 字幕提早幾秒出現（語音辨識的時間常常晚一點），預設 0.15，覺得太早可設 0 */
    lead?: number;
  };
  zooms?: Zoom[];
  cards?: Card[];
  inserts?: Insert[];
  stickers?: Sticker[];
  transitions?: Transition[];
  spotlights?: Spotlight[];
  reveals?: Reveal[];
  notes?: Note[];
  compares?: Compare[];
  phones?: Phone[];
  headlines?: Headline[];
  orbits?: Orbit[];
  /** 綠幕：整支片去掉綠色背景（npm run green 自動設定） */
  greenScreen?: GreenScreen | null;
  /** AI 去背的影片（npm run matte 自動產生 matte.webm） */
  matte?: string | null;
  /** 綠幕去背後的預設背景：圖片／影片檔名，或顏色 */
  background?: string;
  backgrounds?: Background[];
  depthTexts?: DepthText[];
  breakouts?: Breakout[];
  cutouts?: Cutout[];
  magazines?: Magazine[];
  /** 一支變多支：npm run variants 會把每個版本都輸出 */
  variants?: Variant[];
  /** 原始影片的寬高（自動填，用來對準裁切位置） */
  sourceWidth?: number;
  sourceHeight?: number;
  /** 每個剪接點（剪掉停頓的地方）都自動加的轉場，例如 "zoom"；null = 不加 */
  cutTransition?: TransitionType | null;
  music?: { src: string; volume?: number } | null;
  publish?: Publish;
  sfx?: Sfx[];
  /** 下半部加深，字比較清楚 */
  gradient?: boolean;
  /** 原始影片的音量（0~1） */
  videoVolume?: number;
};

export type ShortProps = {
  name: string;
  project: Project;
  captions: Caption[];
  /** 要輸出哪個版本（project.variants 裡的 name），沒填就是原版 */
  variant?: string;
};

/** 一支變多支：每個版本只寫跟原版不一樣的地方（開場標題、音樂、特效⋯） */
export type Variant = Partial<Omit<Project, "variants">> & {
  /** 版本名稱（英文或數字），輸出檔名會是 專案名-版本名.mp4 */
  name: string;
};

export const COLORS = {
  white: "#FFFFFF",
  yellow: "#F7E27C",
  stroke: "#1B1B1B",
  red: "#E5484D",
};

export const colorOf = (c?: string) => (c ? (COLORS as Record<string, string>)[c] ?? c : COLORS.white);
