import bpy,json
op=bpy.ops.export_scene.gltf.get_rna_type()
print(json.dumps({p.identifier: {'type':p.type,'default':str(getattr(p,'default',''))} for p in op.properties if any(s in p.identifier for s in ['anim','frame','morph','select','material','image','texture'])},indent=2))
print('FILE',bpy.data.filepath)
print('IMAGES',[(i.name,i.size[:],i.filepath,bool(i.packed_file)) for i in bpy.data.images])
