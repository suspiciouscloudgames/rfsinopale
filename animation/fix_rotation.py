import bpy
s=bpy.context.scene;o=bpy.data.objects['output_unwrapped'];o.rotation_mode='XYZ';s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath='/Users/hoyouncho/rfsinopale/animation/jellyfish_slow_swim.blend')
print('Euler animation enabled; saved')
