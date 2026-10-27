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

export type TransitionType = "flash" | "zoom" | "whip" | "slide" | "fade" | "glitch";

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

/** 發佈到 YouTube / Instagram 用的文字 */
export type Publish = {
  title?: string;
  description?: string;
  tags?: string[];
  /** YouTube 公開程度，預設 private（先自己看過再公開） */
  privacy?: "private" | "unlisted" | "public";
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
};

export const COLORS = {
  white: "#FFFFFF",
  yellow: "#F7E27C",
  stroke: "#1B1B1B",
  red: "#E5484D",
};

export const colorOf = (c?: string) => (c ? (COLORS as Record<string, string>)[c] ?? c : COLORS.white);
