import test from 'node:test'
import assert from 'node:assert/strict'
import {ScreeningCycle,fadeAt} from '../video/cycle.js'
import {DEFAULTS,validateSettings} from '../video/config.js'
test('duration-relative fade including short film and zero fade',()=>{
 assert.ok(fadeAt(251.266667,311.266667,60)<1e-12)
 assert.ok(Math.abs(fadeAt(281.266667,311.266667,60)-.5)<1e-9)
 assert.equal(fadeAt(311.266667,311.266667,60),1)
 assert.equal(fadeAt(10,20,60),.5);assert.equal(fadeAt(19,20,0),0);assert.equal(fadeAt(20,20,0),1)
 assert.equal(fadeAt(0,NaN,60),0)
})
test('deduplicate, count last-minute events, hold belongs to next round, clear immediately',()=>{
 const c=new ScreeningCycle(DEFAULTS);c.start();assert.equal(c.jellyCount(),1)
 assert.ok(c.accept('one'));assert.equal(c.accept('one'),false)
 c.frame(290,311);c.accept('two');assert.equal(c.count,2)
 c.end();assert.equal(c.end(),false);c.accept('hold');assert.equal(c.count,2);assert.equal(c.pending,1)
 assert.equal(c.tick(40,false),false);assert.equal(c.remaining,30)
 assert.equal(c.tick(29),false);assert.equal(c.tick(1),true)
 c.start();assert.equal(c.count,1);assert.equal(c.frame(0,311),0);assert.equal(c.accept('one'),false)
})
test('ten rounds, hold starts once, zero delay and bounded jellies',()=>{
 const c=new ScreeningCycle({...DEFAULTS,holdSeconds:0})
 for(let i=0;i<10;i++){c.start();for(let j=0;j<40;j++)c.accept(`${i}:${j}`);assert.equal(c.jellyCount(),16);c.end();assert.equal(c.tick(0),true);assert.equal(c.tick(1),false)}
 assert.equal(c.round,10)
})
test('operator settings reject bad values',()=>{
 for(const input of [{fadeSeconds:-1},{holdSeconds:NaN},{overlayOpacity:2},{maxJellies:1.5},{minJellies:5,maxJellies:2},{modelUrl:'javascript:alert(1)'}])assert.throws(()=>validateSettings(input))
 assert.equal(validateSettings({holdSeconds:0}).holdSeconds,0)
})

test('previous default assets migrate without changing saved timing or opacity',()=>{
 const result=validateSettings({modelUrl:'../assets/models/haepai/haepai.glb',triggerVideoUrl:'../assets/hub-background.mp4',fadeSeconds:45,holdSeconds:12,overlayOpacity:.6})
 assert.equal(result.modelUrl,'../animation/jellyfish_slow_swim.glb')
 assert.equal(result.triggerVideoUrl,'./trigger-videos.json')
 assert.equal(result.fadeSeconds,45);assert.equal(result.holdSeconds,12);assert.equal(result.overlayOpacity,.6)
})

test('saved duration migrates to seventeen seconds while new settings retain their chosen duration',async()=>{
 const {readSavedSettings}=await import('../video/config.js')
 const old=globalThis.localStorage
 try{
  let saved=JSON.stringify({overlaySeconds:8,overlayOpacity:.6})
  globalThis.localStorage={getItem:()=>saved}
  const migrated=readSavedSettings();assert.equal(migrated.overlaySeconds,17);assert.equal(migrated.overlayOpacity,.65)
  saved=JSON.stringify(migrated);assert.equal(readSavedSettings().overlaySeconds,17);assert.equal(readSavedSettings().overlayOpacity,.65)
  saved=JSON.stringify({...migrated,overlaySeconds:10});assert.equal(readSavedSettings().overlaySeconds,10)
 }finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old}
})
