import * as THREE from 'three'
import {swarmLayout,swarmProgress,SWARM_ENTRY_FRACTION,activeSwarmCount} from './swarm-layout.js'
// One instanced draw, shared procedural silhouette, no textures or per-jelly mixers.
export function createSwarm(scene){
 let mesh=null,signature='',births=[]
 function dispose(){if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh=null}signature='';births=[]}
 function prepare(seed,aspect,density){
  const key=`${seed}:${aspect}:${density}`;if(key===signature)return
  dispose();signature=key
  const items=swarmLayout(seed,aspect,density),base=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry()
  g.index=base.index.clone();g.setAttribute('position',base.attributes.position.clone());g.setAttribute('uv',base.attributes.uv.clone());base.dispose()
  births=items.map(p=>p.delay).sort((a,b)=>a-b)
  const centers=[],details=[]
  for(const p of items){centers.push(p.x,p.y,p.z);details.push(p.size,p.phase,p.kind,p.delay)}
  g.setAttribute('aCenter',new THREE.InstancedBufferAttribute(new Float32Array(centers),3));g.setAttribute('aDetail',new THREE.InstancedBufferAttribute(new Float32Array(details),4));g.instanceCount=items.length
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
   uniforms:{uTime:{value:0},uReveal:{value:0},uOpacity:{value:.45}},
   vertexShader:`attribute vec3 aCenter;attribute vec4 aDetail;uniform float uTime;varying vec2 vUv;varying vec4 vDetail;varying float vDepth;
   void main(){vUv=uv;vDetail=aDetail;vDepth=-aCenter.z;
    float phase=aDetail.y,angle=sin(uTime*.04+phase)*.3+phase;
    vec2 p=position.xy; p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
    p*=aDetail.x*(1.+.07*sin(uTime*(.45+aDetail.z*.2)+phase));
    vec3 center=aCenter;float speed=mix(.014,.005,clamp((-center.z-13.)/23.,0.,1.));
    center.xy+=vec2(uTime*speed+sin(uTime*.06+phase)*.12,uTime*speed+cos(uTime*.045+phase)*.1);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(center+vec3(p,0.),1.);
   }`,
   fragmentShader:`uniform float uTime;uniform float uReveal;uniform float uOpacity;varying vec2 vUv;varying vec4 vDetail;varying float vDepth;
   float ring(float d,float radius,float width){return 1.-smoothstep(width,width*2.5,abs(d-radius));}
   void main(){vec2 p=(vUv-.5)*2.;float angle=atan(p.y,p.x);
    vec2 oval=p*vec2(1.,1.12+vDetail.z*.22);float d=length(oval);
    float rim=.72+.022*sin(angle*(4.+floor(vDetail.z*5.))+vDetail.y)+.018*sin(angle*15.-uTime*.12);
    float outer=ring(d,rim,.012),inner=ring(d,rim-.065,.008)*.38;
    float body=(1.-smoothstep(.35,.74,d))*.16;
    float petals=0.;for(int i=0;i<4;i++){float a=float(i)*1.5707963+vDetail.y*.15;vec2 q=oval-vec2(cos(a),sin(a))*.18;petals+=ring(length(q),.12,.008)*.5;}
    float reveal=smoothstep(vDetail.w,min(1.,vDetail.w+${SWARM_ENTRY_FRACTION.toFixed(6)}),uReveal);
    float alpha=clamp(outer*.9+inner+body+petals,0.,1.)*reveal*uOpacity*mix(.95,.55,clamp((vDepth-13.)/23.,0.,1.));
    if(alpha<.002)discard;
    gl_FragColor=vec4(mix(vec3(.61,.81,.8),vec3(.88,.95,.91),vDetail.z),alpha);
   }`})
  mesh=new THREE.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=-1;scene.add(mesh)
 }
 return {
  frame({time,seed,aspect,ready,settings,visible=true}){
   if(!visible||settings.jellyMode!=='composition'){if(mesh)mesh.visible=false;return 0}
   prepare(seed,aspect,settings.swarmDensity)
   const reveal=swarmProgress(time,ready,settings);mesh.visible=reveal>0
   mesh.material.uniforms.uTime.value=time;mesh.material.uniforms.uReveal.value=reveal;mesh.material.uniforms.uOpacity.value=settings.swarmOpacity
   return activeSwarmCount(reveal,births)
  },dispose
 }
}
