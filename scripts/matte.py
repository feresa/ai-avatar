# AI 去背（RobustVideoMatting）：npm run matte 會呼叫，不用自己跑
# stdin 讀一張張 PNG 畫面，stdout 輸出 RGBA 的 PNG（人保留、背景透明），進度印在 stderr
# （Remotion 內建的 ffmpeg 沒有 rawvideo 格式，所以用 PNG 傳）
# 用法：python matte.py 寬 高 模型檔 [裝置 auto|mps|cuda|cpu]
import io
import sys

import numpy as np
import torch
from PIL import Image

w, h = int(sys.argv[1]), int(sys.argv[2])
model_path = sys.argv[3]
want = sys.argv[4] if len(sys.argv) > 4 else "auto"

if want == "auto":
    if torch.cuda.is_available():
        device = "cuda"
    elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
else:
    device = want

model = torch.jit.load(model_path, map_location="cpu").eval()
try:
    model = model.to(device)
except Exception:
    device = "cpu"
    model = model.to(device)
sys.stderr.write(f"device={device}\n")
sys.stderr.flush()

# 模型內部用比較小的解析度判斷「哪裡是人」，邊緣再用原解析度細修：長邊約 512 最穩
ratio = min(1.0, 512 / max(w, h))
rec = [None] * 4
stdin = sys.stdin.buffer
stdout = sys.stdout.buffer
SIG = b"\x89PNG\r\n\x1a\n"


def read_png():
    """從 stdin 讀出一張完整的 PNG（讀到 IEND 為止），讀完回傳 None"""
    head = stdin.read(8)
    if len(head) < 8:
        return None
    if head != SIG:
        raise ValueError("收到的不是 PNG")
    parts = [head]
    while True:
        lt = stdin.read(8)
        if len(lt) < 8:
            return None
        length = int.from_bytes(lt[:4], "big")
        parts.append(lt + stdin.read(length + 4))
        if lt[4:8] == b"IEND":
            return b"".join(parts)


n = 0
with torch.no_grad():
    while True:
        png = read_png()
        if png is None:
            break
        rgb = np.asarray(Image.open(io.BytesIO(png)).convert("RGB"))
        src = torch.from_numpy(rgb.copy()).to(device).permute(2, 0, 1).unsqueeze(0).float() / 255.0
        try:
            fgr, pha, *rec = model(src, *rec, ratio)
        except Exception as e:
            # 某些裝置（例如舊版 mps）跑不動就改用 CPU
            if device == "cpu":
                raise
            sys.stderr.write(f"{device} 失敗，改用 CPU：{e}\n")
            device = "cpu"
            model = model.to("cpu")
            rec = [None] * 4
            src = src.to("cpu")
            fgr, pha, *rec = model(src, *rec, ratio)
        # 顏色用原畫面（最自然），透明度用模型算出來的
        alpha = (pha[0, 0].clamp(0, 1) * 255).round().byte().cpu().numpy()
        out = np.empty((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
        out[:, :, :3] = rgb
        out[:, :, 3] = alpha
        b = io.BytesIO()
        Image.fromarray(out, "RGBA").save(b, format="PNG", compress_level=1)
        stdout.write(b.getvalue())
        n += 1
        if n % 30 == 0:
            sys.stderr.write(f"frames={n}\n")
            sys.stderr.flush()

stdout.flush()
sys.stderr.write(f"done={n}\n")
