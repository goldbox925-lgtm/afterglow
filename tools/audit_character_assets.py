#!/usr/bin/env python3
"""
AFTERGLOW — audit the character PNGs before you ship them.

Checks every image in assets/character/ for:
  * real transparency (an alpha channel that is actually used)
  * a baked-in "fake transparency" checkerboard (RGB pixels painted grey/white)
  * byte-identical duplicates (e.g. one pose exported twice under two names)
  * low resolution and subjects touching the image edge (cropped hair/fabric)

usage: python3 tools/audit_character_assets.py [assets/character]
"""
import hashlib
import os
import sys

import numpy as np
from PIL import Image


def audit(path):
    im = Image.open(path)
    rgba = np.asarray(im.convert('RGBA')).astype(np.int32)
    h, w = rgba.shape[:2]
    a = rgba[..., 3]
    has_alpha = im.mode in ('RGBA', 'LA') and (a < 250).mean() > 0.01
    border = np.concatenate([rgba[:12].reshape(-1, 4), rgba[-12:].reshape(-1, 4),
                             rgba[:, :12].reshape(-1, 4), rgba[:, -12:].reshape(-1, 4)])
    opaque = border[border[:, 3] > 245][:, :3]
    checker = False
    if not has_alpha and len(opaque) > 0.9 * len(border):
        mx, mn = opaque.max(1), opaque.min(1)
        neutral_light = ((mx - mn) <= 14) & (mn >= 170)
        if neutral_light.mean() > 0.85:
            lum = opaque[neutral_light].mean(1)
            # two clusters (light / grey squares)
            checker = (lum > 240).mean() > 0.2 and (lum < 238).mean() > 0.2
    notes = []
    if checker:
        notes.append('BAKED CHECKERBOARD (no real transparency)')
    elif not has_alpha:
        notes.append('NO TRANSPARENCY')
    if has_alpha:
        ys, xs = np.nonzero(a > 20)
        if len(xs):
            if xs.min() <= 1 or xs.max() >= w - 2 or ys.min() <= 1:
                notes.append('subject touches the image edge')
            if (ys.max() - ys.min()) < 700 and (xs.max() - xs.min()) < 900:
                notes.append(f'low resolution subject ({xs.max() - xs.min() + 1}×{ys.max() - ys.min() + 1} px)')
    return {'size': f'{w}×{h}', 'mode': im.mode, 'alpha': has_alpha, 'checker': checker, 'notes': notes}


def main(folder):
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith('.png'))
    hashes = {}
    for f in files:
        with open(os.path.join(folder, f), 'rb') as fh:
            hashes.setdefault(hashlib.md5(fh.read()).hexdigest(), []).append(f)
    print(f'{"file":24} {"size":10} {"mode":5} {"alpha":6} notes')
    for f in files:
        r = audit(os.path.join(folder, f))
        dup = [g for g in next(v for v in hashes.values() if f in v) if g != f]
        notes = r['notes'] + ([f'DUPLICATE of {", ".join(dup)}'] if dup else [])
        print(f'{f:24} {r["size"]:10} {r["mode"]:5} {str(r["alpha"]):6} {"; ".join(notes) or "OK"}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'assets/character')
