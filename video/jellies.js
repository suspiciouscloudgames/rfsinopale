import {jellyPosition,cameraPassPosition} from './jelly-layout.js'
// Native SVG fallback remains visible even without WebGL or a model.
export function createJellies(root,onStatus=()=>{}) {
 let renderer,scene,camera,THREE,cloneModel,template=null,animations=[],modelUrl='',generation=0
 let desired=0,instances=[],fallback=[],alpha=0,last=performance.now(),failed=false,wasVisible=false,elapsed=0,roundSeed=Math.random()*1000
 const fallbackRoot=document.createElement('div');fallbackRoot.className='jelly-fallback';root.append(fallbackRoot)
 function fallbackJelly(index){
  const p=jellyPosition(index),el=document.createElement('div');el.className='fallback-jelly'
  const height=2*Math.tan(35*Math.PI/360)*-p.z;el.style.left=`${(p.x/(height*1.6)+.5)*100}%`;el.style.top=`${(.5-p.y/height)*100}%`;el.style.width=`${[13,10,8][p.layer]}%`
  el.innerHTML='<svg viewBox="0 0 100 150" aria-hidden="true"><path d="M12 53 C12 0 88 0 88 53 Q50 70 12 53" fill="#b1f4e2" fill-opacity=".48" stroke="#d4fff4" stroke-width="2"/><g fill="none" stroke="#b1f4e2" stroke-width="2"><path d="M24 56 Q6 88 30 112 T22 146"/><path d="M40 62 Q60 91 38 123 T46 146"/><path d="M57 62 Q35 97 62 123 T55 146"/><path d="M75 56 Q96 90 72 117 T80 146"/></g></svg>'
  fallbackRoot.append(el);return el
 }
 function removeInstances(){for(const item of instances){scene?.remove(item.group);item.mixer?.stopAllAction();item.mixer?.uncacheRoot(item.model)}instances=[];for(const el of fallback)el.remove();fallback=[]}
 function resize(){if(!renderer)return;const {width,height}=root.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();place()}
 function place(){instances.forEach((item,i)=>{const p=jellyPosition(i,camera.aspect);item.base=p;item.group.position.set(p.x,p.y,p.z);item.group.scale.setScalar(p.scale)})}
 function reconcile(){
  if(!template||failed||!renderer){while(fallback.length<desired)fallback.push(fallbackJelly(fallback.length));while(fallback.length>desired)fallback.pop().remove();return}
  for(const el of fallback)el.remove();fallback=[]
  while(instances.length>desired){const item=instances.pop();scene.remove(item.group);item.mixer?.stopAllAction();item.mixer?.uncacheRoot(item.model)}
  while(instances.length<desired){
   const model=cloneModel(template),box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3())
   const max=Math.max(size.x,size.y,size.z)||1;const offset=new THREE.Group();offset.position.copy(center).multiplyScalar(-1);offset.add(model);const normalized=new THREE.Group();normalized.scale.setScalar(1/max);normalized.add(offset)
   const group=new THREE.Group();group.add(normalized);scene.add(group)
   let mixer=null;if(animations.length){mixer=new THREE.AnimationMixer(model);for(const clip of animations)mixer.clipAction(clip).play();mixer.setTime(Math.random()*animations[0].duration)}
   instances.push({group,model,mixer,born:performance.now(),base:null})
  }
  place()
 }
 function disposeTemplate(){if(!template)return;const geometries=new Set(),materials=new Set(),textures=new Set();template.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value)}});geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());textures.forEach(x=>x.dispose());template=null}
 async function load(url){
  if(url===modelUrl)return;modelUrl=url;const current=++generation;removeInstances();disposeTemplate();reconcile();onStatus('해파이 모델 로딩 중 · 대체 실루엣 준비됨')
  try {
   if(!THREE){THREE=await import('three');const skeleton=await import('./vendor/three/addons/utils/SkeletonUtils.js');cloneModel=skeleton.clone}
   if(!renderer){
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setClearColor(0,0);root.prepend(renderer.domElement)
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1.6,.025,40);scene.add(new THREE.HemisphereLight(0xd5fff1,0x29486f,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,5,4);scene.add(light);scene.fog=new THREE.FogExp2(0x092738,.045)
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;renderer.domElement.style.display='none';removeInstances();reconcile();onStatus('WebGL 중단 · 해파이 대체 표시')})
    resize()
   }
   const {GLTFLoader}=await import('./vendor/three/addons/loaders/GLTFLoader.js')
   const gltf=await new GLTFLoader().loadAsync(new URL(url,location.href).href)
   if(current!==generation)return
   template=gltf.scene;animations=gltf.animations
   template.traverse(node=>{if(node.isMesh){node.frustumCulled=false;const materials=Array.isArray(node.material)?node.material:[node.material];for(const m of materials){if(m?.emissive){m.emissive.setHex(0x3c766f);m.emissiveIntensity=.3}if(m)m.side=THREE.DoubleSide}}})
   reconcile();onStatus('해파이 GLB 모델 준비 완료');root.dataset.asset='model';root.dataset.animationCount=String(animations.length)
  }catch(error){if(current!==generation)return;onStatus('해파이 모델 사용 불가 · 대체 실루엣 표시');root.dataset.asset='fallback';reconcile();console.warn('Haepai fallback:',error.message)}
 }
 const observer=new ResizeObserver(resize);observer.observe(root)
 return {
  load,
  set(count,opacity){
   alpha=opacity;root.style.opacity=String(alpha);root.dataset.visibleCount=String(alpha>0?count:0)
   const next=alpha>0?count:0;if(next!==desired){if(!desired&&next){elapsed=0;roundSeed=Math.random()*1000}desired=next;reconcile()}
  },
  frame(now){
   const dt=Math.min((now-last)/1000,.1);last=now
   if(alpha<=0){if(wasVisible&&renderer&&!failed)renderer.clear();wasVisible=false;return}wasVisible=true
   elapsed+=dt
   instances.forEach((item,i)=>{const p=i===0?cameraPassPosition(elapsed,camera.aspect):jellyPosition(i,camera.aspect,elapsed,roundSeed);item.group.position.set(p.x,p.y,p.z);item.group.rotation.z=-.32;item.group.rotation.y=Math.sin(elapsed*.12+i)*.2;item.group.scale.setScalar(p.scale*p.edge*Math.min(1,(now-item.born)/700));item.mixer?.update(dt)})
   fallback.forEach((el,i)=>{const p=jellyPosition(i,1.6,elapsed,roundSeed);el.style.left=`${p.u*100}%`;el.style.top=`${p.v*100}%`;el.style.width=`${[20,14,9][p.layer]}%`;el.style.transform=`translate(-50%,-50%) rotate(25deg) scale(${p.edge})`})
   root.dataset.motionTime=elapsed.toFixed(2);root.dataset.cameraPassZ=cameraPassPosition(elapsed).z.toFixed(2)
   if(renderer&&!failed)renderer.render(scene,camera)
  },
  get mode(){return template&&!failed?'model':'fallback'}
 }
}
