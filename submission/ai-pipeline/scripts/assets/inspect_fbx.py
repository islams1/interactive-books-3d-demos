import bpy, sys
args = sys.argv[sys.argv.index('--')+1:]
for f in args:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=f)
    print('=====', f.split('/')[-1])
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            me = o.data; tris = sum(len(p.vertices)-2 for p in me.polygons)
            mats = [m.name for m in me.materials if m]
            dims = tuple(round(d,3) for d in o.dimensions)
            print(f'MESH {o.name} verts={len(me.vertices)} tris={tris} mats={mats} dims={dims} shapekeys={len(me.shape_keys.key_blocks) if me.shape_keys else 0}')
        elif o.type == 'ARMATURE':
            b = o.data.bones
            print(f'ARM {o.name} bones={len(b)} scale={tuple(round(s,3) for s in o.scale)}')
            print('  ', ' '.join(x.name for x in b))
