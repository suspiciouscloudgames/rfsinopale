import bpy, json
s=bpy.context.scene;o=bpy.data.objects['output_unwrapped']
def positions(f):
 s.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);me=ev.to_mesh();p=[ev.matrix_world@v.co for v in me.vertices];ev.to_mesh_clear();return p
p=positions(1);q=positions(481);r=positions(61)
print(json.dumps({'loop_seam_max':max((a-b).length for a,b in zip(p,q)),'contraction_max_displacement':max((a-b).length for a,b in zip(p,r)),'vertex_count':len(p)}))
engine=s.render.engine;rx=s.render.resolution_x;ry=s.render.resolution_y;pct=s.render.resolution_percentage
s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100
s.display.shading.light='STUDIO';s.display.shading.color_type='SINGLE';s.display.shading.single_color=(.63,.8,.84);s.display.shading.show_shadows=True;s.display.shading.show_cavity=True;s.display.shading.background_type='WORLD';s.world.color=(.035,.035,.035)
for f in [1,61,100]:
 s.frame_set(f);s.render.filepath=f'/Users/hoyouncho/rfsinopale/animation/pose_{f:03d}.png';bpy.ops.render.render(write_still=True)
s.render.engine=engine;s.render.resolution_x=rx;s.render.resolution_y=ry;s.render.resolution_percentage=pct;s.frame_set(1)
print('Pose previews complete')
