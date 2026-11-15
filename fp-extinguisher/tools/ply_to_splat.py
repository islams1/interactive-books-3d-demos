# Step 2 - convert the raw scan (3DGS .ply) to the site's format, UNEDITED: every splat, full colour (SH degree 3).
# Usage:  python -I tools/ply_to_splat.py <scan.ply> <R.npy from scan_orient.py> <out_prefix>
#   e.g.  python -I tools/ply_to_splat.py C:/book/gaussians_362.ply assets/splat/scan_R.npy assets/splat/scan
# Writes <out>.splat  (40 bytes per splat: position 3 x f32, covariance 6 x f32, rgba 4 x u8)
#        <out>.sh     (45 x float16 per splat: f_rest_0..44 = view-dependent colour, R 15 / G 15 / B 15)
#        <out>.json   ({R, count, source}: R is needed later to evaluate the SH colour in the scan's own frame)
import sys, re, json
import numpy as np

PLY, RFILE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
b = open(PLY, 'rb').read(); h = b.index(b'end_header\n') + 11; hdr = b[:h].decode()
props = re.findall(r'property (\w+) (\w+)', hdr); n = int(re.search(r'element vertex (\d+)', hdr).group(1))
v = np.frombuffer(b, np.dtype([(nm, {'float': '<f4', 'uchar': 'u1'}[t]) for t, nm in props]), count=n, offset=h)
M = np.load(RFILE); R = M[:3]; cen = M[3]
a = 1 / (1 + np.exp(-v['opacity'].astype(np.float64)))
L = (np.stack([v['x'], v['y'], v['z']], 1).astype(np.float64) - cen) @ R.T             # only turned upright; nothing cut, nothing added
C = np.clip(.5 + .28209479177387814 * np.stack([v['f_dc_0'], v['f_dc_1'], v['f_dc_2']], 1), 0, 1)
SH = np.stack([v['f_rest_%d' % i] for i in range(45)], 1)
sc = np.exp(np.stack([v['scale_0'], v['scale_1'], v['scale_2']], 1).astype(np.float64))
q = np.stack([v['rot_0'], v['rot_1'], v['rot_2'], v['rot_3']], 1).astype(np.float64); q /= np.linalg.norm(q, axis=1, keepdims=True); w, x, y, z = q.T
Rq = np.stack([1-2*(y*y+z*z), 2*(x*y-w*z), 2*(x*z+w*y), 2*(x*y+w*z), 1-2*(x*x+z*z), 2*(y*z-w*x), 2*(x*z-w*y), 2*(y*z+w*x), 1-2*(x*x+y*y)], 1).reshape(-1, 3, 3)
Mx = Rq * sc[:, None, :]; Sig = R @ (Mx @ Mx.transpose(0, 2, 1)) @ R.T
rec = np.zeros(n, dtype=[('p', '<f4', 3), ('c', '<f4', 6), ('rgba', 'u1', 4)])
rec['p'] = L; rec['c'] = np.stack([Sig[:, 0, 0], Sig[:, 0, 1], Sig[:, 0, 2], Sig[:, 1, 1], Sig[:, 1, 2], Sig[:, 2, 2]], 1)
rec['rgba'] = np.concatenate([C * 255, a[:, None] * 255], 1).round().clip(0, 255).astype(np.uint8)
rec.tofile(OUT + '.splat'); SH.astype(np.float16).tofile(OUT + '.sh')
json.dump({'R': R.tolist(), 'count': n, 'source': PLY + ' (unedited)'}, open(OUT + '.json', 'w'))
print('splats', n, '->', OUT + '.splat / .sh / .json')
