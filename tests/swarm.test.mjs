import test from 'node:test'
import assert from 'node:assert/strict'
import {DEFAULTS,validateSettings} from '../video/config.js'
import {ScreeningCycle} from '../video/cycle.js'
import {ShowController} from '../shared/show/controller.js'
test('composition ignores counts while legacy formula remains restorable in both runtimes',()=>{
 for(const count of [0,1,100]){
  const web=new ScreeningCycle(DEFAULTS),desktop=new ShowController(DEFAULTS,()=>0,'test')
  web.start();desktop.begin(311,4)
  web.count=desktop.count=count
  assert.equal(web.displayJellyCount(),4);assert.equal(desktop.snapshot().jellyCount,4)
  const expected=Math.min(16,Math.max(1,count))
  assert.equal(web.jellyCount(),expected);assert.equal(desktop.countJellies(),expected)
  web.start({...DEFAULTS,jellyMode:'trigger-count'});web.count=count
  desktop.nextSettings={...DEFAULTS,jellyMode:'trigger-count'};desktop.begin(311,5);desktop.count=count
  assert.equal(web.displayJellyCount(),expected);assert.equal(desktop.snapshot().jellyCount,expected)
 }
})
test('composition settings validate without discarding legacy preferences',()=>{
 const s=validateSettings({minJellies:2,maxJellies:12,jelliesPerTrigger:3})
 assert.equal(s.jellyMode,'composition');assert.equal(s.jelliesPerTrigger,3)
 for(const bad of [{jellyMode:'other'},{compositionJellies:0},{swarmDensity:'other'},{swarmOpacity:2}])assert.throws(()=>validateSettings(bad))
})
import {heroRevealTime,swarmLayout,swarmProgress,SWARM_COUNTS} from '../video/swarm-layout.js'
import {cameraPassPosition} from '../video/jelly-layout.js'
import {jellyPose} from '../shared/show/scene.js'
test('swarm follows the hero in both views and shares deterministic geometry',()=>{
 for(const [aspect,pose] of [[1.6,t=>cameraPassPosition(t,1.6)],[1920/2160,t=>jellyPose(0,t,8)]]){
  const ready=heroRevealTime(pose,aspect)
  assert.ok(ready>16&&ready+3+24<90)
  assert.equal(swarmProgress(ready+3,ready,DEFAULTS),0)
  assert.equal(swarmProgress(ready+27,ready,DEFAULTS),1)
  assert.equal(swarmProgress(90,ready,{...DEFAULTS,jellyMode:'trigger-count'}),0)
  const a=swarmLayout(8,aspect),b=swarmLayout(8,aspect)
  assert.deepEqual(a,b);assert.equal(a.length,SWARM_COUNTS.medium)
  assert.notDeepEqual(a,swarmLayout(9,aspect))
  for(let i=1;i<a.length;i++)assert.ok(a[i].z>=a[i-1].z)
 }
})
test('quality levels stay deterministic and scene reset clears the reveal',()=>{
 for(const density of Object.keys(SWARM_COUNTS)){
  const layout=swarmLayout(42,1920/2160,density)
  assert.equal(layout.length,SWARM_COUNTS[density])
  assert.ok(layout.every(p=>Object.values(p).every(Number.isFinite)&&p.z>=-36&&p.z<=-13))
 }
 assert.equal(swarmProgress(0,52.5,DEFAULTS),0)

})
import {swarmEntryOpacity,activeSwarmCount} from '../video/swarm-layout.js'
test('individual births are spread out, fade in continuously and finish at the end',()=>{
 for(const density of ['low','medium','high']){
  const items=swarmLayout(9,1.6,density),births=items.map(p=>p.delay).sort((a,b)=>a-b),n=items.length
  assert.equal(activeSwarmCount(0,births),0)
  assert.ok(activeSwarmCount(.1,births)<n*.02)
  assert.ok(activeSwarmCount(.5,births)<n*.40)
  assert.equal(activeSwarmCount(1,births),n)
  for(let i=1;i<births.length;i++)assert.ok(births[i]>births[i-1])
  for(let p=.01;p<=1;p+=.01)assert.ok(activeSwarmCount(p,births)-activeSwarmCount(p-.01,births)<=Math.ceil(n*.026))
  for(const item of items){assert.equal(swarmEntryOpacity(item.delay,item.delay),0);assert.ok(swarmEntryOpacity(item.delay+.001,item.delay)<.001);assert.equal(swarmEntryOpacity(1,item.delay),1)}
 }
})

test('slower swarm defaults migrate once and preserve subsequent timing edits',()=>{
 assert.equal(DEFAULTS.swarmRise,24)
 assert.equal(validateSettings({swarmRise:12}).swarmRise,24)
 assert.equal(validateSettings({swarmRise:36}).swarmRise,36)
 assert.equal(validateSettings({swarmRise:12,swarmTimingVersion:2}).swarmRise,12)
 const births=swarmLayout(9,1.6).map(p=>p.delay).sort((a,b)=>a-b)
 assert.ok(activeSwarmCount(swarmProgress(9,0,DEFAULTS),births)<840*.1)
 assert.equal(swarmProgress(27,0,DEFAULTS),1)
})

test('settings force composition even when an old file selects trigger-count',()=>{
 const s=validateSettings({...DEFAULTS,jellyMode:'trigger-count',compositionJellies:5,jelliesPerTrigger:3})
 assert.equal(s.jellyMode,'composition');assert.equal(s.compositionJellies,5);assert.equal(s.jelliesPerTrigger,3)
 const web=new ScreeningCycle(s)
 web.start(s);web.count=100
 assert.equal(web.displayJellyCount(),5)
})
