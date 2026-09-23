import bpy
s=bpy.context.scene;o=bpy.data.objects['output_unwrapped']
for m in o.data.materials:
 m.diffuse_color=(*m.diffuse_color[:3],.5)
 m.surface_render_method='DITHERED'
 for n in m.node_tree.nodes:
  if n.type=='BSDF_PRINCIPLED':
   n.inputs['Alpha'].default_value=.5
 print(m.name,'alpha',.5,'surface',m.surface_render_method)
bpy.ops.wm.save_as_mainfile(filepath='/Users/hoyouncho/rfsinopale/animation/jellyfish_slow_swim.blend')
