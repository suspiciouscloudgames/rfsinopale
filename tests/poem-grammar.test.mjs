import assert from 'node:assert/strict'
import {getBlackoutLocale,composeInLocale,turkishForm} from '../desktop/tablet/blackout-locales.js'
import {getPromptCatalog} from '../desktop/tablet/blackout-prompts.js'
const id=n=>`blackout-phrase-${n}`
function compose(lang,index,n){const s=getPromptCatalog(lang).byId.get(`blackout-s-${index}`);assert(s.accepts.includes(id(n)));return composeInLocale(s,getBlackoutLocale(lang).answerById.get(id(n)))}
for(const [n,kind,expected] of [[3,'acc','sakinliği'],[3,'gen','sakinliğin'],[5,'acc','açıklanamayan bir sinyali'],[7,'dat','köpeğin dinlendiği yerdeki sinyale'],[18,'acc','bağlılık, güven ve eski kayıpların yarattığı duyguları'],[46,'gen','eski kayıpların yarattığı duyguların'],[33,'acc','ismi'],[41,'gen','senin ona verdiğin ismin'],[34,'loc','kişilik, ruh hâlinde'],[61,'gen','neyin']])assert.equal(turkishForm(getBlackoutLocale('tr').answerById.get(id(n)).text,n,kind),expected)
assert.match(compose('tr',24,53),/güvenden mi doğduğunu/)
assert.match(compose('tr',24,74),/yağmurdan mı doğduğunu/)
assert.match(compose('tr',37,40),/köpeğin yüzünü gördün/)
assert.match(compose('tr',37,92),/bir başkasını gördün/)
assert.match(compose('tr',44,13),/kendi evlerinin ve sık sık bulundukları yerlerin içinden/)
assert.equal(compose('en',29,4),'None of your feelings knew where it had gone.')
assert.equal(compose('en',29,5),'No unexplained signal knew where it had gone.')
assert.equal(compose('en',29,22),'None of these unknown beings knew where it had gone.')
assert.equal(compose('en',29,92),'No one else knew where it had gone.')
assert.equal(compose('en',29,30),'No day knew where it had gone.')
assert.equal(compose('en',50,80),'People realized that waves were never entirely empty.')
assert.equal(compose('en',50,72),'People realized that light was never entirely empty.')
assert.equal(compose('en',32,34),'Personality and mood were always composed, peaceful, and gentle.')
let count=0
for(const lang of ['en','tr'])for(const s of getPromptCatalog(lang).sentences){
 assert.equal(composeInLocale(s,getBlackoutLocale(lang).answerById.get(s.own)),s.text,'Keep supplied original sentence intact')
 for(const answer of getBlackoutLocale(lang).answers.filter(a=>s.accepts.includes(a.id))){
  const result=composeInLocale(s,answer);assert(!/undefined|null/.test(result));
  if(lang==='en')assert(!/\bno (?:your|their|these|those|an)\b/i.test(result),result)
  count++
 }
}
console.log(`PASS ${count} accepted English/Turkish combinations, original reconstruction and case/negation regressions`)
