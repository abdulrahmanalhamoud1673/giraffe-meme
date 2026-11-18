#!/usr/bin/env python3
"""Musical fidget card (3D printable): a row of thin tines hanging from a bar, each one tuned to one note of a tune.
Drag a fingernail or a pen across the free ends, left to right, and the tune plays.
    python3 make_fidget.py [out.stl] [--calibrate 1.0]
Needs: pip install trimesh manifold3d numpy pillow
Tine length for a note: f = 0.5596 * t / L^2 * sqrt(E / (12 rho))   (cantilever beam, first mode)
Printed plastic is not exactly the textbook number. Print once and play it: if every note sounds too HIGH,
use --calibrate 1.05 (longer tines, lower notes); too LOW: --calibrate 0.95. Then print again.
"""
import sys, math
import numpy as np, trimesh
from PIL import Image, ImageDraw

# ---- the tune: note name -> frequency (equal temperament, A4 = 440)
def freq(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, octv = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (octv + 1) - 69) / 12)

TUNE = ['E5', 'D5', 'F#4', 'G#4', 'C#5', 'B4', 'D4', 'E4', 'B4', 'A4', 'C#4', 'E4', 'A4']   # the well-known phone ringtone phrase

# ---- material and sizes (mm)
E_PA, RHO = 3.0e9, 1240.0       # PLA (printed value is a bit lower than the 3.5 GPa of the datasheet)
T = 1.2                           # tine thickness (3 layers of 0.4 mm are fine; keep it a multiple of your layer height)
W, GAP = 2.6, 1.0                 # tine width, gap
FRAME_T = 2.4                     # frame and bar thickness
SIDE, TOP, BOTTOM = 3.0, 4.0, 3.5
STEP = 0.1

def tine_length_mm(f, calibrate=1.0):
    k = 0.5596 * math.sqrt(E_PA / (12 * RHO))            # m/s
    L = math.sqrt(k * (T / 1000) / f) * 1000              # mm
    return round(L * calibrate / STEP) * STEP

def build(tune=TUNE, calibrate=1.0):
    lens = [tine_length_mm(freq(n), calibrate) for n in tune]
    n = len(tune); pitch = W + GAP
    inner_w = n * pitch - GAP + 2 * 1.0
    win_h = max(lens) + 2.0
    width = inner_w + 2 * SIDE
    height = TOP + win_h + BOTTOM
    boxes, rects = [], []
    def add(x0, y0, x1, y1, z1, tag):          # x right, y up (y=0 at the bottom edge of the bar), z up
        e = [x1 - x0, y1 - y0, z1]
        b = trimesh.creation.box(extents=e); b.apply_translation([x0 + e[0] / 2, y0 + e[1] / 2, z1 / 2]); boxes.append(b); rects.append((x0, y0, x1, y1, z1, tag))
    ov = 0.2                                    # small overlaps so the union is one solid
    add(0, 0, width, BOTTOM + ov, FRAME_T, 'f')                          # bottom bar
    add(0, BOTTOM, SIDE + ov, height, FRAME_T, 'f')                      # left
    add(width - SIDE - ov, BOTTOM, width, height, FRAME_T, 'f')          # right
    add(0, height - TOP - ov, width, height, FRAME_T, 'f')               # top bar (the spine)
    x = SIDE + 1.0
    ytop = height - TOP
    for L in lens:
        add(x, ytop - L, x + W, ytop + ov, T, 't'); x += pitch
    m = trimesh.boolean.union(boxes, engine='manifold')
    return m, lens, rects, (width, height)

def preview(rects, size, lens, tune, path):
    s = 12; W_, H_ = int(size[0] * s), int(size[1] * s)
    im = Image.new('RGB', (W_ + 40, H_ + 40), '#f4efe6'); d = ImageDraw.Draw(im)
    for (x0, y0, x1, y1, z, tag) in rects:
        d.rectangle([20 + x0 * s, 20 + (size[1] - y1) * s, 20 + x1 * s, 20 + (size[1] - y0) * s], fill='#0b6b43' if tag == 'f' else '#d4ab5c')
    im.save(path)

if __name__ == '__main__':
    out = 'musical-fidget.stl'; cal = 1.0; a = sys.argv[1:]
    while a:
        x = a.pop(0)
        if x == '--calibrate': cal = float(a.pop(0))
        else: out = x
    m, lens, rects, size = build(calibrate=cal)
    m.export(out)
    preview(rects, size, lens, TUNE, out.replace('.stl', '.png'))
    print('watertight:', m.is_watertight, '| size mm: %.1f x %.1f x %.1f' % (size[0], size[1], FRAME_T), '| volume cm3: %.2f' % (m.volume / 1000))
    for n, L in zip(TUNE, lens): print('%-3s %6.1f Hz  tine %.1f mm' % (n, freq(n), L))
