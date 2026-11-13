#!/usr/bin/env python3
"""Cuts the page colour out of headless captures (made with gen.mjs --bg) so the stage page can show them over its own ring.
usage: key.py <frames-in> <frames-out>"""
import sys, os, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
BG = np.array([0x12, 0x13, 0x16])
for name in sorted(os.listdir(src)):
    a = np.array(Image.open(os.path.join(src, name)).convert("RGBA"))
    a[..., 3] = np.where((np.abs(a[..., :3].astype(int) - BG).sum(-1) <= 2), 0, 255)
    # outside the artboard the renderer paints its own grey
    a[..., 3] = np.where((a[..., :3] == 29).all(-1), 0, a[..., 3])
    Image.fromarray(a).save(os.path.join(out, name), optimize=False, compress_level=6)
print(len(os.listdir(out)))
