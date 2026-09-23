export function fadeAt(time,duration,seconds) {
  if(!Number.isFinite(duration)||duration<=0)return 0
  const fade=Math.min(seconds,duration)
  if(fade===0)return time>=duration?1:0
  const p=Math.max(0,Math.min(1,(time-duration+fade)/fade))
  return p*p*(3-2*p)
}
export class ScreeningCycle {
  constructor(settings){this.settings={...settings};this.phase='ready';this.round=0;this.count=0;this.pending=0;this.remaining=0;this.seen=new Set()}
  accept(id){
    if(typeof id!=='string'||!id||id.length>200||this.seen.has(id))return false
    this.seen.add(id)
    if(this.phase==='playing'||this.phase==='fading')this.count++
    else this.pending++
    return true
  }
  start(settings=this.settings){this.settings={...settings};this.round++;this.count=this.pending;this.pending=0;this.phase='playing';this.remaining=0}
  frame(time,duration){
    if(this.phase!=='playing'&&this.phase!=='fading')return this.phase==='ready'?0:1
    const fade=fadeAt(time,duration,this.settings.fadeSeconds)
    this.phase=fade>0?'fading':'playing';return fade
  }
  end(){if(this.phase!=='playing'&&this.phase!=='fading')return false;this.phase='hold';this.remaining=this.settings.holdSeconds;return true}
  tick(seconds,visible=true){
    if(this.phase!=='hold'||!visible)return false
    this.remaining=Math.max(0,this.remaining-Math.max(0,seconds))
    if(this.remaining===0){this.phase='restarting';return true}
    return false
  }
  jellyCount(){return Math.min(this.settings.maxJellies,Math.max(this.settings.minJellies,this.count*this.settings.jelliesPerTrigger))}
}
