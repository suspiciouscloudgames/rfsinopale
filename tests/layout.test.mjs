import test from 'node:test'
import assert from 'node:assert/strict'
import {overlayPlacement,revealEnvelope} from '../video/overlay-layout.js'
import {jellyPosition,cameraPassPosition} from '../video/jelly-layout.js'
import {chooseVideo} from '../video/trigger-selection.js'
test('random reveal centers cover the entire frame, including center',()=>{
 for(const r of [0,.25,.5,.75,.999]){
  const p=overlayPlacement(0,()=>r)
  assert.ok(Math.abs(p.x+p.width/2-r)<1e-9)
  assert.ok(Math.abs(p.y+p.height/2-r)<1e-9)
 }
})
test('organic reveal expands from zero and disappears at clip end',()=>{
 for(const duration of [.5,8,120]){
  assert.equal(revealEnvelope(0,duration).spread,0)
  assert.equal(revealEnvelope(duration,duration).opacity,0)
  assert.ok(revealEnvelope(duration*.2,duration).spread<revealEnvelope(duration*.5,duration).spread)
  assert.equal(revealEnvelope(duration*.5,duration).opacity,1)
 }
})
test('reserved jelly starts behind camera, crosses it, then recedes up-right',()=>{
 const a=cameraPassPosition(0),b=cameraPassPosition(16),c=cameraPassPosition(30),d=cameraPassPosition(65)
 assert.ok(a.z>0);assert.equal(b.z,0);assert.ok(c.z<0&&d.z<c.z)
 assert.ok(d.x>c.x&&d.y>c.y);assert.equal(a.scale,d.scale)
})
test('jellies move up-right with varied depth and size; recycling stays framed',()=>{
 const depths=new Set(),sizes=new Set()
 for(let i=0;i<32;i++){
  const a=jellyPosition(i),b=jellyPosition(i,1.6,10)
  assert.ok(b.x>a.x&&b.y>a.y);depths.add(a.z);sizes.add(a.scale)
  for(let t=0;t<1200;t+=3){
   const p=jellyPosition(i,1.6,t),h=2*Math.tan(35*Math.PI/360)*-p.z
   assert.ok(Math.abs(p.x)+p.scale*.5<h*1.6/2)
   assert.ok(Math.abs(p.y)+p.scale*.5<h/2)
   assert.ok(p.edge>=0&&p.edge<=1)
  }
 }
 assert.ok(depths.size>20&&sizes.size>20)
})
test('random video selection covers collection without immediate repetition',()=>{
 const list=['a','b','c','d'],seen=new Set();let previous
 for(let i=0;i<100;i++){const next=chooseVideo(list,previous,()=>i%10/10);assert.notEqual(next,previous);seen.add(next);previous=next}
 assert.equal(seen.size,4);assert.equal(chooseVideo(['a'],'a'),'a')
})

test('short video loops preserve the seventeen-second reveal timeline',async()=>{
 const {overlayTimeStep}=await import('../video/overlay-layout.js')
 let previous=0,total=0
 for(let i=1;i<=170;i++){
  const current=(i/10)%8
  total+=overlayTimeStep(previous,current,8);previous=current
 }
 assert.ok(Math.abs(total-17)<1e-9)
 assert.equal(revealEnvelope(total,17).opacity,0)
 const p=overlayPlacement(0,()=>.5)
 assert.equal(p.width,1.24);assert.equal(p.height,1.24)
})

test('opacity rises for seven seconds, holds three, falls seven to zero',()=>{
 for(const [time,expected] of [[0,0],[3.5,.5],[7,1],[8.5,1],[10,1],[13.5,.5],[17,0],[18,0]]){
  assert.ok(Math.abs(revealEnvelope(time,17).opacity-expected)<1e-9)
 }
 for(let t=0;t<7;t+=.1)assert.ok(revealEnvelope(t+.1,17).opacity>=revealEnvelope(t,17).opacity)
 for(let t=10;t<17;t+=.1)assert.ok(revealEnvelope(t+.1,17).opacity<=revealEnvelope(t,17).opacity)
})
