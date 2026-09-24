import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sentenceCues, createSubtitles} from '../desktop/renderer/subtitles.js';

const timeline = JSON.parse(readFileSync(new URL('../assets/video/resonant-field-film/resonant_field_bilingual_timeline.json', import.meta.url)));
const original = structuredClone(timeline.subtitles);
const sentences = sentenceCues(original);
assert.equal(sentences.length, 54);
assert.deepEqual(original, timeline.subtitles);
for (const lang of ['tr', 'en']) {
  assert.equal(sentences.map(c => c[lang]).join(' '), original.map(c => c[lang]).join(' '));
}
const tr = {}, en = {};
const savedFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => ({ok: true, json: async () => timeline});
  const update = await createSubtitles({querySelector: selector => selector === '#subtitle-tr' ? tr : en});
  for (const sentence of sentences) {
    const parts = original.filter(c => c.sentenceId === sentence.sentenceId);
    const times = parts.map(c => c.start);
    for (let i = 1; i < parts.length; i++) times.push((parts[i-1].end + parts[i].start) / 2);
    for (const time of times) {
      update(time);
      assert.equal(en.textContent, sentence.en);
      assert.equal(tr.textContent, sentence.tr);
    }
    update(sentence.end);
    assert.equal(en.textContent, '');
  }
  assert.equal(update.duration, timeline.duration);
} finally { globalThis.fetch = savedFetch; }
console.log('PASS 54 whole sentences, no mid-sentence blank or replacement, complete reading intervals and matching film duration');

assert.deepEqual(sentenceCues([{sentenceId:1,start:0,end:7,tr:'Bir',en:'One'},{sentenceId:1,start:7.2,end:15,tr:'cümle.',en:'sentence.'}]),[{sentenceId:1,start:0,end:15,tr:'Bir cümle.',en:'One sentence.'}]);
