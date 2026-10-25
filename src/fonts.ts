import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// 粗黑體（Noto Sans TC Black，開源字型 SIL OFL）：放在專案裡，輸出時不用連網路下載
export const fontFamily = "NotoSansTCBlack";

loadFont({
  family: fontFamily,
  url: staticFile("fonts/NotoSansTC-Black.ttf"),
  weight: "900",
});
