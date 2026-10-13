import cv2, numpy as np
def clean(img):
    """img: BGR 96x96. Returns cleaned image and whether anything changed."""
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = np.zeros((h, w), np.uint8)
    # 1) red 'book' marker: strongly saturated red block (hue near 0/180), take its bounding box plus its white symbol
    red = (((hsv[..., 0] < 8) | (hsv[..., 0] > 172)) & (hsv[..., 1] > 120) & (hsv[..., 2] > 60)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(red)
    for i in range(1, n):
        x, y, bw, bh, area = st[i]
        smean = hsv[..., 1][lab == i].mean()
        if area > 500 and 24 <= bw <= 34 and 24 <= bh <= 34 and area / (bw * bh) > 0.7 and smean > 215:   # the red 'book' marker
            mask[max(0, y - 3):y + bh + 4, max(0, x - 3):x + bw + 7] = 255
    # 2) badge bottom-left (scroll with '?'): light, low-saturation block in the corner
    corner = img[h - 24:h - 2, 2:24]
    g = cv2.cvtColor(corner, cv2.COLOR_BGR2GRAY)
    if (g > 170).mean() > 0.18:
        mask[h - 25:h - 1, 1:25] = 255
    # 3) small white dash top-left
    tl = cv2.cvtColor(img[2:24, 2:34], cv2.COLOR_BGR2GRAY)
    rows = np.where((tl > 200).mean(axis=1) > 0.3)[0]          # a thin bright horizontal bar
    if len(rows) and len(rows) <= 6:
        y0 = rows.min() + 2; mask[max(0, y0 - 3):y0 + len(rows) + 3, 1:36] = 255
    if not mask.any():
        return img, False
    return cv2.inpaint(img, mask, 6, cv2.INPAINT_TELEA), True
