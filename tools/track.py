"""Трекинг опорных точек на кадрах (OpenCV, оптический поток Лукаса-Канаде).

Для каждой метки задаётся кадр и координата (в пикселях 1280x720). Точка отслеживается
вперёд и назад по последовательности; результат — нормализованные координаты 0..1
(или null, если объект ушёл из кадра). Запуск: python3 tools/track.py
"""
import json, os, sys
import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
FRAMES = os.path.join(ROOT, 'public', 'frames')

ANCHORS = {
    'island': {'atoll': (1, 620, 316)},
    'lagoon': {'boat': (1, 410, 184), 'villa': (130, 330, 112)},
    'giza': {'khufu': (1, 545, 235), 'menkaure': (1, 578, 445)},
    'matterhorn': {'peak': (1, 582, 170)},
}

LK = dict(winSize=(31, 31), maxLevel=4, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))


def load(clip):
    files = sorted(f for f in os.listdir(os.path.join(FRAMES, clip)) if f.endswith('.webp'))
    return [cv2.cvtColor(cv2.imread(os.path.join(FRAMES, clip, f)), cv2.COLOR_BGR2GRAY) for f in files]


def seed(gray, x, y, r=36):
    mask = np.zeros_like(gray)
    cv2.circle(mask, (int(x), int(y)), r, 255, -1)
    pts = cv2.goodFeaturesToTrack(gray, 40, 0.01, 4, mask=mask)
    if pts is None:
        pts = np.array([[[x, y]]], np.float32)
    return pts.astype(np.float32)


def track(frames, start, x, y, step):
    h, w = frames[0].shape
    out = {start: (x, y)}
    pts = seed(frames[start], x, y)
    pos = np.array([x, y], np.float32)
    i = start
    while 0 <= i + step < len(frames):
        nxt, st, _ = cv2.calcOpticalFlowPyrLK(frames[i], frames[i + step], pts, None, **LK)
        ok = st.reshape(-1) == 1
        if ok.sum() < 3:
            break
        delta = np.median(nxt[ok] - pts[ok], axis=0).reshape(2)
        pos = pos + delta
        i += step
        if not (-40 < pos[0] < w + 40 and -40 < pos[1] < h + 40):
            break
        out[i] = (float(pos[0]), float(pos[1]))
        # Периодически пересеиваем точки вокруг текущей позиции, чтобы трек не «уплывал».
        pts = seed(frames[i], *pos) if i % 6 == 0 else nxt[ok].reshape(-1, 1, 2)
    return out


def main():
    result = {}
    for clip, anchors in ANCHORS.items():
        frames = load(clip)
        h, w = frames[0].shape
        result[clip] = {}
        for name, (f, x, y) in anchors.items():
            s = f - 1
            pts = {**track(frames, s, x, y, -1), **track(frames, s, x, y, 1)}
            result[clip][name] = [
                [round(pts[i][0] / w, 4), round(pts[i][1] / h, 4)] if i in pts else None
                for i in range(len(frames))
            ]
        print(clip, {k: sum(p is not None for p in v) for k, v in result[clip].items()}, file=sys.stderr)
    with open(os.path.join(ROOT, 'src', 'tracks.json'), 'w') as fh:
        json.dump(result, fh, separators=(',', ':'))


if __name__ == '__main__':
    main()
