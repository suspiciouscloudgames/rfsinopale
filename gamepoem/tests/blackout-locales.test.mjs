import assert from 'node:assert/strict'
import {getBlackoutLocale,composeInLocale} from '../site/blackout-locales.js'
import {translations} from '../site/blackout-translations.js'
const flatten=parts=>parts.flatMap(p=>[p,...flatten(p.children||[])])
for(const code of ['ko','tr','en']){
 const data=getBlackoutLocale(code),ranges=flatten(data.passages)
 assert.equal(data.sentences.length,54)
 assert.equal(data.passages.map(p=>p.text).join('').trim(),data.transcript)
 if(code!=='ko')assert.equal(data.transcript,translations[code].texts.join(' '))
 for(const a of data.answers)assert.ok(ranges.some(p=>p.id===a.id),`${code}: ${a.id} unreachable`)
 for(const s of data.sentences){
  const own=data.answers.find(a=>a.id===s.own||code==='ko'&&a.text===s.answer)
  assert.equal(composeInLocale(s,own),s.text,`${code}: ${s.id} original`)
  for(const id of s.accepts){
   const composed=composeInLocale(s,data.answerById.get(id))
   assert.ok(composed&&!composed.includes('undefined'))
   assert.ok(!/[.!?]/.test(s.forms[id]),`${code}: punctuation in ${s.id} ${id}`)
  }
 }
}
assert.equal(getBlackoutLocale('en').sentences[28].forms['blackout-phrase-50'],'the dog')
assert.equal(getBlackoutLocale('tr').sentences[37].forms['blackout-phrase-23'],'yoldaş varlık')
console.log('Passed: all three catalogs, supplied translation preservation, 54 original reconstructions per language, every candidate reachable, composed variants and punctuation boundaries')
