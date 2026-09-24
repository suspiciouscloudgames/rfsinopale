import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {getBlackoutLocale} from '../desktop/tablet/blackout-locales.js'
import {translations} from '../desktop/tablet/blackout-translations.js'
const supplied=readFileSync(new URL('./fixtures/revised-film-translations.txt',import.meta.url),'utf8')
const columns=supplied.slice(supplied.indexOf('\n')+1).split('\t')
for(const [i,lang] of ['tr','en'].entries()){
 const expected=columns[i].replace(/\s+/g,' ').trim()
 assert.equal(getBlackoutLocale(lang).transcript,expected,`${lang}: exact supplied text, continuous paragraphs`)
 for(const [index,text] of translations[lang].texts.entries())assert.ok(text.includes(translations[lang].slots[index]),`${lang}: slot ${index} must exist in revised sentence`)
}
console.log('Passed: exact revised attachment in both languages, continuous transcript, valid slot boundaries')
