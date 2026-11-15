# Step 4 - numbers for fitting a scanned head onto a full-body splat (run before build_fullbody2.py).
# Usage:  python -I tools/measure_fit.py <straightened_scan.splat (from straight_check.py)> <body.ply (full-body 3DGS)>
# Prints: scan chin / neck width, body chin / neck width / shoulder line, and the SCALE that makes the two necks equal.
# For gaussians_362 on the LHM woman: scan neck 0.46 units, her neck 9 cm -> SCALE 0.196 (build_fullbody2.py default).
import sys, re
import numpy as np

dt = [('p', '<f4', 3), ('c', '<f4', 6), ('rgba', 'u1', 4)]
sp = np.fromfile(sys.argv[1], dtype=dt); L = sp['p'].astype(np.float64); Ls = sp['rgba'][:, :3] / 255.; La = sp['rgba'][:, 3] / 255.
skin = (La > .3) & (Ls[:, 0] > .45) & (Ls[:, 0] > Ls[:, 2] + .12) & (Ls[:, 1] > .25)
fm = skin & (L[:, 1] > -.1) & (L[:, 1] < .35) & (np.abs(L[:, 0]) < .3); nose = L[fm][np.argmax(L[fm][:, 2])]
warm = (La > .25) & (Ls[:, 0] > .22) & (Ls[:, 0] > Ls[:, 2] + .06) & (Ls[:, 0] >= Ls[:, 1])
prof = warm & (np.abs(L[:, 0] - nose[0]) < .08) & (L[:, 2] > nose[2] - .22); chin = np.percentile(L[prof][:, 1], 1)
nk = warm & (L[:, 1] < chin - .1) & (L[:, 1] > chin - .3) & (L[:, 2] < nose[2] - .3) & (L[:, 2] > -.35) & (np.abs(L[:, 0] - .03) < .35)
ws = [np.ptp(np.percentile(L[nk & (np.abs(L[:, 1] - y) < .015)][:, 0], [3, 97])) for y in np.arange(chin - .29, chin - .1, .03) if (nk & (np.abs(L[:, 1] - y) < .015)).sum() > 20]
width_scan = float(np.median(ws))                                       # neck width = median over slices under the chin
print('SCAN  nose %s  chin y %.3f  neck width %.3f units (slices %s)' % (nose.round(3), chin, width_scan, np.round(ws, 3)))

b = open(sys.argv[2], 'rb').read(); h = b.index(b'end_header\n') + 11; hdr = b[:h].decode()
props = re.findall(r'property (\w+) (\w+)', hdr); n = int(re.search(r'element vertex (\d+)', hdr).group(1))
v = np.frombuffer(b, np.dtype([(nm, {'float': '<f4', 'uchar': 'u1'}[t]) for t, nm in props]), count=n, offset=h)
P = np.stack([v['x'], v['y'], v['z']], 1).astype(np.float64); a = 1 / (1 + np.exp(-v['opacity'].astype(np.float64)))
C = np.clip(.5 + .28209479177387814 * np.stack([v['f_dc_0'], v['f_dc_1'], v['f_dc_2']], 1), 0, 1)
sk = (a > .2) & (C[:, 0] > .45) & (C[:, 0] > C[:, 2] + .08) & (C[:, 1] > .25)
hm = (P[:, 1] > P[:, 1].max() - .25) & (np.abs(P[:, 0]) < .03); bnose = P[hm][np.argmax(P[hm][:, 2])]
fr = sk & (np.abs(P[:, 0]) < .02) & (P[:, 2] > bnose[2] - .04) & (P[:, 1] < bnose[1]); bchin = np.percentile(P[fr][:, 1], 1)
wb = [np.ptp(np.percentile(P[sk & (np.abs(P[:, 1] - y) < .005) & (np.abs(P[:, 0]) < .1)][:, 0], [3, 97])) for y in np.arange(bchin - .04, bchin - .009, .01)]
width_body = float(min(wb))                                            # her neck at its narrowest, just under the jaw
print('BODY  height %.2f m  nose %s  chin y %.3f  neck width %.3f m (slices %s)' % (np.ptp(P[:, 1]), bnose.round(3), bchin, width_body, np.round(wb, 3)))
for ax in (.08, .12, .16, .2):
    m = (~sk | True) & (np.abs(np.abs(P[:, 0]) - ax) < .01) & (a > .3) & (P[:, 1] < bchin - .03) & (P[:, 1] > bchin - .35)
    if m.sum(): print('      shoulder top at |x|=%.2f : y %.3f' % (ax, np.percentile(P[m][:, 1], 99)))
print('SCALE (neck widths equal) = %.3f   (life size would be ~0.22 for an adult scan in these units)' % (width_body / width_scan))
print('skin colour  scan %s   body %s' % (Ls[skin].mean(0).round(3), C[sk & (P[:, 1] < bchin)].mean(0).round(3)))
