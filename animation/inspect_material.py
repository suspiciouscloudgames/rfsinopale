import bpy,json
print('FILE',bpy.data.filepath)
o=bpy.data.objects.get('output_unwrapped')
for m in o.data.materials:
 print('MATERIAL',m.name,'diffuse',list(m.diffuse_color))
 print('PROPS',[(p.identifier,str(getattr(m,p.identifier))) for p in m.bl_rna.properties if p.identifier in ['surface_render_method','use_transparency_overlap','blend_method']])
 if m.use_nodes:
  for n in m.node_tree.nodes:
   if n.type in ['BSDF_PRINCIPLED','OUTPUT_MATERIAL']:
    print('NODE',n.name,n.type,[(i.name,str(i.default_value) if hasattr(i,'default_value') else '',i.is_linked) for i in n.inputs if i.name in ['Alpha','Surface']])
