# Step 3 - straighten the head (face forward, eyes level) and check it on a front render.
# The rotation is applied as a NECK TWIST: full above the jaw, fading to zero at the shoulders (the body stays put).
# Usage:  python -I tools/straight_check.py <scan.splat> <out_tmp.splat> HY HP [FY FR [PIVOT_Y PIVOT_Z RAMP_Y RAMP_LEN]]
#   HY = turn about the vertical axis, HP = nod (negative = chin up), FY/FR = fine turn / tilt measured with eye_measure.py
#   values for gaussians_362: HY=0.28 HP=-0.14 FY=0.113 FR=-0.101   (radians)
# Then render it:  tools\shoot.ps1 <png> "http://127.0.0.1:8767/fp-extinguisher/assets/splat/front.html?f=<out_tmp.splat file name>" 40000 1024 1024
# (front.html shows the splat front-on, 1024 px = 2.1 scan units, magenta background), and measure with eye_measure.py.
import sys
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
HY, HP = float(sys.argv[3]), float(sys.argv[4]); FY = float(sys.argv[5]) if len(sys.argv) > 5 else 0; FR = float(sys.argv[6]) if len(sys.argv) > 6 else 0
PIVOT, RAMP = np.array([0, -.45, -.1]), (-.55, .35)            # neck pivot + twist ramp (scan units) - same as build_fullbody2.py
if len(sys.argv) > 10:                                          # optional: <pivot_y> <pivot_z> <ramp_start_y> <ramp_length>  (other scans)
    PIVOT = np.array([0, float(sys.argv[7]), float(sys.argv[8])]); RAMP = (float(sys.argv[9]), float(sys.argv[10]))
dt = [('p', '<f4', 3), ('c', '<f4', 6), ('rgba', 'u1', 4)]
sp = np.fromfile(SRC, dtype=dt); L = sp['p'].astype(np.float64)


def rotmat(axis, ang):
    k = np.array(axis, float); k /= np.linalg.norm(k); K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K


def c33(c): return np.stack([c[:, 0], c[:, 1], c[:, 2], c[:, 1], c[:, 3], c[:, 4], c[:, 2], c[:, 4], c[:, 5]], 1).reshape(-1, 3, 3)
def c6(S): return np.stack([S[:, 0, 0], S[:, 0, 1], S[:, 0, 2], S[:, 1, 1], S[:, 1, 2], S[:, 2, 2]], 1)


wgt = np.clip((L[:, 1] - RAMP[0]) / RAMP[1], 0, 1); wgt = wgt * wgt * (3 - 2 * wgt)
Rf = rotmat([0, 1, 0], FY) @ rotmat([0, 0, 1], FR) @ rotmat([0, 1, 0], HY) @ rotmat([1, 0, 0], HP)
ang = np.arccos(np.clip((np.trace(Rf) - 1) / 2, -1, 1))
ax = np.array([Rf[2, 1] - Rf[1, 2], Rf[0, 2] - Rf[2, 0], Rf[1, 0] - Rf[0, 1]]); ax /= np.linalg.norm(ax) if np.linalg.norm(ax) > 0 else 1
Rw = np.stack([rotmat(ax, ang * w) for w in wgt]) if ang > 1e-9 else np.repeat(np.eye(3)[None], len(L), 0)   # no rotation asked: identity
L2 = PIVOT + np.einsum('nij,nj->ni', Rw, L - PIVOT)
out = sp.copy(); out['p'] = L2; out['c'] = c6(Rw @ c33(sp['c'].astype(np.float64)) @ Rw.transpose(0, 2, 1))
out.tofile(OUT); print('written', OUT, 'HY HP FY FR =', HY, HP, FY, FR)
