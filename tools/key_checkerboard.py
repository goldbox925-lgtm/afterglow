#!/usr/bin/env python3
"""
AFTERGLOW — texture-aware removal of a BAKED-IN transparency checkerboard.

Why a second tool: the subject is a platinum-blonde woman. Her hair is almost as
colour-neutral as the grey/white checkerboard, so a colour key (remove_checkerboard.py)
punches holes in the hair and translucent fabric. This version keys on TEXTURE:

  1. Checker tiles are flat (~10 px squares, two brightness levels, R=G=B±3).
     A pixel is a background seed when it is neutral, near one of the two
     measured checker levels, and its 3x3 neighbourhood is flat.
  2. Thin tile boundaries are closed morphologically; only regions connected to
     the image border (plus large enclosed gaps, e.g. between arm and body) are
     background. Isolated flat patches inside the hair stay foreground.
  3. Edge band: each pixel is "un-mixed" against the LOCAL checker colour
     (nearest true background pixel) using the minimum alpha that explains it,
     and its colour is de-contaminated. Soft neon glow over the checker becomes
     real semi-transparent glow instead of a grey haze.

It is still an approximation. Real alpha exported from the image tool is better,
and the loader prefers a real-alpha PNG automatically when you supply one.

usage: python3 tools/key_checkerboard.py in.png out.webp [--preview preview.png]
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.signal import fftconvolve


def measure_levels(rgb):
    """The two checker brightness levels, measured on the image border."""
    b = np.concatenate([rgb[:16].reshape(-1, 3), rgb[-16:].reshape(-1, 3),
                        rgb[:, :16].reshape(-1, 3), rgb[:, -16:].reshape(-1, 3)]).astype(np.float32)
    neutral = (b.max(1) - b.min(1)) <= 4
    lum = b[neutral].mean(1)
    hi = np.percentile(lum, 90)
    lo_cands = lum[lum < hi - 15]
    lo = np.median(lo_cands) if lo_cands.size > 50 else hi - 40
    return float(lo), float(hi)


def measure_period(lum):
    """Average checker tile size (px) from luminance steps along the top/left border rows."""
    steps = []
    for line in (lum[4, :], lum[:, 4], lum[-5, :], lum[:, -5]):
        d = np.abs(np.diff(line)) > 12
        idx = np.where(d)[0]
        if idx.size > 4:
            idx = idx[np.concatenate([[True], np.diff(idx) > 2])]
            g = np.diff(idx)
            g = g[(g > 5) & (g < 30)]
            steps.extend(g.tolist())
    return float(np.clip(np.mean(steps), 8, 14)) if steps else 10.0


def key(path):
    im = Image.open(path).convert('RGB')
    rgb = np.asarray(im).astype(np.float32)
    h, w = rgb.shape[:2]
    lum = rgb.mean(2)
    chroma = rgb.max(2) - rgb.min(2)
    lo, hi = measure_levels(rgb)

    # 1. seeds: neutral, on a checker level, locally flat
    on_level = (np.abs(lum - hi) <= 5) | (np.abs(lum - lo) <= 6)
    mean = ndi.uniform_filter(lum, 3)
    var = ndi.uniform_filter(lum * lum, 3) - mean * mean
    flat = var < 6.0
    seed = (chroma <= 4) & on_level & flat

    # 2. close tile boundaries (1-2 px lines between squares), but only through neutral pixels
    neutralish = (chroma <= 7) & (lum > lo - 20)
    closed = ndi.binary_closing(seed, structure=np.ones((7, 7)), iterations=1) & neutralish
    closed |= seed
    lab, n = ndi.label(closed)
    border_ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border_ids[border_ids > 0])
    # enclosed gaps: large, mostly-seed components (a gap between an arm and the body)
    sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    seedfrac = ndi.mean(seed.astype(np.float32), lab, index=np.arange(1, n + 1))
    for i, (s, f) in enumerate(zip(sizes, seedfrac), start=1):
        if s > 2500 and f > 0.8:
            bg |= lab == i
    bg = ndi.binary_opening(bg, structure=np.ones((3, 3)))

    # 2b. where is the checker pattern still visible (glow painted over it)?
    #     quadrature (Gabor-like) filters tuned to the measured tile period
    p = measure_period(lum)
    win = int(round(p * 2.4))
    yy, xx = np.mgrid[-win:win + 1, -win:win + 1].astype(np.float32)
    env = np.exp(-(xx * xx + yy * yy) / (2 * (p * 1.1) ** 2))
    k = np.pi / p
    hp = lum - ndi.gaussian_filter(lum, p * 0.9)
    energy = np.zeros_like(lum)
    for fx in (np.sin, np.cos):
        for fy in (np.sin, np.cos):
            ker = env * fx(k * xx) * fy(k * yy)
            ker -= ker.mean()
            r = fftconvolve(hp, ker, mode='same')
            energy += r * r
    norm = fftconvolve(hp * hp, env, mode='same') * float((env * env).sum()) + 1e-3
    ratio = energy / norm
    amp = np.sqrt(np.maximum(fftconvolve(hp * hp, env / env.sum(), mode='same'), 0))
    cv_raw = ((ratio > 0.15) & (amp > 4.0))
    # pure, untinted checker that the flatness test missed (tile edges, soft areas) is background too
    bg2 = bg | (cv_raw & (chroma <= 5) & (lum > lo - 20))
    lab2, n2 = ndi.label(ndi.binary_closing(bg2, structure=np.ones((5, 5))))
    ids2 = np.unique(lab2[bg])
    keep = np.isin(lab2, ids2[ids2 > 0])
    # enclosed checker gaps (between legs, behind fabric): any sizeable neutral component
    # that the periodic detector recognises as checker, even if it does not touch the border
    sz2 = ndi.sum(np.ones_like(lab2), lab2, index=np.arange(1, n2 + 1))
    cvf = ndi.mean(cv_raw.astype(np.float32), lab2, index=np.arange(1, n2 + 1))
    enclosed = [i for i, (a_, c_) in enumerate(zip(sz2, cvf), start=1) if a_ > 600 and c_ > 0.5]
    keep |= np.isin(lab2, enclosed)
    bg = keep & (bg2 | ndi.binary_dilation(bg, iterations=2))

    # 3. PREDICT the checker under the subject and measure how much of it still shows.
    #    The pattern = cos(k(x+y)+a) + cos(k(x-y)+b). Its two diagonal phases are measured on
    #    the background with complex filters, then carried linearly from the nearest background
    #    pixel. The local amplitude of that predicted pattern = visibility of the background
    #    = 1 - alpha. Subtracting it removes the checker without blurring hair strands.
    yy2, xx2 = yy, xx
    z1 = fftconvolve(hp, env * np.exp(1j * k * (xx2 + yy2)), mode='same')
    z2 = fftconvolve(hp, env * np.exp(1j * k * (xx2 - yy2)), mode='same')
    # phase is reliable a couple of px inside the background, away from the subject's influence
    ref = ndi.binary_erosion(bg, iterations=int(p))
    if ref.sum() < 1000:
        ref = bg
    ref_bg = ref
    _, (ry, rx) = ndi.distance_transform_edt(~ref, return_indices=True)
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    psi1 = np.angle(z1)[ry, rx] - k * ((X - rx) + (Y - ry))  # (convolution flips the kernel: phase decreases)
    psi2 = np.angle(z2)[ry, rx] - k * ((X - rx) - (Y - ry))
    S = np.cos(psi1) + np.cos(psi2)
    S = np.tanh(2.2 * S)                         # sharpen the sinusoid towards square tiles
    # local least-squares amplitude of the predicted pattern
    g = p * 0.8
    num = ndi.gaussian_filter(hp * S, g)
    den = ndi.gaussian_filter(S * S, g) + 1e-3
    amp_loc = num / den
    A_bg = np.median(amp_loc[ref_bg]) if ref_bg.any() else (hi - lo) / 2
    vis = np.clip(amp_loc / max(A_bg, 1e-3), 0, 1)
    dist_out = ndi.distance_transform_edt(~bg)
    reach = p * 9                                 # trust the propagated phase ~7 tiles in
    fade = np.clip(1 - (dist_out - reach * 0.6) / (reach * 0.4), 0, 1)
    vis = vis * fade
    vis = np.where(bg, 1.0, vis)
    vis = np.where(vis < 0.12, 0.0, vis)          # noise floor inside the hair core

    # remove the predicted tile modulation (neutral, same in every channel)
    clean = rgb - (np.clip(amp_loc, 0, A_bg * 1.2) * S * fade)[..., None] * (~bg)[..., None]
    alpha = 1 - vis
    alpha = ndi.gaussian_filter(alpha, 0.7)
    alpha[bg & (ndi.distance_transform_edt(bg) > 2)] = 0
    alpha = np.where(alpha > 0.9, 1.0, alpha / 0.9)
    # un-mix against the average tile grey
    eps = 1e-3
    Bav = (lo + hi) * 0.5
    F_hi = np.clip((clean - (1 - alpha)[..., None] * Bav) / np.maximum(alpha, 0.05)[..., None], 0, 255)
    # thin glow (low alpha): dividing by alpha amplifies any residual tile edge, so un-mix a
    # low-pass of the cleaned colour there; keep full detail where she is mostly opaque
    a_lp = np.maximum(ndi.gaussian_filter(alpha, p * 0.6), 0.03)
    c_lp = np.dstack([ndi.gaussian_filter(clean[..., c] * alpha, p * 0.6) for c in range(3)]) / a_lp[..., None]
    c_lp = np.dstack([ndi.gaussian_filter(clean[..., c], p * 0.6) for c in range(3)])
    F_lo = np.clip((c_lp - (1 - a_lp)[..., None] * Bav) / a_lp[..., None], 0, 255)
    wd = np.clip((alpha - 0.35) / 0.45, 0, 1)[..., None]
    F = F_lo * (1 - wd) + F_hi * wd
    # alpha itself must not carry tile edges either
    alpha = np.where(alpha < 0.8, np.minimum(alpha, ndi.gaussian_filter(alpha, 2.0) * 1.05), alpha)
    F = np.where(alpha[..., None] >= 0.999, np.clip(clean, 0, 255), F)  # pattern-subtracted, not the original
    # painted aura over a still-visible checker, far from the background (no phase there):
    # wherever the texture detector sees the checker on its own, replace colour + alpha with a
    # tile-scale low-pass un-mixed against the average tile grey -> smooth glow, no squares
    cvm = ndi.gaussian_filter(cv_raw.astype(np.float32), p * 0.7)
    cvm = np.clip((cvm - 0.2) / 0.35, 0, 1) * (~bg)
    sg = p * 1.0
    lp = np.dstack([ndi.gaussian_filter(rgb[..., c], sg) for c in range(3)])
    ga_d = np.max((Bav - lp) / Bav, axis=2)
    ga_b = np.max((lp - Bav) / max(255.0 - Bav, 1.0), axis=2)
    ga = np.clip(np.maximum(ga_d, ga_b) * 1.1, 0, 1)
    gF = np.clip(Bav + (lp - Bav) / np.maximum(ga, 0.05)[..., None], 0, 255)
    alpha = alpha * (1 - cvm) + ga * cvm
    F = F * (1 - cvm[..., None]) + gF * cvm[..., None]

    # drop small disconnected islands (stray specks of checker or noise)
    labA, nA = ndi.label(alpha > 0.05)
    if nA > 1:
        szA = ndi.sum(np.ones_like(labA), labA, index=np.arange(1, nA + 1))
        big = szA.max()
        small = [i for i, a_ in enumerate(szA, start=1) if a_ < max(400, big * 0.002)]
        alpha[np.isin(labA, small)] = 0
    alpha[:4] = 0; alpha[-4:] = 0; alpha[:, :4] = 0; alpha[:, -4:] = 0
    out = np.dstack([F, alpha * 255]).astype(np.uint8)
    # crop to subject + margin
    ys, xs = np.where(alpha > 0.02)
    m = 12
    y0, y1 = max(0, ys.min() - m), min(h, ys.max() + m)
    x0, x1 = max(0, xs.min() - m), min(w, xs.max() + m)
    stats = {'period': round(p, 1), 'levels': (round(lo), round(hi)), 'bg_frac': round(float(bg.mean()), 3),
             'crop': (int(x1 - x0), int(y1 - y0))}
    return Image.fromarray(out[y0:y1, x0:x1], 'RGBA'), stats


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    img, stats = key(src)
    if dst.endswith('.webp'):
        img.save(dst, 'WEBP', quality=90, method=6, exact=True)
    else:
        img.save(dst, optimize=True)
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        bgc = Image.new('RGBA', img.size, (10, 12, 25, 255))
        bgc.alpha_composite(img)
        bgc.convert('RGB').save(p)
    print(src, '->', dst, stats)
