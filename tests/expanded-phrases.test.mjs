import assert from 'node:assert/strict'
import {getBlackoutLocale,composeInLocale} from '../desktop/tablet/blackout-locales.js'
import {getPromptCatalog} from '../desktop/tablet/blackout-prompts.js'
const ko=getBlackoutLocale('ko')
const id=text=>ko.answers.find(a=>a.text===text).id
function compose(lang,index,text){const locale=getBlackoutLocale(lang),s=getPromptCatalog(lang).byId.get(`blackout-s-${index}`),answer=locale.answerById.get(id(text));assert(s.accepts.includes(answer.id));return composeInLocale(s,answer)}
assert.equal(ko.answers.length,94)
assert.equal(id('반려체'),'blackout-phrase-23','Published poems retain stable IDs')
assert.equal(id('미지의 존재들'),'blackout-phrase-22')
assert.equal(compose('ko',32,'파도'),'그곳의 파도는 늘 침착하고 평온하고 다정했다.')
assert.equal(compose('ko',20,'빛'),'누군가 놓아둔 물그릇 곁에 빛을 내려놓았다.')
assert.equal(compose('en',32,'파도'),'Waves were always composed, peaceful, and gentle.')
assert.equal(compose('en',32,'빛'),'Light was always composed, peaceful, and gentle.')
assert.equal(compose('en',19,'흔적'),'Among the many names people called the same dog were traces.')
assert.equal(compose('tr',20,'빛'),'Işığı, birinin bıraktığı su kabının yanına koydun.')
assert.equal(compose('tr',20,'꼬리'),'Kuyruğu, birinin bıraktığı su kabının yanına koydun.')
assert.equal(compose('tr',20,'다른 이'),'Bir başkasını, birinin bıraktığı su kabının yanına koydun.')
for(const lang of ['ko','en','tr']){
 const locale=getBlackoutLocale(lang),seen=new Set();function walk(xs){for(const p of xs){if(p.id)seen.add(p.id);if(p.children)walk(p.children)}}walk(locale.passages)
 for(const a of locale.answers)assert(seen.has(a.id),`${lang}: ${a.text} must be selectable in the actual transcript`)
 for(const source of [16,30,44])assert(!getPromptCatalog(lang).byId.get(`blackout-s-${source}`).accepts.includes(id('어느날')),'Do not put time phrases in place slots')
 assert(!getPromptCatalog(lang).byId.get('blackout-s-20').accepts.includes(id('무엇')),'An interrogative is not a standalone object')
 assert(getPromptCatalog(lang).byId.get('blackout-s-23').accepts.includes(id('비')),'Allow sensory metaphor in feeling slots')
}
console.log('PASS 22 new reachable phrases in all 3 languages, published IDs, poetic metaphor, case and number agreement, incompatible slot exclusions')
