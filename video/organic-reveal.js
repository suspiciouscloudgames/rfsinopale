import {revealEnvelope} from './overlay-layout.js'
// A low-resolution organic alpha field is smoothly enlarged over the source video.
export function createReveal(el,seed){
 const canvas=document.createElement('canvas');canvas.className='trigger-reveal';el.append(canvas)
 canvas.width=640;canvas.height=400
 const ctx=canvas.getContext('2d'),mask=document.createElement('canvas');mask.width=128;mask.height=128
 const m=mask.getContext('2d'),pixels=m.createImageData(128,128),field=new Float32Array(128*128)
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const u=(x-63.5)/64,v=(y-63.5)/64,a=Math.atan2(v,u)
  const wobble=1+.13*Math.sin(a*3+seed)+.09*Math.sin(a*7-seed*.7)+.045*Math.sin(a*11+seed*2)
  field[y*128+x]=Math.hypot(u,v)/wobble
 }
 let last=-1
 return (video,time,duration)=>{
  const cw=640,ch=Math.max(1,Math.round(cw*el.clientHeight/Math.max(1,el.clientWidth)))
  if(canvas.height!==ch)canvas.height=ch
  const {spread,opacity}=revealEnvelope(time,duration)
  if(time-last>=1/24||last<0){
   last=time
   for(let i=0;i<field.length;i++){
    const a=Math.max(0,Math.min(1,(spread*.78-field[i])/.22))
    pixels.data[i*4+3]=Math.round(a*a*(3-2*a)*255)
   }
   m.putImageData(pixels,0,0)
  }
  ctx.clearRect(0,0,cw,ch)
  if(video.readyState<2)return
  // Fit the complete source image. The reveal stays within its soft boundary.
  const ratio=video.videoWidth/video.videoHeight,w=Math.min(cw,ch*ratio),h=w/ratio
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=opacity
  ctx.drawImage(video,(cw-w)/2,(ch-h)/2,w,h)
  ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-in'
  ctx.drawImage(mask,(cw-w)/2,(ch-h)/2,w,h)
  ctx.globalCompositeOperation='source-over'
 }
}
