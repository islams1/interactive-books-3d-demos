# python -I flatten_skin_normals.py <dir> <who>
# Renderpeople normal maps don't match three.js tangents across UV seams (a line down the face, around the neck). Skin needs
# no normal detail (the photo carries it): where the colour map is skin, the normal map is made flat; cloth keeps its folds.
import sys, os, numpy as np
from PIL import Image, ImageFilter
d, who = sys.argv[1], sys.argv[2]
cp, npth = os.path.join(d, who + '_color.jpg'), os.path.join(d, who + '_normal.jpg')
orig = os.path.join(d, who + '_normal_orig.jpg')
if not os.path.exists(orig): Image.open(npth).save(orig, quality=95)
col = Image.open(cp).convert('RGB'); nor = Image.open(orig).convert('RGB').resize(col.size)
hsv = np.asarray(col.convert('HSV')).astype(np.float32) / 255
h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
rgb = np.asarray(col).astype(np.float32)
skin = (((h <= 45) | (h >= 340)) & (s >= .15) & (s <= .8) & (v >= .22) & (rgb[..., 0] > rgb[..., 2] + 12))
m = Image.fromarray((skin * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(6))
k = (np.asarray(m).astype(np.float32) / 255)[..., None]
n = np.asarray(nor).astype(np.float32)
flat = np.array([128, 128, 255], np.float32)
out = n * (1 - k) + flat * k
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(npth, quality=88, optimize=True)
Image.fromarray((skin * 255).astype(np.uint8)).resize((512, 512)).save(os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), f'skinmask_{who}.png'))
print(who, 'skin share %.1f%%' % (skin.mean() * 100))
