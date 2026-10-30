"""Melted plastic river of Let it Flow from the artist's top-down composite (PLANE copy.png,
in the exhibition's Google Drive folder).

  python3 scripts/make_river.py "PLANE copy.png" public/tex   (then move river.json to src/data/)


The composite is already cut out (alpha). Scale from its 30 cm floor tiles (~1100 px/m),
checked against DSC_0113 with the EXIF focal length: the river runs ~3.4 m out from the
end wall. Image up = towards the end wall (east), image left = north.
Outputs: river.webp (colour + alpha), river-normal.webp, river-height.png, river.json."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, outdir = sys.argv[1], sys.argv[2]
PPM = 1100.0                 # image pixels per metre
WALL_ROW, WALL_X = 650, 25.38  # image row at the end wall -> room x
REF_COL, REF_Z = 1900, 3.65    # image column -> room z (centre of the cluster at the wall)
HMAX = 0.09                    # thickest lumps, metres

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
# colour texture at ~5.5 px/cm, alpha = clean mask (slightly feathered)
S = 0.5
tw, th = int(W * S), int(H * S)
rgb = Image.fromarray(crop[..., :3].astype(np.uint8)).resize((tw, th), Image.LANCZOS)
alpha = Image.fromarray((ndi.gaussian_filter(m.astype(np.float32), 1.2) * 255).astype(np.uint8)).resize((tw, th), Image.LANCZOS)
tex = rgb.copy(); tex.putalpha(alpha)
tex.save(f'{outdir}/river.webp', quality=86, method=6)

# height: domed lumps (distance to the edge, in metres) + relief from the photo's light and shade
dt = ndi.distance_transform_edt(m) / PPM
lum = (crop[..., :3] @ np.array([0.299, 0.587, 0.114])) / 255
relief = lum - ndi.gaussian_filter(lum, 9)
relief = ndi.gaussian_filter(relief, 1.5)
h = HMAX * (1 - np.exp(-dt / 0.03)) * (0.75 + 0.25 * np.clip(dt / 0.12, 0, 1))
h = h + relief * 0.02 * (dt > 0.004)
h = np.where(m, np.maximum(h, 0.004), 0)
# normal map (detail) at texture resolution
hs = np.asarray(Image.fromarray(h.astype(np.float32)).resize((tw, th), Image.BILINEAR))
px = 1 / (PPM * S)
gy, gx = np.gradient(hs, px)
nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
nmap = np.stack([(-gx * nz + 1) / 2, (gy * nz + 1) / 2, (nz + 1) / 2], -1)
Image.fromarray((np.clip(nmap, 0, 1) * 255).astype(np.uint8)).save(f'{outdir}/river-normal.webp', quality=90, method=6)
# coarse height grid for the geometry (~1.6 cm per vertex)
gw, gh = int(W / PPM / 0.016), int(H / PPM / 0.016)
hg = np.asarray(Image.fromarray(h.astype(np.float32)).resize((gw, gh), Image.BILINEAR))
mg = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((gw, gh), Image.BILINEAR)) > 40
hq = np.clip(hg / HMAX * 254, 0, 254).astype(np.uint8) + mg.astype(np.uint8)  # 0 = outside
Image.fromarray(hq).save(f'{outdir}/river-height.png', optimize=True)

meta = {
  'source': 'PLANE copy.png (top-down composite of the installed river)',
  'pxPerMetre': PPM, 'hmax': HMAX,
  # image (u right, v down) -> room: x = xTop - v/ppm, z = zLeft + u/ppm
  'xTop': round(WALL_X - (y0 - WALL_ROW) / PPM, 4), 'zLeft': round(REF_Z + (x0 - REF_COL) / PPM, 4),
  'widthM': round(W / PPM, 4), 'lengthM': round(H / PPM, 4),
  'grid': [gw, gh],
}
json.dump(meta, open(f'{outdir}/river.json', 'w'), indent=2)
print(meta, 'tex', tw, th)
