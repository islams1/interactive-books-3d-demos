# Run: blender -b --factory-startup --python blender_fit.py -- <fbx> <splat_in> <splat_out> <json_out> <png_out>
import bpy, sys, json, math
import numpy as np
from mathutils import Vector, Matrix

FBX, SIN, SOUT, JOUT, PNG = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX, ignore_leaf_bones=False, automatic_bone_orientation=False)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
me = obj.data
mw = obj.matrix_world
head_b = arm.data.bones['Bip01 Head']
HW = arm.matrix_world @ head_b.matrix_local                 # head bone, bind pose, world
head_pos = HW.translation.copy()

# ---- 1. which vertices belong to the head (by material + head-bone weight) ----
slot = [s.material.name if s.material else '' for s in obj.material_slots]
gi = {g.name: g.index for g in obj.vertex_groups}
def w(v, name):
    for g in v.groups:
        if g.group == gi.get(name, -1): return g.weight
    return 0.0
head_mat = {i for i, n in enumerate(slot) if n.lower().endswith('head')}
helmet_mat = {i for i, n in enumerate(slot) if n.lower().endswith('helmet')}
V = np.array([(mw @ v.co)[:] for v in me.vertices])
Wh = np.array([w(v, 'Bip01 Head') for v in me.vertices]); Wn = np.array([w(v, 'Bip01 Neck') for v in me.vertices])
hv = set()
for p in me.polygons:
    if p.material_index in head_mat: hv.update(p.vertices)
hv = np.array(sorted(hv))

# ---- 2. facing frame of the character (bind pose) ----
up = Vector((0, 0, 1))
P = V[hv]
cen = P.mean(0)
nose_i = None
# forward = horizontal direction from head centre to the most protruding head point
d = P[:, :2] - cen[:2]; fwd2 = d[np.argmax(np.linalg.norm(d, axis=1) * (P[:, 2] > cen[2] - .02))]
fwd = Vector((fwd2[0], fwd2[1], 0)).normalized(); right = fwd.cross(up).normalized() * -1
right = up.cross(fwd).normalized() * -1 if False else fwd.cross(up).normalized()
def to_local(pts):            # world -> character frame relative to head bone: x right, y up, z forward
    q = pts - np.array(head_pos[:])
    return np.stack([q @ np.array(right[:]), q @ np.array(up[:]), q @ np.array(fwd[:])], 1)
L = to_local(P)
mid = np.abs(L[:, 0]) < 0.012
nose = L[mid][np.argmax(L[mid][:, 2])]
front = L[mid & (L[:, 2] > nose[2] - .025) & (L[:, 1] < nose[1])]        # chin still sits near the face front; the neck is set further back
chin = front[np.argmin(front[:, 1])]                # bottom of the chin = lowest point of the front face profile
crown = L[np.argmax(L[:, 1])]
model = {'nose': nose.tolist(), 'chin': chin.tolist(), 'crown': crown.tolist(), 'width': float(np.ptp(L[:, 0]))}

# hide rule: head-material triangles mostly driven by the head bone (keeps the neck)
keep_neck = Wh[hv] < .5
neck_top = float(L[keep_neck][:, 1].max()) if keep_neck.any() else None

# ---- 3. scan landmarks ----
d = np.fromfile(SIN, dtype=[('p', '<f4', 3), ('c', '<f4', 6), ('rgba', 'u1', 4)])
p = d['p'].astype(np.float64); col = d['rgba'][:, :3] / 255.0; a = d['rgba'][:, 3] / 255.0
skin = (a > .3) & (col[:, 0] > .45) & (col[:, 0] > col[:, 2] + .12) & (col[:, 1] > .25)
sm = skin & (np.abs(p[:, 0]) < .06)
s_nose = p[sm][np.argmax(p[sm][:, 2])]
sb = p[sm & (p[:, 2] > s_nose[2] - .12) & (p[:, 1] < s_nose[1])]
s_chin = sb[np.argmin(sb[:, 1])]
scale = float((nose[1] - chin[1]) / (s_nose[1] - s_chin[1]))
# pivot: the scan point that lands on the head bone so chin + nose line up with the model
pivot = np.array([0.0, s_chin[1] - chin[1] / scale, s_nose[2] - nose[2] / scale])

# ---- 4. edit the scan: soft neck edge + hair falling to the shoulders at the back ----
y = p[:, 1]; cut = y.min()
edge = np.clip((y - cut) / .12, 0, 1)                         # fade the last 12% above the cut
front = p[:, 2] > -0.05
a2 = np.where(front, a * edge, a)
hair = (~skin) & (col.mean(1) < .3) & (a > .25)
back = hair & (p[:, 2] < .0) & (y < cut + .22)
extra = []
for k, dy in enumerate([.1, .2, .3, .4]):
    e = d[back].copy()
    e['p'][:, 1] -= dy; e['p'][:, 2] -= .03 * (k + 1); e['p'][:, 0] *= 1 + .05 * (k + 1)
    e['rgba'][:, 3] = (a[back] * (.85 - .18 * k) * 255).clip(0, 255).astype(np.uint8)
    extra.append(e)
d['rgba'][:, 3] = (a2 * 255).clip(0, 255).astype(np.uint8)
out = np.concatenate([d] + extra)
out = out[out['rgba'][:, 3] > 8]
out.tofile(SOUT)

json.dump({'scale': scale, 'pivot': pivot.tolist(), 'model': model, 'scan': {'nose': s_nose.tolist(), 'chin': s_chin.tolist()},
           'neckTop': neck_top, 'headWeightCut': .5, 'splats': int(len(out)), 'added': int(sum(len(e) for e in extra))}, open(JOUT, 'w'), indent=1)

# ---- 5. preview render: cut model + fitted scan as points ----
for i, n in enumerate(slot):
    pass
hvs = set(hv.tolist())
bm_hide = [i for i in range(len(me.vertices)) if i in hvs and Wn[i] < .5]      # keep only what the neck bone drives
import bmesh
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
hide = set(bm_hide)
for f in bm.faces:
    if f.material_index in helmet_mat or (f.material_index in head_mat and sum(v.index in hide for v in f.verts) >= 2): f.hide_set(True)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.hide], context='FACES')
bm.to_mesh(me); bm.free()
pts = out['p'].astype(np.float64)
R = np.array([right[:], up[:], fwd[:]])                       # local -> world rows
wp = (((pts - pivot) * scale) @ R) + np.array(head_pos[:])
pc = bpy.data.meshes.new('scan'); pc.from_pydata(wp[::3].tolist(), [], []); po = bpy.data.objects.new('scan', pc); bpy.context.scene.collection.objects.link(po)
mat = bpy.data.materials.new('pt'); mat.use_nodes = True; po.data.materials.append(mat)
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); bpy.context.scene.collection.objects.link(co)
tgt = Vector(head_pos) + Vector((0, 0, -0.12))
co.location = tgt + fwd * .9 + right * .45 + Vector((0, 0, .05)); co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
cam.lens = 60; bpy.context.scene.camera = co
L1 = bpy.data.lights.new('l', 'SUN'); lo = bpy.data.objects.new('l', L1); lo.rotation_euler = (.8, .2, .6); bpy.context.scene.collection.objects.link(lo)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 640; sc.render.resolution_y = 640; sc.render.filepath = PNG
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
po.modifiers.new('w', 'WIREFRAME') if False else None
bpy.ops.render.render(write_still=True)
print('FITDONE', json.dumps({'scale': scale, 'pivot': pivot.tolist(), 'neckTop': neck_top}))
