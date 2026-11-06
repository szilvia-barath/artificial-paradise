"""Melted plastic river of Let it Flow from the artist's corrected top-down composite
(PLANE javított.png, in the room 4 folder of the exhibition's Google Drive).

  python3 scripts/make_river.py "PLANE javított.png" public/tex src/data/river.json

The composite is cut out (alpha) and laid out in the frame of the floor video Let it Flow
(both 16:9), on the video's own river, so placing the frame places the plastic and the two
coincide. Scale: the installation is 4 x 7 m (the artist's measure), so the frame is 7 m
long and, at 16:9, 3.94 m wide: the room's full width, centred across it. The plastic
scales with it (about 4.7 m long). Image left = towards the end wall (east), image up =
south; the wall tip touches the wall.

The relief is read from the photo: soft lumps from the shape and the broad light and shade,
folds from the finer shading, thickness growing from the thin strip at the wall (~3 cm) to
the white heap at the far end (~10 cm, as in the documentation video). Creases are baked
lightly into the colour.
Outputs: river.webp (colour + alpha), river-normal.webp, river-height.png; writes the
river's place and size, the video frame (projection) and the areas visitors can't walk
into (obstacles) to river.json."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None
src, outdir, meta_path = sys.argv[1], sys.argv[2], sys.argv[3]
FRAME_M = 7.0                  # length of the floor video's frame on the floor, metres
WALL_X = 25.38                 # room x of the wall tip
Z_CENTRE = 3.73                # room z of the frame's centre: the middle of the 4 m room
HMAX = 0.13                    # thickest lumps, metres
CELL = 0.008                   # geometry grid, metres
k = 605.8 / 1100               # filter sizes in image pixels, as tuned on this composite
gauss = ndi.gaussian_filter

full = np.asarray(Image.open(src)).astype(np.float32)
FH, FW = full.shape[:2]
PPM = FW / FRAME_M             # image pixels per metre
mask = ndi.binary_opening(full[..., 3] > 127, iterations=2)
lab, n = ndi.label(mask)
sizes = ndi.sum(mask, lab, range(1, n + 1))
keep = np.isin(lab, 1 + np.where(sizes > 2500 * k * k)[0])      # drop specks and stray flecks
ys, xs = np.where(keep)
pad = int(20 * k)
y0, y1, x0, x1 = ys.min() - pad, ys.max() + pad, xs.min() - pad, xs.max() + pad
x_east = WALL_X + (xs.min() / PPM)
print('clumps kept', int((sizes > 2500 * k * k).sum()), 'bbox', x0, y0, x1, y1, 'frame', FW, FH)

# turned a quarter clockwise, so image up = the end wall and image left = north
crop = np.rot90(full[y0:y1, x0:x1], k=-1).copy()
m = np.rot90(keep[y0:y1, x0:x1], k=-1).copy()
H, W = m.shape
along = np.linspace(0, 1, H)[:, None]                    # 0 at the wall, 1 at the heap

lum = (crop[..., :3] @ np.array([0.299, 0.587, 0.114])) / 255
band = lambda f, c: gauss(lum, f * k) - gauss(lum, c * k)


def balanced(b, r):
    """A band of the shading with its local strength evened out, so dark plastic has as
    much relief as white plastic."""
    return np.clip(b / (np.sqrt(gauss(b * b, r * k)) + 0.012), -2.2, 2.2) / 2.2


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
# kept light, so the plastic keeps the colours of the composite
shade = (1 - 0.25 * cavity) * (1 - 0.1 * wide)

rgb = Image.fromarray(np.clip(crop[..., :3] * shade[..., None], 0, 255).astype(np.uint8))
alpha = Image.fromarray((gauss(m.astype(np.float32), 1.1) * 255).astype(np.uint8))
tex = rgb.copy(); tex.putalpha(alpha)
tex.save(f'{outdir}/river.webp', quality=86, method=6)

# normal map (all the detail) at texture resolution
px = 1 / PPM
gy, gx = np.gradient(detailed, px)
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

# room coordinates: rotated row i = frame column x0 + i, rotated column j = frame row y1 - 1 - j
x_top = x_east - x0 / PPM
z_left = Z_CENTRE + (FH / 2 - (y1 - 1)) / PPM
length, width = H / PPM, W / PPM
# keep visitors off it: one box per 35 cm along the river, around the plastic in that slice
obstacles = []
step = int(0.35 * PPM)
for r0 in range(0, H, step):
    cols = np.where(m[r0:r0 + step].any(axis=0))[0]
    if len(cols):
        obstacles.append([round(x_top - min(r0 + step, H) / PPM, 3), round(x_top - r0 / PPM, 3),
                          round(z_left + cols.min() / PPM - 0.03, 3), round(z_left + cols.max() / PPM + 0.03, 3)])

with open(meta_path) as f:
    meta = json.load(f)
meta.update({
  'source': 'PLANE javított.png (top-down composite of the installed river, in the frame of the floor video)',
  'pxPerMetre': PPM, 'hmax': HMAX,
  # river image (u right, v down) -> room: x = xTop - v/ppm, z = zLeft + u/ppm
  'xTop': round(float(x_top), 4), 'zLeft': round(float(z_left), 4),
  'widthM': round(width, 4), 'lengthM': round(length, 4),
  'grid': [gw, gh],
  'obstacles': obstacles,
  # the floor video's frame, which is the composite's frame
  'projection': {'xEast': round(float(x_east), 3), 'lengthM': round(FW / PPM, 3), 'zCentre': Z_CENTRE, 'widthM': round(FH / PPM, 3)},
})
with open(meta_path, 'w') as f:
    json.dump(meta, f, indent=2)
print({k_: meta[k_] for k_ in ('xTop', 'zLeft', 'widthM', 'lengthM', 'grid', 'projection')}, 'tex', W, H, 'cells used', int(mg.sum()), 'obstacles', len(obstacles))
print('height range', float(h[m].min()), float(np.percentile(h[m], 50)), float(h[m].max()))
cx = x_top - length / 2
print('centre x %.3f z %.3f' % (cx, z_left + width / 2))
