# blender -b --factory-startup --python bake_face2.py -- <fbx> <front.png> <fit.json> <orig_head_color.jpg> <out_png> <out_json>
# Projects a straight-on render of the scanned face onto the model's head texture, aligned by eyes + mouth.
import bpy, sys, json
import numpy as np

FBX, FRONT, FIT, ORIG, OUT, OJ = sys.argv[sys.argv.index('--') + 1:][:6]
fit = json.load(open(FIT))
# landmarks picked on the front render (pixels, 1024 image, x right / y down) — eyes are pupil centres
SCAN_PX = {'eyeA': (405, 400), 'eyeB': (548, 390), 'mouth': (500, 557)}
HALF, IMG = 1.05, 1024
px2loc = lambda p: np.array([(p[0] / IMG * 2 - 1) * HALF, (1 - p[1] / IMG * 2) * HALF])
loc2px = lambda q: np.stack([(q[..., 0] / HALF + 1) / 2 * IMG, (1 - q[..., 1] / HALF) / 2 * IMG], -1)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX, ignore_leaf_bones=False, automatic_bone_orientation=False)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH'); me = obj.data
mw3 = np.array(obj.matrix_world.to_3x3()); mwt = np.array(obj.matrix_world.translation[:])
bw = lambda n: np.array((arm.matrix_world @ arm.data.bones[n].matrix_local).translation[:])
head_pos = bw('Bip01 Head')
hm = {i for i, s in enumerate(obj.material_slots) if s.material.name.lower().endswith('head')}
hv = sorted({v for p in me.polygons if p.material_index in hm for v in p.vertices})
CO = np.array([v.co[:] for v in me.vertices]); W = CO @ mw3.T + mwt
NO = np.array([v.normal[:] for v in me.vertices]) @ mw3.T; NO /= np.linalg.norm(NO, axis=1, keepdims=True)
P = W[hv]; cen = P.mean(0)
d = P[:, :2] - cen[:2]; f2 = d[np.argmax(np.linalg.norm(d, axis=1) * (P[:, 2] > cen[2] - .02))]
up = np.array([0, 0, 1.]); fwd = np.array([0, -1., 0])                 # FBX +Z facing = Blender -Y
right = np.cross(up, fwd)                                            # = three.js +X (the character's left, viewer's right)
R = np.stack([right, up, fwd])


# 2-D similarity: model landmarks (projected into scan space) -> scan landmarks
# model landmarks read off its own face texture (pixels, top-down) and lifted onto the mesh through the UVs
TEX_PX = {'eyeA': (429, 278), 'eyeB': (582, 278), 'mouth': (512, 417)}
me.calc_loop_triangles(); uvl = me.uv_layers.active.data
def texel_to_world(px, py, size=1024):
    q = np.array([px / size, 1 - py / size]); hits = []
    for t in me.loop_triangles:
        if t.material_index not in hm: continue
        U = np.array([uvl[l].uv[:] for l in t.loops]); T = np.array([U[1] - U[0], U[2] - U[0]]).T
        if abs(np.linalg.det(T)) < 1e-12: continue
        b = np.linalg.solve(T, q - U[0]); b0 = 1 - b.sum()
        if b.min() >= -1e-4 and b0 >= -1e-4: hits.append(np.array([b0, b[0], b[1]]) @ W[list(t.vertices)])
    if not hits: raise ValueError('texel not on head')
    return max(hits, key=lambda h: h @ fwd)                 # outermost front surface (the UV sheet overlaps inner mouth/eye parts)
WL = {k: texel_to_world(*v) for k, v in TEX_PX.items()}
# scan landmarks: x, y from the front render, depth = front-most splat at that spot
spl = np.fromfile(sys.argv[sys.argv.index('--') + 7], dtype=[('p', '<f4', 3), ('c', '<f4', 6), ('rgba', 'u1', 4)])
SP = spl['p'].astype(np.float64); SA = spl['rgba'][:, 3] / 255.
def scan_lm(px):
    xy = px2loc(px); m = (np.abs(SP[:, 0] - xy[0]) < .025) & (np.abs(SP[:, 1] - xy[1]) < .025) & (SA > .3)
    return np.array([xy[0], xy[1], np.percentile(SP[m, 2], 95)])
SL = {k: scan_lm(v) for k, v in SCAN_PX.items()}
O = {k: R @ (WL[k] - head_pos) for k in WL}                  # model landmark offsets from the head bone (character frame, m)
keys = ['eyeA', 'eyeB', 'mouth']
so = np.array([SL[k] for k in keys]); oo = np.array([O[k] for k in keys])
scale = float(np.sqrt(((oo[:, :2] - oo[:, :2].mean(0)) ** 2).sum() / ((so[:, :2] - so[:, :2].mean(0)) ** 2).sum()))
pivot = (so - oo / scale).mean(0)
fit = {'scale': scale, 'pivot': pivot.tolist()}
print('NEWFIT', round(scale, 4), pivot.round(4).tolist())
to_loc = lambda w: ((w - head_pos) @ R.T) / fit['scale'] + np.array(fit['pivot'])
LM = {k: to_loc(WL[k]) for k in WL}
eyes = sorted([LM['eyeA'][:2], LM['eyeB'][:2]], key=lambda q: q[0]); mouth = LM['mouth'][:2]
fwd_face = np.cross(WL['eyeB'] - WL['eyeA'], up); fwd_face /= np.linalg.norm(fwd_face)
if (WL['mouth'] - cen) @ fwd_face < 0: fwd_face = -fwd_face
print('FWD', fwd.round(3).tolist(), 'FACE', fwd_face.round(3).tolist())
print('LANDMARKS', {k: v.round(3).tolist() for k, v in LM.items()})
src = np.array([eyes[0], eyes[1], mouth]); dst = np.array([px2loc(SCAN_PX['eyeA']), px2loc(SCAN_PX['eyeB']), px2loc(SCAN_PX['mouth'])])
sc_, dc_ = src.mean(0), dst.mean(0); A, B = src - sc_, dst - dc_
M = np.linalg.lstsq(A, B, rcond=None)[0]                     # 2x2 (allows the scan's slight head turn)
sim = lambda q: (q - sc_) @ M + dc_

