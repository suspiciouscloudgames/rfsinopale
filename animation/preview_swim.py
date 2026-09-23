import bpy
s=bpy.context.scene;o=bpy.data.objects['output_unwrapped']
for p in o.data.polygons:p.use_smooth=True
s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath='/Users/hoyouncho/rfsinopale/animation/jellyfish_slow_swim.blend')
s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG'
for f in range(1,481,2):
 s.frame_set(f);s.render.filepath=f'/Users/hoyouncho/rfsinopale/animation/preview_frames/{(f-1)//2:04d}.png';bpy.ops.render.render(write_still=True)
s.frame_set(1)
print('240 preview frames rendered')
