# blender -b --factory-startup --python rp_to_web.py -- <rigged.fbx> <tex dir> <out dir> <name> [size]
import bpy, sys, os, numpy as np
a = sys.argv[sys.argv.index('--')+1:]
FBX, TEX, OUT, NAME = a[:4]; SIZE = int(a[4]) if len(a) > 4 else 2048
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
# animated packs: bones carry the file name as a prefix and the action poses the body -> plain names, rest pose
pre = os.path.commonprefix([b.name for b in arm.data.bones])
pre = pre[:pre.rfind('_') + 1] if pre and not pre.endswith('_') else pre
if pre and pre != 'r':
    for b in arm.data.bones: b.name = b.name[len(pre):]
    print('PREFIX', pre)
for o in (arm, mesh):
    if o.animation_data: o.animation_data_clear()
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
bpy.context.view_layer.update()
# drop the imported material (textures are loaded by the page)
mesh.data.materials.clear()
mat = bpy.data.materials.new(NAME); mesh.data.materials.append(mat)
for o in bpy.context.scene.objects: o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)   # centimetres -> metres in the data
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, NAME + '.glb'), export_format='GLB', export_animations=False,
                          export_materials='PLACEHOLDER', export_yup=True, export_skins=True, export_morph=False, export_tangents=True, export_normals=True)
def tex(kind, out, invert=False):
    src = next(os.path.join(TEX, f) for f in os.listdir(TEX) if f.endswith('_' + kind + '.jpg'))
    im = bpy.data.images.load(src); im.scale(SIZE, SIZE)
    if invert:
        px = np.empty(SIZE * SIZE * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(-1, 4)
        px[:, :3] = .5 + .5 * (1 - px[:, :3])   # gloss -> roughness 0.5..1 (the raw scan gloss reads as wet skin); im.pixels.foreach_set(px.ravel())
    im.filepath_raw = os.path.join(OUT, f'{NAME}_{out}.jpg'); im.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 88
    im.save_render(im.filepath_raw)
    print('TEX', out, src)
tex('dif', 'color'); tex('norm', 'normal'); tex('gloss', 'rough', invert=True)
me = mesh.data; print('DONE', NAME, 'tris', sum(len(p.vertices)-2 for p in me.polygons), 'height', round(mesh.dimensions[1] if mesh.dimensions[1] > mesh.dimensions[2] else mesh.dimensions[2], 3))
