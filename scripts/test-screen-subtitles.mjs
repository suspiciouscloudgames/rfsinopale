import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const supplied=read('scripts/fixtures/screen-film-translations.txt').split('\n').slice(1).join('\n').split('\t')
const timeline=JSON.parse(read('public/assets/video/resonant-field-film/resonant_field_bilingual_timeline.json'))
for(const [index,lang] of ['tr','en'].entries()){
 assert.equal(timeline.subtitles.map(c=>c[lang]).join(' '),supplied[index].replace(/\s+/g,' ').trim())
 const translated=JSON.parse(read(`public/assets/video/resonant-field-film/resonant_field_subtitles_${lang}.json`))
 assert.equal(translated.subtitles.length,54)
 assert.equal(translated.subtitles.map(c=>c.text).join(' '),supplied[index].replace(/\s+/g,' ').trim())
}
let end=0
for(const cue of timeline.subtitles){
 assert(cue.start>end);assert(cue.end-cue.start>=7-1e-6)
 assert(cue.end-cue.start>=Math.max(cue.tr.split(' ').length,cue.en.split(' ').length)*60/90+2-1e-6)
 end=cue.end
}
assert(timeline.duration>end)
assert.equal(new Set(timeline.subtitles.map(c=>c.sentenceId)).size,54)
console.log('PASS: exact revised bilingual text, 54 sentences, ordered non-overlapping cues, slow reading time and closing hold')
