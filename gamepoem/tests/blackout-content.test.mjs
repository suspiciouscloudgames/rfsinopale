import assert from 'node:assert/strict'
import {sentences,transcript,passages,answers,fragments,shuffledSentences,canFill,fillText} from '../site/blackout-content.js'
import {composeSentence} from '../site/korean-particles.js'
assert.equal(sentences.length,54)
assert.equal(new Set(fragments.map(f=>f.id)).size,fragments.length)
assert.equal(passages.map(p=>p.text).join('').trim(),transcript)
assert.ok(!transcript.includes('\n'))
const flatten=parts=>parts.flatMap(p=>[p,...flatten(p.children||[])])
const ranges=flatten(passages)
for(const answer of answers){
 assert.ok(!/[.!?。！？]/.test(answer.text),answer.text)
 assert.ok(ranges.some(p=>p.id===answer.id),`Unreachable phrase: ${answer.text}`)
}
for(const sentence of sentences){
 const original=answers.find(a=>a.text===sentence.answer)
 assert.ok(canFill(sentence,original),sentence.id)
 assert.equal(composeSentence(sentence,original),sentence.text)
 assert.ok(sentence.accepts.length>=2,sentence.id)
 for(const answer of answers){
  if(canFill(sentence,answer)){
   assert.equal(composeSentence(sentence,answer),sentence.before+fillText(sentence,answer)+sentence.after)
   assert.ok(!/[.!?。！？]/.test(fillText(sentence,answer)))
  }
 }
}
const s=sentences[28]
assert.equal(composeSentence(s,answers.find(a=>a.text==='반려체의 신호')),'어느날부터 반려체의 신호가 보이지 않았다.')
assert.equal(canFill(s,answers.find(a=>a.text==='머물 수 있는 권리')),false)
assert.equal(composeSentence(sentences[37],answers.find(a=>a.text==='반려체')),'이 도시를 떠나야 한다는 통보를 받은 날, 당신은 혼자 집으로 돌아오다가 반려체를 보았다.')
for(let i=0;i<50;i++)assert.equal(new Set(shuffledSentences().map(s=>s.id)).size,54)
console.log('Passed: exact continuous transcript, 54 unique sentences, reachable curated phrases, accepts rules, no sentence punctuation in fills, original reconstruction and Korean particles')
