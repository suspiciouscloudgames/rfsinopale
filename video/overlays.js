import {createReveal} from './organic-reveal.js'
import {chooseVideo} from './trigger-selection.js'
import {overlayPlacement,overlayTimeStep} from './overlay-layout.js'
export function createOverlays(root,onStatus=()=>{}) {
 let sequence=0,generation=0,previous=null,paused=false,pending=null;const active=[],lists=new Map()
 async function source(path){if(!/\.json(?:[?#]|$)/i.test(path))return path;if(!lists.has(path))lists.set(path,fetch(new URL(path,location.href),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(list=>{if(!Array.isArray(list)||!list.length||list.some(x=>typeof x!=='string'||!x.trim()))throw new Error();return list}).catch(error=>{lists.delete(path);throw error}));const list=await lists.get(path);previous=chooseVideo(list,previous);return previous}
 function remove(item){if(!active.includes(item))return;clearTimeout(item.timeout);item.video.pause();item.video.removeAttribute('src');item.video.load();item.el.remove();item.line.remove();active.splice(active.indexOf(item),1)}
 return {
  async play(settings){
   // Reserve the only slot before fetching: rapid triggers must not race the load.
   if(pending||active.length)return
   const token={generation};pending=token
   try {
   const current=generation;let url;try{url=await source(settings.triggerVideoUrl)}catch{if(current===generation)onStatus('트리거영상 목록을 확인하세요.');return}if(current!==generation)return
   const position=overlayPlacement(sequence++),el=document.createElement('div'),video=document.createElement('video')
   el.className='trigger-overlay';el.style.opacity=String(settings.overlayOpacity);Object.assign(el.style,{left:`${position.x*100}%`,top:`${position.y*100}%`,width:`${position.width*100}%`,height:`${position.height*100}%`})
   video.loop=true;video.muted=true;video.playsInline=true;video.preload='auto';video.src=new URL(url,location.href).href
   el.append(video);root.append(el)
   root.querySelector('.trigger-line')?.remove()
   const ns='http://www.w3.org/2000/svg',line=document.createElementNS(ns,'svg'),stroke=document.createElementNS(ns,'line')
   line.classList.add('trigger-line');line.setAttribute('viewBox','0 0 100 100');line.setAttribute('preserveAspectRatio','none');line.setAttribute('aria-hidden','true')
   stroke.setAttribute('x1','0');stroke.setAttribute('y1','50');stroke.setAttribute('x2','0');stroke.setAttribute('y2','50');stroke.setAttribute('vector-effect','non-scaling-stroke')
   line.append(stroke);root.append(line)
   const render=createReveal(el,position.seed)
   const item={render,el,line,stroke,video,settings:{...settings},position,elapsed:0,previousTime:0,timeout:null};active.push(item)
   item.timeout=setTimeout(()=>{onStatus('트리거영상 로딩 시간 초과');remove(item)},15000)
   video.addEventListener('playing',()=>clearTimeout(item.timeout),{once:true})
   video.addEventListener('error',()=>{onStatus('트리거영상 파일을 확인하세요.');remove(item)},{once:true})
   ;(paused?Promise.resolve():video.play()).catch(()=>{if(!active.includes(item))return;onStatus('트리거영상 재생 실패');remove(item)})
   } finally {if(pending===token)pending=null}
  },
  frame(){for(const item of [...active]){
   const {video,settings,el}=item,d=settings.overlaySeconds
   item.elapsed+=overlayTimeStep(item.previousTime,video.currentTime,Number.isFinite(video.duration)?video.duration:0)
   item.previousTime=video.currentTime
   const t=item.elapsed
   if(t>=d){remove(item);continue}
   el.style.opacity=String(settings.overlayOpacity)
   item.stroke.setAttribute('x2',String(Math.min(1,t/7)*100))
   item.line.style.opacity=String(Math.min(1,Math.max(0,(d-t)/(d*7/17))))
   item.render(video,t,d)
  }},
  setPaused(value){paused=value;for(const item of active){if(value)item.video.pause();else item.video.play().catch(()=>remove(item))}},
  clear(){generation++;pending=null;for(const item of [...active])remove(item)},
  get count(){return active.length}
 }
}
