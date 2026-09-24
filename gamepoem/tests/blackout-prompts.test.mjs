import assert from 'node:assert/strict'
import {getPromptCatalog,shuffledPrompts} from '../site/blackout-prompts.js'
import {getBlackoutLocale,composeInLocale} from '../site/blackout-locales.js'
import {promptTexts,promptIndices} from '../site/blackout-prompt-texts.js'
for(const language of ['ko','en','tr']){
 const prompts=getPromptCatalog(language),locale=getBlackoutLocale(language)
 assert.equal(prompts.sentences.length,38)
 assert.equal(locale.sentences.length,54,'Full exploration catalog is unchanged')
 assert.deepEqual(prompts.sentences.map(s=>s.text),promptTexts[language].texts)
 for(const s of prompts.sentences){
  assert.ok(promptIndices.includes(Number(s.id.split('-').pop())))
  assert.equal(composeInLocale(s,locale.answerById.get(s.own)),s.text)
  for(const id of s.accepts){assert.ok(locale.answerById.has(id));assert.ok(!/[.!?]/.test(s.forms[id]));assert.ok(!composeInLocale(s,locale.answerById.get(id)).includes('undefined'))}
 }
}
for(let i=0;i<50;i++){const deck=shuffledPrompts();assert.equal(deck.length,38);assert.equal(new Set(deck.map(s=>s.id)).size,38);assert.ok(deck.every(s=>Number(s.id.split('-').pop())>=15))}
console.log('Passed: 38 unique supplied prompts in all languages, original reconstruction, valid fill variants, unchanged 54-sentence exploration catalogs')
