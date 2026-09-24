import assert from 'node:assert/strict'
import {bindDragRecovery} from '../site/drag-recovery.js'
const surface=()=>({listeners:{},addEventListener(type,fn){this.listeners[type]=fn},emit(type,event={}){this.listeners[type](event)}})
const host=surface(),doc=surface(),button={}
let drag,ended=0,cancelled=0,moved=0
const start=()=>{drag={pointer:7,el:button}}
bindDragRecovery(host,doc,()=>drag,{move(){moved++},release(){ended++;drag=null},cancel(){cancelled++;drag=null}})
start();host.emit('pointercancel',{pointerId:8});assert.ok(drag)
host.emit('pointermove',{pointerId:7});assert.equal(moved,1)
// A release outside the original button still completes the drag.
host.emit('pointerup',{pointerId:7,target:host});assert.equal(ended,1);assert.equal(drag,null)
host.emit('lostpointercapture',{pointerId:7,target:button});assert.equal(cancelled,0)
start();host.emit('lostpointercapture',{pointerId:7,target:button});assert.equal(drag,null)
start();host.emit('pointerup',{pointerId:7});assert.equal(ended,2)
start();doc.hidden=true;doc.emit('visibilitychange');assert.equal(drag,null)
start();host.emit('blur');assert.equal(drag,null)
start();host.emit('pointercancel',{pointerId:7});assert.equal(drag,null)
assert.equal(cancelled,4)
console.log('Passed: outside release, capture loss, secondary touch isolation and interruption recovery')
