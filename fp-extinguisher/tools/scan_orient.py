# Step 1 - stand a raw Gaussian-splat head scan upright.
# Usage:  python -I tools/scan_orient.py <scan.ply> <out_dir>
# Writes R0.npy .. R7.npy (4x3: rows 0-2 = rotation, row 3 = centre) and orient_all.png (8 previews side by side).
# Look at orient_all.png, pick the preview where the head stands upright facing you, and use that R<k>.npy
# with ply_to_splat.py.  (For gaussians_362.ply it was R6 -> saved as assets/splat/scan_R.npy.)
import sys, re, os
import numpy as np
from PIL import Image

PLY, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
b = open(PLY, 'rb').read(); h = b.index(b'end_header\n') + 11; hdr = b[:h].decode()
props = re.findall(r'property (\w+) (\w+)', hdr); n = int(re.search(r'element vertex (\d+)', hdr).group(1))
v = np.frombuffer(b, np.dtype([(nm, {'float': '<f4', 'uchar': 'u1'}[t]) for t, nm in props]), count=n, offset=h)
P = np.stack([v['x'], v['y'], v['z']], 1).astype(np.float64); a = 1 / (1 + np.exp(-v['opacity'].astype(np.float64)))
C = np.clip(.5 + .28209 * np.stack([v['f_dc_0'], v['f_dc_1'], v['f_dc_2']], 1), 0, 1)
skin = (a > .3) & (C[:, 0] > .45) & (C[:, 0] > C[:, 2] + .12) & (C[:, 1] > .25)
cen = np.average(P[a > .3], 0, weights=a[a > .3]); fwd = P[skin].mean(0) - cen; fwd /= np.linalg.norm(fwd)   # the face looks from the centre towards the skin
print('splats', n, 'skin', int(skin.sum()), 'centre', cen.round(3), 'face direction', fwd.round(3))
tmp = np.array([0, 0, 1.]) if abs(fwd[2]) < .9 else np.array([1., 0, 0])
e1 = np.cross(fwd, tmp); e1 /= np.linalg.norm(e1); e2 = np.cross(fwd, e1)
W = 300; imgs = []
for k in range(8):                                  # 8 candidate "up" directions around the face axis
    t = k / 8 * 2 * np.pi; up = np.cos(t) * e1 + np.sin(t) * e2; right = np.cross(up, fwd)
    R = np.stack([right, up, fwd]); Q = (P - cen) @ R.T; s = W / 2.2; u = Q[:, 0] * s + W / 2; w = W / 2 - Q[:, 1] * s
    img = np.zeros((W, W, 3)); T = np.ones((W, W))
    for i in np.argsort(-Q[:, 2]):
        if a[i] <= .05: continue
        x, y = int(u[i]), int(w[i])
        if 0 <= x < W and 0 <= y < W: g = a[i] * .9; img[y, x] += T[y, x] * g * C[i]; T[y, x] *= 1 - g
    img += T[..., None] * .55; imgs.append(Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)))
    np.save(os.path.join(OUT, f'R{k}.npy'), np.vstack([R, cen]))
g = Image.new('RGB', (W * 8, W)); [g.paste(im, (W * i, 0)) for i, im in enumerate(imgs)]; g.save(os.path.join(OUT, 'orient_all.png'))
print('wrote', os.path.join(OUT, 'orient_all.png'), '- previews 0..7 from left to right')
