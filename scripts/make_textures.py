"""Wall textures cut from the exhibition photos.

    python3 scripts/make_textures.py

For each entry below: crop a frontal patch of wall from the original DSC_*.JPG,
measure the brick course spacing (autocorrelation) to know how many pixels make a
metre, flatten the gallery lighting (divide by a heavy blur), make it tile with
minimum-error seams (the cut follows mortar joints), grade it to the wall's colour
and write public/tex/<name>.webp (albedo) + <name>-bump.webp (high-passed luminance).
The metre size of every texture goes to src/data/textures.json for the materials.

Needs Pillow + numpy (no other dependencies).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'tex')
COURSE = 0.077  # m: one brick course (old Austro-Hungarian brick, 65 mm + mortar)
PX_PER_M = 400  # output resolution

# name: photo, crop box (normalised, after EXIF rotation), target albedo (sRGB),
# metres to keep (width, height) -> rounded to whole courses vertically; course_px pins
# the measured course spacing when the strip is too short to detect it reliably
SOURCES = {
    'brick-warm': dict(photo='DSC_0061', box=(0.17, 0.27, 0.66, 0.875), size=(1.6, 1.85)),
    'brick-grey': dict(photo='DSC_0087', box=(0.12, 0.66, 0.95, 0.94), size=(1.6, 1.0), course_px=193),
    'brick-white': dict(photo='DSC_0074', box=(0.0, 0.50, 1.0, 0.97), size=(1.6, 1.85)),
}


def load(photo, box):
    im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, f'{photo}.JPG'))).convert('RGB')
    w, h = im.size
    return im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))


def course_period(crop):
    """Vertical period of the mortar lines in pixels: strongest frequency of the
    high-passed row profile, searched between 50 and 400 px (photo distances 1-6 m)."""
    small = crop.resize((crop.width // 2, crop.height // 2))
    g = small.convert('L')
    hp = np.asarray(g, dtype=np.float32) - np.asarray(g.filter(ImageFilter.GaussianBlur(20)), dtype=np.float32)
    prof = hp.mean(axis=1)
    prof -= prof.mean()
    f = np.abs(np.fft.rfft(prof * np.hanning(len(prof))))
    fr = np.fft.rfftfreq(len(prof))
    band = (fr > 1 / 200) & (fr < 1 / 25)
    return 2 / fr[np.argmax(f * band)]


def blur(a, radius):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255


def flatten(rgb, radius):
    """Divide out the lighting per channel (removes pools of light and colour casts)."""
    out = np.empty_like(rgb)
    for c in range(3):
        low = blur(rgb[..., c], radius) + 1e-3
        out[..., c] = rgb[..., c] / low * low.mean()
    return np.clip(out, 0, 1)


def min_seam(err):
    """Minimum-cost top-to-bottom path through err (h x w); returns column per row."""
    h, w = err.shape
    cost = err.copy()
    for y in range(1, h):
        left = np.r_[np.inf, cost[y - 1, :-1]]
        right = np.r_[cost[y - 1, 1:], np.inf]
        cost[y] += np.minimum(np.minimum(left, cost[y - 1]), right)
    path = np.zeros(h, dtype=int)
    path[-1] = int(np.argmin(cost[-1]))
    for y in range(h - 2, -1, -1):
        x = path[y + 1]
        lo, hi = max(0, x - 1), min(w, x + 2)
        path[y] = lo + int(np.argmin(cost[y, lo:hi]))
    return path


def tile_x(img, W, ov):
    """img has width W + ov; returns width-W image that wraps horizontally."""
    a = img[:, W:W + ov]  # continues past the right edge
    b = img[:, :ov]  # the left edge it must meet
    err = ((a - b) ** 2).sum(axis=2)
    seam = min_seam(err)
    out = img[:, :W].copy()
    for y, s in enumerate(seam):
        out[y, :s] = a[y, :s]  # left of the seam: use the overflow so it matches the right edge
    return out


def tile_y(img, H, ov):
    return tile_x(img.transpose(1, 0, 2), H, ov).transpose(1, 0, 2)


def main(only):
    os.makedirs(OUT, exist_ok=True)
    meta_path = os.path.join(ROOT, 'src', 'data', 'textures.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    for name, spec in SOURCES.items():
        if only and name not in only:
            continue
        crop = load(spec['photo'], spec['box'])
        period = spec.get('course_px') or course_period(crop)
        px_per_m = period / COURSE
        scale = PX_PER_M / px_per_m
        crop = crop.resize((max(8, round(crop.width * scale)), max(8, round(crop.height * scale))), Image.LANCZOS)
        rgb = np.asarray(crop, dtype=np.float32) / 255
        rgb = flatten(rgb, PX_PER_M * 0.18)
        # whole courses vertically so the texture repeats on a mortar line
        courses = max(4, round(spec['size'][1] / COURSE))
        H = int(round(courses * COURSE * PX_PER_M))
        W = int(round(spec['size'][0] * PX_PER_M))
        ov = int(PX_PER_M * 0.12)
        W = min(W, rgb.shape[1] - ov)
        H = min(H, rgb.shape[0] - ov)
        rgb = rgb[: H + ov, : W + ov]
        rgb = tile_x(rgb, W, ov)
        rgb = tile_y(rgb, H, ov)
        # bump: local luminance detail (mortar dark -> low)
        lum = rgb.mean(axis=2)
        hp = lum - blur(lum, 6)
        bump = np.clip(0.5 + hp * 3.0, 0, 1)
        # neutral albedo: remove the colour cast of the gallery lights, keep relative tone
        mean = rgb.reshape(-1, 3).mean(axis=0)
        rgb = rgb / mean * mean.mean()
        # mostly neutral: the material colour in three.js sets the hue of each room
        lum3 = rgb.mean(axis=2, keepdims=True)
        rgb = lum3 + (rgb - lum3) * 0.35
        rgb = np.clip(rgb / max(1e-3, np.percentile(rgb.mean(axis=2), 70)) * 0.82, 0, 1)
        Image.fromarray((rgb * 255).astype(np.uint8)).save(os.path.join(OUT, f'{name}.webp'), quality=82)
        Image.fromarray((bump * 255).astype(np.uint8)).save(os.path.join(OUT, f'{name}-bump.webp'), quality=80)
        meta[name] = {'w': round(W / PX_PER_M, 3), 'h': round(H / PX_PER_M, 3), 'photo': spec['photo']}
        print(f'{name:14s} {spec["photo"]}  course {period:.1f}px  -> {W}x{H}px = {W / PX_PER_M:.2f} x {H / PX_PER_M:.2f} m')
    json.dump(meta, open(meta_path, 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
