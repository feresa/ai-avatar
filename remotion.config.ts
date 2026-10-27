import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(null);
// 沒有網路下載瀏覽器的環境，可以用環境變數指定本機的 Chrome / Chromium
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
Config.setEntryPoint("./src/index.ts");
// 官方特效庫（聚光燈、穿越、漏光⋯）要用顯示卡（WebGL）算；Mac 用 angle 最穩，沒有顯示卡的環境可設 REMOTION_GL=swangle
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as "angle" | "swangle" | undefined) ?? "angle");