front = np.asarray(bpy.data.images.load(FRONT).pixels[:]).reshape(IMG, IMG, 4)[::-1, :, :3]   # row 0 = top
orig = bpy.data.images.load(ORIG); TW, TH = orig.size
img = np.array(orig.pixels[:]).reshape(TH, TW, 4)[:, :, :3].copy()
acc = np.zeros((TH, TW, 3)); wgt = np.zeros((TH, TW)); hairm = np.zeros((TH, TW))
eye_y = (LM['eyeA'][1] + LM['eyeB'][1]) / 2
me.calc_loop_triangles(); uv = me.uv_layers.active.data
for t in me.loop_triangles:
    if t.material_index not in hm: continue
    U = np.array([uv[l].uv[:] for l in t.loops]) * [TW, TH]; X = W[list(t.vertices)]; N = NO[list(t.vertices)]
    x0, y0 = np.floor(U.min(0)).astype(int); x1, y1 = np.ceil(U.max(0)).astype(int)
    xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1 + 1, TW)), np.arange(max(y0, 0), min(y1 + 1, TH)))
    pc = np.stack([xs.ravel() + .5, ys.ravel() + .5], 1)
    T = np.array([U[1] - U[0], U[2] - U[0]]).T
    if abs(np.linalg.det(T)) < 1e-9: continue
    bc = np.linalg.solve(T, (pc - U[0]).T).T; b0 = 1 - bc.sum(1)
    ok = (bc[:, 0] >= -.02) & (bc[:, 1] >= -.02) & (b0 >= -.02)
    if not ok.any(): continue
    bb = np.stack([b0[ok], bc[ok, 0], bc[ok, 1]], 1)
    p3 = bb @ X; n3 = bb @ N; n3 /= np.linalg.norm(n3, axis=1, keepdims=True)
    L = to_loc(p3); q = loc2px(sim(L[:, :2])).round().astype(int)
    xi, yi = pc[ok, 0].astype(int), pc[ok, 1].astype(int)
    inside = (q[:, 0] >= 0) & (q[:, 0] < IMG) & (q[:, 1] >= 0) & (q[:, 1] < IMG)
    c = np.zeros((len(q), 3)); c[inside] = front[q[inside, 1], q[inside, 0]]
    magenta = (c[:, 0] > .85) & (c[:, 2] > .85) & (c[:, 1] < .3)
    cx = (LM['eyeA'][0] + LM['eyeB'][0]) / 2
    oval = (((L[:, 0] - cx) / .27) ** 2 + ((L[:, 1] - (eye_y + LM['mouth'][1]) / 2) / .36) ** 2) < 1     # eyes, brows, nose, lips: take everything
    skin = (((c.mean(1) > .28) & (c[:, 0] > c[:, 2] + .05)) | oval) & ~magenta
    face = np.clip((n3 @ fwd_face - .15) / .45, 0, 1)                          # front-facing parts only
    w_ = face * skin * inside
    acc[yi, xi] = c; wgt[yi, xi] = np.maximum(wgt[yi, xi], w_)
    zr = L[:, 2] - LM['mouth'][2]
    hairm[yi, xi] = np.maximum(hairm[yi, xi], ((L[:, 1] > eye_y + .22) | ((zr < -.45) & (L[:, 1] > LM['mouth'][1] + .05)) | ((np.abs(L[:, 0] - (LM['eyeA'][0] + LM['eyeB'][0]) / 2) > .3) & (L[:, 1] > LM['mouth'][1]))).astype(float))

sk = wgt > .9
gain = acc[sk].mean(0) / np.maximum(img[sk].mean(0), 1e-3) if sk.sum() > 200 else np.ones(3)
base = np.clip(img * gain, 0, 1)                                        # rest of the head tone-matched to the scan skin
hair_col = np.array([.075, .055, .045])
base = base * (1 - hairm[..., None]) + (hair_col + (img - img.mean()) * .15) * hairm[..., None]   # scalp under the hair: dark brown, keeps strand detail
def blur(m, r=4):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    m = np.apply_along_axis(lambda x: np.convolve(x, k, 'same'), 0, m)
    return np.apply_along_axis(lambda x: np.convolve(x, k, 'same'), 1, m)
wb = blur(wgt)[..., None] * (wgt[..., None] > 0)
res = np.clip(base * (1 - wb) + acc * wb, 0, 1)
out = bpy.data.images.new('baked', TW, TH); px = np.ones((TH, TW, 4)); px[:, :, :3] = res
out.pixels = px.ravel().tolist(); out.filepath_raw = OUT; out.file_format = 'PNG'; out.save()
json.dump({'fit': fit, 'similarity': M.tolist(), 'src_c': sc_.tolist(), 'dst_c': dc_.tolist(), 'gain': gain.tolist(), 'face_texels': int(sk.sum())}, open(OJ, 'w'))
print('BAKE2', int(sk.sum()), gain.round(3).tolist())
