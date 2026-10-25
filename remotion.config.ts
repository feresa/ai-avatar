import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(null);
// 沒有網路下載瀏覽器的環境，可以用環境變數指定本機的 Chrome / Chromium
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
Config.setEntryPoint("./src/index.ts");
