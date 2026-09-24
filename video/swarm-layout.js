export const SWARM_ENTRY_FRACTION=.2
export const SWARM_COUNTS={low:300,medium:840,high:1500}
export function swarmRandom(seed,index){const n=Math.sin(seed*12.9898+index*78.233)*43758.5453;return n-Math.floor(n)}
// Use the global camera, never a cropped output viewport, to schedule the reveal.
export function heroRevealTime(pose,aspect){
 for(let t=0;t<=180;t+=.25){
  const p=pose(t),h=2*Math.tan(35*Math.PI/360)*-p.z
  if(p.z<-.1&&p.scale/h<=.85&&Math.abs(p.x)<h*aspect*.5&&Math.abs(p.y)<h*.5)return t+1
 }
 return Infinity
}
export function swarmProgress(time,ready,settings){
 if(settings.jellyMode!=='composition')return 0
 const p=Math.max(0,Math.min(1,(time-ready-settings.swarmDelay)/settings.swarmRise))
 return p
}
export function swarmLayout(seed,aspect,density='medium'){
 const count=SWARM_COUNTS[density]??SWARM_COUNTS.medium,items=[]
 for(let i=0;i<count;i++){
  const r=n=>swarmRandom(seed,i*17+n),cluster=i%5
  const cx=[.2,.7,.46,.83,.28][cluster],cy=[.2,.27,.55,.72,.84][cluster]
  const u=cx+(r(1)+r(2)-1)*.43,v=cy+(r(3)+r(4)-1)*.4
  const depth=i%4===0?13+r(5)*7:22+r(5)*14,h=2*Math.tan(35*Math.PI/360)*depth
  items.push({x:(u-.5)*h*aspect,y:(.5-v)*h,z:-depth,size:h*(depth<22?.055+r(6)*.065:.02+r(6)*.045),phase:r(7)*6.283,kind:r(8),delay:r(9)*.3+(depth<22?.2:0)})
 }
 // Sparse early births gradually accelerate; depth-biased ordering
 // brings the distant population in first without random batches arriving together.
 items.sort((a,b)=>a.delay-b.delay)
 items.forEach((item,i)=>{item.delay=(1-SWARM_ENTRY_FRACTION)*Math.sqrt(i/Math.max(1,count-1))})
 // Each plane stays at its depth; ascending z is stable far-to-near alpha order.
 return items.sort((a,b)=>a.z-b.z)
}

export function swarmEntryOpacity(progress,birth){
 const p=Math.max(0,Math.min(1,(progress-birth)/SWARM_ENTRY_FRACTION))
 return p*p*(3-2*p)
}
export function activeSwarmCount(progress,births){
 let low=0,high=births.length
 while(low<high){const mid=(low+high)>>>1;if(births[mid]<progress)low=mid+1;else high=mid}
 return low
}
