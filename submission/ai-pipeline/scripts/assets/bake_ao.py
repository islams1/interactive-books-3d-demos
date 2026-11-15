# blender -b --factory-startup --python bake_ao.py -- <who.glb> <out_ao.png> [size] [samples] [distance m]
# Bakes the person's own ambient occlusion (rest pose) into their UV layout with Cycles.
import bpy, sys, time
a = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT = a[:2]; SIZE = int(a[2]) if len(a) > 2 else 2048; SAMPLES = int(a[3]) if len(a) > 3 else 96; DIST = float(a[4]) if len(a) > 4 else .12
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
if not sc.world: sc.world = bpy.data.worlds.new('W')
sc.world.light_settings.distance = DIST              # how far a crease looks for things that block the light
img = bpy.data.images.new('ao', SIZE, SIZE, alpha=False, float_buffer=False); img.generated_color = (1, 1, 1, 1)
if not any(mesh.data.materials): mesh.data.materials.clear(); mesh.data.materials.append(bpy.data.materials.new('bake'))
for mat in mesh.data.materials:
    mat.use_nodes = True
    n = mat.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img
    for x in mat.node_tree.nodes: x.select = False
    n.select = True; mat.node_tree.nodes.active = n
for o in sc.objects: o.select_set(False)
mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
t = time.time()
bpy.ops.object.bake(type='AO', margin=16, use_clear=True)
img.filepath_raw = OUT; img.file_format = 'PNG'; img.save()
print('BAKED', OUT, SIZE, SAMPLES, DIST, f'{time.time() - t:.0f}s')
