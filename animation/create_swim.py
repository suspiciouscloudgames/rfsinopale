import bpy, math, os
from mathutils import Vector
from math import sin,cos,pi,atan2,exp
ROOT='/Users/hoyouncho/rfsinopale/animation'
scene=bpy.context.scene
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/jellyfish_original.blend',copy=True)
o=bpy.data.objects['output_unwrapped']
o.shape_key_add(name='Basis')
coords=[v.co.copy() for v in o.data.vertices]
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
names=['Bell_Contraction','Bell_Soft_Asymmetry','Rim_Ripple_Sin','Rim_Ripple_Cos','Tentacle_Flow_X_Sin','Tentacle_Flow_X_Cos','Tentacle_Flow_Y_Sin','Tentacle_Flow_Y_Cos']
keys={name:o.shape_key_add(name=name) for name in names}
for k in keys.values():k.slider_min=-1;k.slider_max=1
for i,v in enumerate(coords):
 x,y,z=v;theta=atan2(y,x);r=(x*x+y*y)**.5
 bell=smooth(-.15,.15,z);tail=1-smooth(-.8,.1,z);rim=exp(-((z-.12)/.23)**2)
 d=keys['Bell_Contraction'].data[i].co
 d.x=x*(1-.16*bell-.025*(1-bell));d.y=y*(1-.16*bell-.025*(1-bell));d.z=z+.12*bell*(z-.12)+.035*rim
 d=keys['Bell_Soft_Asymmetry'].data[i].co
 d.x+=.045*bell*(z+.15);d.y-=.025*bell*(z+.15);d.z+=.032*bell*cos(2*theta)*min(1,r/.6)
 for suffix,fn in [('Sin',sin),('Cos',cos)]:
  d=keys['Rim_Ripple_'+suffix].data[i].co
  wave=fn(3*theta+z*2)
  d.x+=.018*rim*cos(theta)*wave;d.y+=.018*rim*sin(theta)*wave;d.z+=.035*rim*wave
  phase=3.8*(-z)+.55*sin(theta*2)
  d=keys['Tentacle_Flow_X_'+suffix].data[i].co
  d.x+=.15*tail*fn(phase);d.z+=.022*tail*fn(phase+theta)
  d=keys['Tentacle_Flow_Y_'+suffix].data[i].co
  d.y+=.12*tail*fn(phase+.7*cos(theta));d.z+=.016*tail*fn(phase-theta)
scene.render.fps=24;scene.frame_start=1;scene.frame_end=480
for f in range(1,482,3):
 t=(f-1)/480*2*pi;p=4*t
 # smooth concentrated contraction, long relaxed recovery
 pulse=((1-cos(p))*.5)**2
 values=[pulse,.55*sin(t)+.25*sin(3*t),.65*sin(p),.65*cos(p),sin(p-.9),cos(p-.9),sin(3*t+.5),cos(3*t+.5)]
 for name,val in zip(names,values):
  keys[name].value=val;keys[name].keyframe_insert('value',frame=f)
 o.location=(.13*sin(t),.08*(cos(t)-1),.10*sin(t)+.065*sin(p-.7))
 o.rotation_euler=(.045*sin(t+.4),.065*sin(t),.055*sin(t-.3))
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
for datablock in [o,o.data.shape_keys]:
 action=datablock.animation_data.action
 action.name='Jellyfish_Slow_Swim_'+('Drift' if datablock==o else 'Soft_Body')
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for kp in fc.keyframe_points:kp.interpolation='BEZIER';kp.handle_left_type='AUTO_CLAMPED';kp.handle_right_type='AUTO_CLAMPED'
     fc.modifiers.new('CYCLES')
o['Animation Notes']='20-second seamless loop, 24 fps, frames 1-480; duplicate endpoint at 481. Bell pulse every 5 seconds. Editable shape keys and transform F-curves.'
for name,f in [('RELAX / LOOP START',1),('CONTRACT',61),('RELEASE',100),('SECOND PULSE',181),('THIRD PULSE',301),('FOURTH PULSE',421)]:scene.timeline_markers.new(name,frame=f)
cam_data=bpy.data.cameras.new('Swim_Preview_Camera');cam=bpy.data.objects.new('Swim_Preview_Camera',cam_data);scene.collection.objects.link(cam)
cam.location=(3.2,-6,2.0);cam.rotation_euler=(Vector((0,0,.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';cam_data.ortho_scale=3.3
scene.camera=cam
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_distance=4.5;area.spaces.active.region_3d.view_location=Vector((0,0,0));area.spaces.active.overlay.show_floor=False
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/jellyfish_slow_swim.blend')
print('Saved animation',bpy.data.filepath,'shape keys',len(keys),'frames',scene.frame_end)
