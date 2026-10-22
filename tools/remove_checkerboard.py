#!/usr/bin/env python3
"""
AFTERGLOW — remove a *baked-in* transparency checkerboard from a character PNG.

Some image generators export "transparent" PNGs that are really RGB images with a
grey/white checkerboard painted behind the subject. This script makes an
*approximate* cut-out:

  1. pixels that look like checkerboard (near-neutral grey/white, high luminance)
     and are connected to the image border are flood-filled as background;
  2. the edge is feathered and de-contaminated (the grey fringe is pulled out of
     semi-transparent edge pixels);
  3. the result is cropped to the subject and saved as RGBA.

It is a stop-gap: translucent fabric and very pale hair over the checkerboard
cannot be recovered perfectly. Re-exporting with real alpha is always better.

usage: python3 tools/remove_checkerboard.py in.png out.png
"""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

def checker_mask(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    return ((mx - mn) <= 13) & (mn >= 176)

def flood(cand, seed):
    """grow `seed` through 4-connected pixels where `cand` is true"""
    h, w = cand.shape
    out = seed.copy()
    q = deque(zip(*np.nonzero(seed)))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; q.append((ny, nx))
    return out

def flood_from_border(cand):
    h, w = cand.shape
    bg = np.zeros_like(cand)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    return bg

def main(src, dst):
    im = Image.open(src).convert('RGB')
    rgb = np.asarray(im).astype(np.int32)
    bg = flood_from_border(checker_mask(rgb))
    # pass 2: glow painted OVER the checkerboard (pink/cyan halo around hair and
    # fabric). It is bright and cool/magenta-tinted, unlike warm platinum hair and
    # skin (whose blue channel is the lowest). Grown outward from the background,
    # it is kept as faint translucent glow instead of an opaque pale patch.
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    chroma = mx - mn
    cool = (b >= r - 6) | (g <= np.minimum(r, b) - 4)
    halo_c = (mn >= 140) & cool & (chroma <= 110)
    seed = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    halo = flood(halo_c | bg, seed & (halo_c | bg)) & ~bg
    hard = np.where(bg | halo, 0, 255).astype(np.uint8)
    glow_a = np.clip(chroma / 110.0, 0, 1) * 0.45
    # blur the glow alpha so the alternating checker cells average out
    glow_a = np.asarray(Image.fromarray((glow_a * halo * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))).astype(np.float32) / 255.0
    alpha = Image.fromarray(hard)
    # remove pin-holes and feather
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(alpha).astype(np.float32) / 255.0
    a = np.where(halo, np.maximum(a, glow_a), a)
    # de-contaminate: assume edge pixels = a*F + (1-a)*grey(225)
    grey = 225.0
    f = rgb.astype(np.float32)
    aa = np.clip(a, 0.05, 1.0)[..., None]
    fg = np.clip((f - (1 - aa) * grey) / aa, 0, 255)
    out = np.dstack([np.where(a[..., None] < 0.999, fg, f), a * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    bbox = img.getbbox()
    if bbox:
        pad = 8
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad))
        img = img.crop(bbox)
    img.save(dst, optimize=True)
    print(f"{src} -> {dst}  {img.size[0]}x{img.size[1]}  background removed: {bg.mean() * 100:.1f}%, halo softened: {halo.mean() * 100:.1f}%")

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
