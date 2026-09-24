import assert from 'node:assert/strict'
import {passages,fragments} from '../site/content.js'
import {directionAt,isEmission,pilePosition} from '../site/interaction.js'
const normalize=s=>s.replace(/\s+/g,' ').trim()
for(const sentence of passages.flat())assert.equal(normalize(fragments.filter(f=>f.sentence===sentence.id).map(f=>f.text).join(' ')),normalize(sentence.text))
assert.equal(new Set(fragments.map(f=>f.id)).size,fragments.length)
assert.ok(fragments.every(f=>f.text.length<=22),'phrases should remain short')
assert.equal(directionAt(.5,.05),'up');assert.equal(directionAt(.5,.95),'down');assert.equal(directionAt(.05,.5),'left');assert.equal(directionAt(.95,.5),'right');assert.equal(directionAt(.5,.5),null)
assert.equal(isEmission({active:true,direction:'up',sentAt:1000},10000),true)
assert.equal(isEmission({active:true,direction:'bad',sentAt:1000},10000),false)
assert.equal(isEmission({active:true,direction:'up',sentAt:1000},19001),false)
fragments.forEach((f,i)=>{const p=pilePosition(i);assert.ok(p.x>.15&&p.x<.85&&p.y>.35&&p.y<.9)})
console.log(`Passed: ${fragments.length} phrases preserve all original text, stable IDs, four edge directions, effect expiry and pile bounds`)
