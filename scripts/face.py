# 找出影片裡的臉在哪裡（npm run face 會呼叫，不用自己跑）
# 用法：python face.py 影片檔 → 印出 JSON：影片大小、每個取樣時間點最大那張臉的位置（像素）
import json
import sys

import cv2

path = sys.argv[1]
step = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

cap = cv2.VideoCapture(path)
if not cap.isOpened():
    print(json.dumps({"error": f"打不開影片：{path}"}))
    sys.exit(1)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
duration = total / fps if total else 0

front = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
profile = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")

# 最多取 90 個時間點
n = max(1, min(90, int(duration / step) if duration else 30))
faces = []
for i in range(n):
    t = (i + 0.5) * (duration / n) if duration else i * step
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    # 縮小加速：長邊 960
    scale = 960 / max(w, h) if max(w, h) > 960 else 1.0
    small = cv2.resize(gray, None, fx=scale, fy=scale) if scale < 1 else gray
    variants = (small, cv2.equalizeHist(small))  # 原圖找不到再試加強對比（太暗的影片）
    min_side = int(min(small.shape) * 0.06)
    found = ()
    # 先用嚴格的條件，找不到再放寬
    for neighbors in (6, 4, 3):
        for img in variants:
            for det in (front, profile):
                found = det.detectMultiScale(img, 1.1, neighbors, minSize=(min_side, min_side))
                if len(found):
                    break
            if len(found):
                break
        if len(found):
            break
    if len(found) == 0:
        continue
    x, y, fw, fh = max(found, key=lambda r: r[2] * r[3])
    faces.append({"t": round(t, 2), "x": x / scale, "y": y / scale, "w": fw / scale, "h": fh / scale})

print(json.dumps({"width": w, "height": h, "duration": duration, "samples": n, "faces": faces}))
