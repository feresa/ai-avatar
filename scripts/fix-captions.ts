// npm run fix-captions -- <專案名>
// 把 transcript.txt 改過的字寫回 captions.json（render / studio 會自動做，這是手動版）
import { applyTranscript, die, readProject } from "./lib";

const name = process.argv[2] ?? die("用法：npm run fix-captions -- 專案名");
readProject(name);
const n = applyTranscript(name, true);
console.log(n ? `✅ 改了 ${n} 句，字幕已更新` : "逐字稿跟字幕一樣，沒有要改的");
