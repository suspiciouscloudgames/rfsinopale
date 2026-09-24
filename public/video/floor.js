const params=new URLSearchParams(location.search)
const room=/^[a-zA-Z0-9_-]{1,40}$/.test(params.get('room')||'')?params.get('room'):'sinopale'
const channel=new BroadcastChannel(`sinopale-projectors-${room}`)
const video=document.querySelector('#film'),screen=document.querySelector('#screen'),setup=document.querySelector('#setup'),status=document.querySelector('#status')
let armed=false,latest=null,lastSeen=0,cycle=null,lock=null
async function keepAwake(){try{if(armed&&!lock&&navigator.wakeLock){lock=await navigator.wakeLock.request('screen');lock.addEventListener('release',()=>{lock=null},{once:true})}}catch{}}
function apply(){
  if(!armed||!latest||!Number.isFinite(video.duration))return
  const blackout=latest.phase==='blackout'
  document.body.classList.toggle('blackout',blackout)
  if(blackout||latest.phase==='paused'||latest.phase==='waiting'){video.pause();return}
  if(latest.phase==='playing'){
    const elapsed=latest.elapsed+Math.max(0,Math.min(1,(Date.now()-latest.sentAt)/1000))
    const target=elapsed%video.duration
    if(cycle!==latest.cycle||Math.abs(video.currentTime-target)>.45)video.currentTime=target
    cycle=latest.cycle
  }
  video.play().catch(()=>{setup.hidden=false;status.textContent='Press play to resume the floor screen.'})
}
channel.onmessage=event=>{
  const data=event.data
  if(data?.type!=='projector-state'||!Number.isFinite(data.elapsed)||data.elapsed<0||!Number.isFinite(data.sentAt)||!['playing','paused','waiting','ending','blackout'].includes(data.phase))return
  latest=data;lastSeen=Date.now();apply()
}
document.querySelector('#start').addEventListener('click',async()=>{
  // Fullscreen and playback begin directly in this window's user gesture.
  const fullscreen=screen.requestFullscreen?.().catch(()=>{})
  const playback=video.play()
  try{await playback;armed=true;setup.hidden=true;document.body.classList.add('screening');if(!latest)video.pause();apply();void keepAwake();channel.postMessage({type:'floor-ready'})}catch{status.textContent='Could not start floor video. Press play to retry.'}
  await fullscreen
})
video.addEventListener('loadedmetadata',apply)
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&armed){setup.hidden=false;video.pause()}})
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void keepAwake()})
setInterval(()=>{channel.postMessage({type:'floor-ready'});if(armed&&lastSeen&&Date.now()-lastSeen>4000)video.pause()},1000)
channel.postMessage({type:'floor-ready'})
