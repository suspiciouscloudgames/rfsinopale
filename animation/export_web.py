import bpy,os
s=bpy.context.scene;o=bpy.data.objects['output_unwrapped']
old_end=s.frame_end;old_frame=s.frame_current
selected=list(bpy.context.selected_objects);active=bpy.context.view_layer.objects.active
try:
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 s.frame_end=481;s.frame_set(1)
 path='/Users/hoyouncho/rfsinopale/animation/jellyfish_slow_swim.glb'
 bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='SCENE',export_anim_scene_split_object=False,export_frame_range=True,export_frame_step=1,export_anim_slide_to_zero=True,export_morph=True,export_morph_normal=True,export_morph_animation=True,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False)
 print('EXPORTED',path,os.path.getsize(path))
finally:
 s.frame_end=old_end;s.frame_set(old_frame)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in selected:obj.select_set(True)
 bpy.context.view_layer.objects.active=active
