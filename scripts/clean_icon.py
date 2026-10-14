"""Remove the in-game overlays from Market icons (96x96 BGR): red 'book' marker, red no-sign, '?' scroll badge
(bottom-left), green arrow and white dash (top-left). Each overlay is found by masked template matching
(templates in scripts/marker_*.npy: BGR + mask) and painted over with OpenCV inpainting."""
import os, cv2, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
# name: (search region x0, x1, y0, y1 for the template's top-left corner, minimum score)
SPEC = {'book': (26, 42, 26, 60, 0.70), 'nosign': (26, 42, 26, 60, 0.60), 'badge': (0, 8, 66, 78, 0.50), 'arrow': (0, 8, 0, 8, 0.55)}
T = {k: np.load(os.path.join(HERE, f'marker_{k}.npy')) for k in SPEC}

def clean(img):
    mask = np.zeros(img.shape[:2], np.uint8)
    for k, (x0, x1, y0, y1, th) in SPEC.items():
        t = T[k]; r, m = t[..., :3].astype(np.uint8), t[..., 3].astype(np.uint8); h, w = m.shape
        roi = img[y0:min(96, y1 + h), x0:min(96, x1 + w)]
        if roi.shape[0] < h or roi.shape[1] < w:
            continue
        sc = cv2.matchTemplate(roi, r, cv2.TM_CCOEFF_NORMED, mask=m); sc[~np.isfinite(sc)] = -1
        _, v, _, loc = cv2.minMaxLoc(sc)
        if v >= th:
            x, y = loc[0] + x0, loc[1] + y0
            mask[y:y + h, x:x + w] |= cv2.dilate(m, np.ones((5, 5), np.uint8))
    # thin white dash in the top-left corner
    tl = cv2.cvtColor(img[2:24, 2:34], cv2.COLOR_BGR2GRAY)
    rows = np.where((tl > 200).mean(axis=1) > 0.3)[0]
    if len(rows) and len(rows) <= 6:
        y0 = rows.min() + 2; mask[max(0, y0 - 3):y0 + len(rows) + 3, 1:36] = 255
    if not mask.any():
        return img, False
    return cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA), True
