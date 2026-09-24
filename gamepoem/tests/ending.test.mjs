import {composeSentence} from '../site/korean-particles.js'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const source=readFileSync(new URL('../site/projection-poem.js',import.meta.url),'utf8').replace(/^import .*\n/, '').replace('export function','function')+'\nglobalThis.create=connectPoemEnding'
const listeners={},messages=[],timers=[],completed=[],elements=[]
const parent={postMessage:data=>messages.push(data)}
const node=()=>({hidden:false,children:[],scrollTop:0,scrollHeight:100,clientHeight:100,append(child){this.children.push(child)}})
const ctx=vm.createContext({composeSentence,URL,location:{origin:'https://example.test'},document:{referrer:'https://example.test/video/',createElement(){const el=node();elements.push(el);return el},body:node()},parent,window:{addEventListener:(event,fn)=>listeners[event]=fn},performance:{now:()=>0},requestAnimationFrame(){},setTimeout:(fn,ms)=>timers.push({fn,ms})})
vm.runInContext(source,ctx)
const api=ctx.create({byId:new Map([['one',{text:'첫 어구'}],['two',{text:'둘째 어구'}]]),complete:t=>completed.push(t),progress(){}})
api.set([{kind:'poem',token:'draft',lines:['two','one']}])
listeners.message({source:parent,origin:'https://example.test',data:{type:'film-ended'}})
assert.equal(messages[0].duration,20000)
assert.deepEqual(elements[1].children.map(p=>p.textContent),['둘째 어구','첫 어구'])
assert.equal(timers[0].ms,20000)
timers[0].fn();assert.equal(elements[0].hidden,true);assert.deepEqual(completed,['draft']);assert.equal(messages.at(-1).type,'poem-finished')
console.log('Passed: ordered poem, exact 20-second ending, completion and restart notification')
const nextIndex=elements.length
const free=ctx.create({byId:new Map([
 ['sentence',{kind:'sentence',particle:'이/가',before:'그곳에 ',after:' 생겼고, 반려체도 하나 있었습니다.',text:'그곳에 감응장이 생겼고, 반려체도 하나 있었습니다.'}],
 ['alternative',{kind:'answer',text:'다른 감정'}],
 ['wrong-type',{kind:'sentence',text:'not a phrase'}]
]),complete(){},progress(){}})
free.set([{kind:'poem',token:'free',lines:['sentence'],fills:[{sentenceId:'sentence',answerId:'alternative'},null,{sentenceId:'sentence',answerId:'wrong-type'}]}])
listeners.message({source:parent,origin:'https://example.test',data:{type:'film-ended'}})
assert.equal(elements[nextIndex+1].children[0].textContent,'그곳에 다른 감정이 생겼고, 반려체도 하나 있었습니다.')
assert.equal(timers.at(-1).ms,20000)
console.log('Passed: projection preserves a freely chosen phrase and ignores invalid fill types')
