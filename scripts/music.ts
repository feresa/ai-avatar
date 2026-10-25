// npm run music -- <專案名> [calm|warm|upbeat]
// 自動產生背景音樂（長度剛好跟成品一樣），寫進剪輯腳本
import path from "node:path";
import { outDuration, segmentsOf } from "../src/timeline";
import { die, projectDir, readProject, writeProject } from "./lib";
import { MOODS, type Mood, music, writeWav } from "./synth";

const [name, moodArg] = process.argv.slice(2);
if (!name) die("用法：npm run music -- 專案名 [calm|warm|upbeat]\n   calm = 平靜（預設）、warm = 溫暖、upbeat = 輕快有鼓");
const mood = (moodArg ?? "calm") as Mood;
if (!(mood in MOODS)) die(`沒有「${mood}」這種風格，可以用：${Object.keys(MOODS).join("、")}`);

const p = readProject(name);
const seconds = outDuration(segmentsOf(p)) + 1;
const [L, R] = music(mood, seconds);
const file = `music-${mood}.wav`;
writeWav(path.join(projectDir(name), file), L, R);
writeProject(name, { ...p, music: { src: file, volume: p.music?.volume ?? 0.12 } });
console.log(`🎵 背景音樂完成：${file}（${seconds.toFixed(1)} 秒，風格 ${mood}），已寫進 project.json`);
console.log("   太大聲／太小聲：改 project.json 的 music.volume（預設 0.12）");
