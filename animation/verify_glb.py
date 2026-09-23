import struct,json
p='animation/jellyfish_slow_swim.glb'
b=open(p,'rb').read();magic,version,total=struct.unpack_from('<4sII',b);n,kind=struct.unpack_from('<II',b,12);j=json.loads(b[20:20+n]);binstart=20+n+8
assert magic==b'glTF' and version==2 and total==len(b)
def vals(idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];count=a['count']*{'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];return struct.unpack_from('<'+'f'*count,b,binstart+v.get('byteOffset',0)+a.get('byteOffset',0))
summary=[]
for anim in j['animations']:
 channels=[]
 for c in anim['channels']:
  sam=anim['samplers'][c['sampler']];t=vals(sam['input']);v=vals(sam['output']);stride=len(v)//len(t)
  err=max(abs(x-y) for x,y in zip(v[:stride],v[-stride:]))
  assert abs((t[-1]-t[0])-20)<1e-4,(t[0],t[-1])
  assert err<1e-5,err
  channels.append({'path':c['target']['path'],'seconds':t[-1]-t[0],'loop_error':err})
 summary.append({'name':anim.get('name'),'channels':channels})
assert len(j['animations'])==1
assert any(c['target']['path']=='weights' for c in j['animations'][0]['channels'])
assert all('bufferView' in i for i in j['images'])
print(json.dumps({'size_MB':round(len(b)/1e6,2),'animations':summary,'morph_targets':len(j['meshes'][0]['primitives'][0]['targets']),'embedded_textures':len(j['images'])},indent=2))
