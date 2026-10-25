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
  };
  zooms?: Zoom[];
  music?: { src: string; volume?: number } | null;
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
