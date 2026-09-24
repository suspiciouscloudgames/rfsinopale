import {attachParticle,composeSentence} from '../site/korean-particles.js'
import assert from 'node:assert/strict'
import {fragments,fragmentById as byId} from '../site/puzzle-content.js'
const sentences=fragments.filter(p=>p.kind==='sentence')
assert.equal(sentences.length,12)
assert.equal(fragments.length,24)
for(const sentence of sentences){
 assert.equal(composeSentence(sentence,byId.get(sentence.mate)),sentence.text)
 assert.ok(!/^[가-힣]/.test(sentence.after))
 const alternatives=sentence.accepts.map(id=>byId.get(id))
 assert.ok(new Set(alternatives.map(p=>p.text)).size>=2)
 assert.ok(alternatives.every(a=>a.kind==='answer'&&a.group===sentence.group))
 assert.ok(sentence.accepts.includes(sentence.mate))
}
assert.ok(!byId.get('sentence-17').accepts.includes('answer-25')) // cannot maintain "much comfort"
assert.ok(!byId.get('sentence-21').accepts.includes('answer-17')) // cannot remain "a peaceful heart [object]"
assert.ok(byId.get('sentence-21').accepts.includes('answer-14'))
assert.equal(composeSentence(byId.get('sentence-21'),byId.get('answer-14')),'개가 죽은 뒤에도 그 반려체는 그 나무 아래에 남아 있었습니다.')
console.log('Passed: 12 contextual blanks, exact source text, attached particles, multiple distinct alternatives, incompatible meanings excluded')

assert.equal(attachParticle('바다','을/를'),'바다를')
assert.equal(attachParticle('마음','을/를'),'마음을')
assert.equal(attachParticle('감응장','이/가'),'감응장이')
assert.equal(attachParticle('그 반려체','이/가'),'그 반려체가')
assert.equal(attachParticle('바다','으로/로'),'바다로')
assert.equal(attachParticle('마음','으로/로'),'마음으로')
assert.equal(attachParticle('물','으로/로'),'물로')
assert.equal(composeSentence(byId.get('sentence-13'),byId.get('answer-21')), '그런데 그 반려체가 같은 자리에만 머물고 있어서, 점점 반려체를 보면서 개의 상태를 짐작하곤 했습니다.')
assert.equal(composeSentence(byId.get('sentence-18'),byId.get('answer-25')), '화가 나거나 너무 슬픈 날에는 그곳에 가까이 가기 전에 많은 위로를 다른 곳에다 두고 오는 연습을 했습니다.')
for(const sentence of sentences)for(const id of sentence.accepts){
 const result=composeSentence(sentence,byId.get(id))
 assert.ok(result.startsWith(sentence.before)&&result.endsWith(sentence.after))
 assert.ok(!result.includes('undefined'))
}
assert.equal(composeSentence({before:'',after:'',particle:'이/가',forms:{custom:'예외 형태'}},{id:'custom',text:'ABC'}),'예외 형태')
console.log('Passed: authored particles, consonant/vowel/rieul cases, all accepted combinations and overrides')
