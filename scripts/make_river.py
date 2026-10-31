"""Melted plastic river of Let it Flow from the artist's top-down composite (PLANE copy.png,
in the exhibition's Google Drive folder).

  python3 scripts/make_river.py "PLANE copy.png" public/tex src/data/river.json

The composite is already cut out (alpha). Scale from its 30 cm floor tiles (~1100 px/m),
checked against DSC_0113 and _artificial paradise 04 - 01 with the EXIF focal length: the
river runs ~3.5 m out from the end wall. Image up = towards the end wall (east), image
left = north.

The relief is read from the photo: soft lumps from the shape and the broad light and shade,
folds from the finer shading, thickness growing from the thin strip at the wall (~3 cm) to
the white heap at the far end (~10 cm, as in the documentation video). Creases are baked
dark into the colour, because the plastic is lit by the projection alone.
Outputs: river.webp (colour + alpha), river-normal.webp, river-height.png; updates the
sizes in river.json and keeps what else is in it."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None
src, outdir, meta_path = sys.argv[1], sys.argv[2], sys.argv[3]
PPM = 1100.0                 # image pixels per metre
WALL_ROW, WALL_X = 650, 25.38  # image row at the end wall -> room x
REF_COL, REF_Z = 1900, 3.65    # image column -> room z (centre of the cluster at the wall)
HMAX = 0.13                    # thickest lumps, metres
S = 0.9                        # texture scale, ~10 px/cm
CELL = 0.008                   # geometry grid, metres
gauss = ndi.gaussian_filter

a = np.asarray(Image.open(src)).astype(np.float32)
al = a[..., 3] / 255
mask = al > 0.5
mask = ndi.binary_opening(mask, iterations=2)
lab, n = ndi.label(mask)
sizes = ndi.sum(mask, lab, range(1, n + 1))
keep = np.isin(lab, 1 + np.where(sizes > 2500)[0])      # drop specks and stray flecks
ys, xs = np.where(keep)
y0, y1, x0, x1 = ys.min() - 20, ys.max() + 20, xs.min() - 20, xs.max() + 20
print('clumps kept', int((sizes > 2500).sum()), 'bbox', x0, y0, x1, y1)

crop = a[y0:y1, x0:x1].copy()
m = keep[y0:y1, x0:x1]
H, W = m.shape
along = np.linspace(0, 1, H)[:, None]                    # 0 at the wall, 1 at the heap

lum = (crop[..., :3] @ np.array([0.299, 0.587, 0.114])) / 255
band = lambda f, c: gauss(lum, f) - gauss(lum, c)


def balanced(b, r):
    """A band of the shading with its local strength evened out, so dark plastic has as
    much relief as white plastic."""
    return np.clip(b / (np.sqrt(gauss(b * b, r)) + 0.012), -2.2, 2.2) / 2.2


dt = ndi.distance_transform_edt(m) / PPM
edge = 1 - np.exp(-dt / 0.022)                           # rises from the floor over ~2 cm
wobble = gauss(np.random.default_rng(16).standard_normal(m.shape), PPM * 0.03)
wobble /= wobble.std()
lumps = balanced(band(16, 70), 120)
folds = balanced(band(3, 16), 60)
fine = balanced(band(0.8, 4), 24)
amp = np.interp(along, [0, 0.55, 0.8, 0.92, 1], [0.03, 0.04, 0.05, 0.085, 0.1])
# low, soft folds: the film lies flat and rounded, the sharp creases are left to the normal map
h = amp * edge * (0.9 + 0.12 * wobble + 0.24 * lumps + 0.12 * folds)
h = gauss(np.where(m, np.clip(h, 0.004, HMAX), 0), PPM * 0.006)
h = np.where(m, np.maximum(h, 0.003), 0)
detailed = h + (0.005 * folds + 0.002 * fine) * edge * m

# crevices: how far a point sits below its surroundings
blur = gauss(detailed, PPM * 0.012)
cavity = np.clip((blur - detailed) / 0.006, 0, 1)
wide = np.clip((gauss(detailed, PPM * 0.04) - detailed) / 0.02, 0, 1)
shade = (1 - 0.6 * cavity) * (1 - 0.3 * wide)

tw, th = int(W * S), int(H * S)
rgb = np.clip(crop[..., :3] * shade[..., None], 0, 255).astype(np.uint8)
rgb = Image.fromarray(rgb).resize((tw, th), Image.LANCZOS)
alpha = Image.fromarray((gauss(m.astype(np.float32), 1.1) * 255).astype(np.uint8)).resize((tw, th), Image.LANCZOS)
tex = rgb.copy(); tex.putalpha(alpha)
tex.save(f'{outdir}/river.webp', quality=84, method=6)

# normal map (all the detail) at texture resolution
hs = np.asarray(Image.fromarray(detailed.astype(np.float32)).resize((tw, th), Image.BILINEAR))
px = 1 / (PPM * S)
gy, gx = np.gradient(hs, px)
gx, gy = gx * 1.6, gy * 1.6
nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
nmap = np.stack([(-gx * nz + 1) / 2, (gy * nz + 1) / 2, (nz + 1) / 2], -1)
Image.fromarray((np.clip(nmap, 0, 1) * 255).astype(np.uint8)).save(f'{outdir}/river-normal.webp', quality=88, method=6)

# height grid for the geometry
gw, gh = int(W / PPM / CELL), int(H / PPM / CELL)
hg = np.asarray(Image.fromarray(h.astype(np.float32)).resize((gw, gh), Image.BILINEAR))
mg = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((gw, gh), Image.BILINEAR)) > 40
hq = np.clip(hg / HMAX * 254, 0, 254).astype(np.uint8) + mg.astype(np.uint8)  # 0 = outside
Image.fromarray(hq).save(f'{outdir}/river-height.png', optimize=True)

with open(meta_path) as f:
    meta = json.load(f)
meta.update({
  'pxPerMetre': PPM, 'hmax': HMAX,
  # image (u right, v down) -> room: x = xTop - v/ppm, z = zLeft + u/ppm
  'xTop': round(WALL_X - (y0 - WALL_ROW) / PPM, 4), 'zLeft': round(REF_Z + (x0 - REF_COL) / PPM, 4),
  'widthM': round(W / PPM, 4), 'lengthM': round(H / PPM, 4),
  'grid': [gw, gh],
})
with open(meta_path, 'w') as f:
    json.dump(meta, f, indent=2)
print({k: meta[k] for k in ('hmax', 'xTop', 'zLeft', 'widthM', 'lengthM', 'grid')}, 'tex', tw, th, 'cells used', int(mg.sum()))
print('height range', float(h[m].min()), float(np.percentile(h[m], 50)), float(h[m].max()))
