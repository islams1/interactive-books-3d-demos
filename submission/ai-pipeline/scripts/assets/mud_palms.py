# python -I mud_palms.py <who.glb> <who_color.jpg> <out_color_mud.jpg> [mask.png]
# Paints wet potting-mix mud on the PALMS of a Renderpeople character's colour map. The palm area comes from the GLB itself:
# skin weighted to the hand bone (fingers a little), whose normal faces the palm side (from the bind-pose bone positions).
import sys, json, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
glb, col_in, col_out = sys.argv[1:4]; mask_out = sys.argv[4] if len(sys.argv) > 4 else None
data = open(glb, 'rb').read()
jl = struct.unpack_from('<I', data, 12)[0]; J = json.loads(data[20:20 + jl]); bo = 20 + jl; bl = struct.unpack_from('<I', data, bo)[0]; BIN = data[bo + 8: bo + 8 + bl]
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8, 5122: np.int16, 5120: np.int8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def acc(i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', dt.itemsize * n)
    raw = np.frombuffer(BIN, dtype=np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * n, offset=off)
    out = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], dt.itemsize * n), strides=(stride, 1)).copy().view(dt).reshape(a['count'], n)
    if a.get('normalized'): out = out.astype(np.float32) / np.iinfo(dt).max
    return out
skin = J['skins'][0]; names = [J['nodes'][j].get('name', '') for j in skin['joints']]
ibm = acc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)              # column-major -> row-major
jpos = np.array([np.linalg.inv(m)[:3, 3] for m in ibm])
ji = {n: i for i, n in enumerate(names)}
mesh_i = next(n['mesh'] for n in J['nodes'] if 'mesh' in n and 'skin' in n)
img = Image.open(col_in).convert('RGB'); W, H = img.size
mask = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(mask)
for prim in J['meshes'][mesh_i]['primitives']:
    A = prim['attributes']; P = acc(A['POSITION']); N = acc(A['NORMAL']); UV = acc(A['TEXCOORD_0']); JO = acc(A['JOINTS_0']).astype(int); WE = acc(A['WEIGHTS_0'])
    IDX = acc(prim['indices']).reshape(-1)
    m = np.zeros(len(P), np.float32)
    for s in ('l', 'r'):
        h = ji[f'hand_{s}']; fing = [ji[n] for n in names if n.split('_')[0] in ('thumb', 'index', 'middle', 'ring', 'pinky') and n.endswith('_' + s)]
        f = jpos[ji[f'middle_01_{s}']] - jpos[h]; t = jpos[ji[f'index_01_{s}']] - jpos[ji[f'pinky_01_{s}']]
        pn = np.cross(t, f) if s == 'r' else np.cross(f, t); pn /= np.linalg.norm(pn)   # checked in the game: this side is the palm
        wh = (WE * (JO == h)).sum(1); wf = sum((WE * (JO == k)).sum(1) for k in fing)
        palm = np.clip(((N @ pn) - .05) / .45, 0, 1)                                       # faces the palm side
        m = np.maximum(m, palm * np.clip((wh + .35 * wf - .35) / .4, 0, 1))
    for a, b, c in IDX.reshape(-1, 3):
        v = (m[a] + m[b] + m[c]) / 3
        if v < .04: continue
        dr.polygon([(UV[a][0] * W, UV[a][1] * H), (UV[b][0] * W, UV[b][1] * H), (UV[c][0] * W, UV[c][1] * H)], fill=int(v * 255))
mask = mask.filter(ImageFilter.GaussianBlur(W / 600))
if mask_out: mask.save(mask_out)
# the mud: dark brown with lighter dried edges and grit, uneven cover
rng = np.random.default_rng(7)
noise = Image.fromarray((rng.random((H // 8, W // 8)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(W / 900))
grit = Image.fromarray((rng.random((H, W)) * 255).astype(np.uint8))
nz = np.asarray(noise, np.float32) / 255; gr = np.asarray(grit, np.float32) / 255; mk = np.asarray(mask, np.float32) / 255
mud = np.stack([78 + 40 * nz, 55 + 30 * nz, 36 + 18 * nz], -1) * (0.85 + 0.3 * (gr > .93))[..., None]
alpha = np.clip(mk * (0.55 + 0.6 * nz), 0, .95)[..., None]
base = np.asarray(img, np.float32)
out = base * (1 - alpha) + mud * alpha
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(col_out, quality=90)
print('ok', W, H, 'mud pixels', int((mk > .2).sum()))
