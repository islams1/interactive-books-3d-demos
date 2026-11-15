# Step 3b - how much is the head still turned / tilted?  (run on the straight_check.py output + its front render)
# 1) make a grid crop of the front render to read pixel positions:
#      python -I tools/eye_measure.py grid <front.png> <out_grid.png> [x0 y0 x1 y1]     (default crop 330,280 -> 690,500, 4x)
#    open the grid image and read: centre of each iris (left/right in the picture) and the nose tip.
# 2) measure:
#      python -I tools/eye_measure.py measure <straight_tmp.splat> eyeLx eyeLy eyeRx eyeRy noseX noseY
#    prints the remaining tilt (roll) and turn (yaw) and the FY / FR to add (radians). Re-run straight_check.py, re-check.
#    For gaussians_362: eyes (443.75,381.25) (598.75,363.75) -> roll 6.4/5.2 deg, yaw 7-8.7 deg (eyes) / 4.5 deg (nose)
#    -> we used FR = -0.101, FY = +0.113, and the next render had level eyes and the nose centred.
import sys
import numpy as np

HALF, IMG = 1.05, 1024                     # front.html: 1024 px = 2 x 1.05 scan units
px2 = lambda px, py: np.array([(px / IMG * 2 - 1) * HALF, (1 - py / IMG * 2) * HALF])

if sys.argv[1] == 'grid':
    from PIL import Image, ImageDraw
    src, out = sys.argv[2], sys.argv[3]
    x0, y0, x1, y1 = map(int, sys.argv[4:8]) if len(sys.argv) > 7 else (330, 280, 690, 500)
    im = Image.open(src).convert('RGB'); c = im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * 4, (y1 - y0) * 4), Image.LANCZOS); dr = ImageDraw.Draw(c)
    for x in range(x0, x1 + 1, 10):
        X = (x - x0) * 4; dr.line([(X, 0), (X, c.height)], fill=(0, 255, 0) if x % 50 == 0 else (0, 110, 0))
        if x % 50 == 0: dr.text((X + 2, 2), str(x), fill=(255, 255, 0))
    for y in range(y0, y1 + 1, 10):
        Y = (y - y0) * 4; dr.line([(0, Y), (c.width, Y)], fill=(0, 255, 0) if y % 50 == 0 else (0, 110, 0))
        if y % 50 == 0: dr.text((2, Y + 2), str(y), fill=(255, 255, 0))
    c.save(out); print('grid written', out, '(numbers = original pixel coordinates)')
    sys.exit()

dt = [('p', '<f4', 3), ('c', '<f4', 6), ('rgba', 'u1', 4)]
sp = np.fromfile(sys.argv[2], dtype=dt); P = sp['p'].astype(np.float64); A = sp['rgba'][:, 3] / 255.
eL, eR, nose = px2(*map(float, sys.argv[3:5])), px2(*map(float, sys.argv[5:7])), px2(*map(float, sys.argv[7:9]))


def depth(xy, r=.02):                       # front-most surface at that spot
    m = (np.abs(P[:, 0] - xy[0]) < r) & (np.abs(P[:, 1] - xy[1]) < r) & (A > .3); return np.percentile(P[m][:, 2], 95)


L3, R3, N3 = (np.r_[p, depth(p)] for p in (eL, eR, nose))
e = R3 - L3; roll = np.degrees(np.arctan2(e[1], e[0])); yaw_eyes = np.degrees(np.arctan2(-e[2], e[0]))
mid = (L3 + R3) / 2; d = N3[:2] - mid[:2]; r = -np.radians(roll)
dx = np.cos(r) * d[0] - np.sin(r) * d[1]                       # nose offset sideways, with the tilt taken out
yaw_nose = np.degrees(np.arcsin(np.clip(dx / max(N3[2] - mid[2], 1e-3), -1, 1)))
print('tilt (roll) %.1f deg | turn from eye depths %.1f deg | turn from nose offset %.1f deg' % (roll, yaw_eyes, yaw_nose))
print('suggested: FR = %.3f   FY = %.3f   (add to the current FR / FY, radians)' % (-np.radians(roll), -np.radians((yaw_eyes + yaw_nose) / 2)))
