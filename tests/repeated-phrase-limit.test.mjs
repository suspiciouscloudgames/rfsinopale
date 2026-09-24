import assert from 'node:assert/strict'
import {getBlackoutLocale} from '../desktop/tablet/blackout-locales.js'
import {limitRepeatedRanges} from '../desktop/tablet/blackout-range-limits.js'
const flatten=parts=>parts.map(p=>p.children?flatten(p.children):p.text).join('')
for(const language of ['ko','en','tr']){
 const locale=getBlackoutLocale(language),counts=new Map()
 function walk(parts){for(const p of parts){if(p.id)counts.set(p.id,(counts.get(p.id)||0)+1);if(p.children)walk(p.children)}}
 walk(locale.passages)
 assert.equal(flatten(locale.passages).trim(),locale.transcript,'Never remove words from the original transcript')
 assert.equal(counts.size,94,'Every existing phrase type must remain discoverable')
 for(const [id,count] of counts)assert(count>=1&&count<=2,`${language}: ${id} found ${count} times`)
 assert.deepEqual(limitRepeatedRanges(locale.passages),locale.passages,'Limit is stable if applied again')
 console.log(language,`${counts.size} phrase types, ${[...counts.values()].reduce((a,b)=>a+b,0)} selectable occurrences, maximum ${Math.max(...counts.values())}`)
}
const input=[{id:'long',text:'abc',children:[{id:'word',text:'a'},{text:'bc'}]},{id:'word',text:'a'},{id:'word',text:'a'},{id:'word',text:'a'}]
const original=structuredClone(input),output=limitRepeatedRanges(input)
assert.deepEqual(input,original)
assert.equal(flatten(output),flatten(input))
assert.equal(output[0].id,'long','Longer phrase is kept when its nested word is removed')
assert(!output[0].children[0].id)
assert.equal(output[1].id,'word')
assert.equal(output.at(-1).id,'word','Retain distributed independent occurrences')
