// 重新產生 src/projects.ts（public/projects/ 底下的專案清單）。npm install 之後會自動跑
import { syncProjectList } from "./lib";

console.log(`📂 專案：${syncProjectList().join("、") || "（還沒有）"}`);
