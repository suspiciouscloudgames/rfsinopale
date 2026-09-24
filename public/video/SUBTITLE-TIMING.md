# Revised bilingual screening

The screening uses `resonant_field_bilingual_timeline.json`, generated with
`python3 scripts/build-screen-subtitles.py` from the supplied text in
`scripts/fixtures/screen-film-translations.txt`.

54 sentences become 100 paired subtitle cards. Turkish appears above English.
Each card receives at least 7 seconds, or the longer language's word count at
90 words per minute plus 2 seconds, whichever is longer. Short pauses separate
cards, sentences and paragraphs. The resulting timeline is 960.6 seconds
(16 minutes 0.6 seconds), excluding the audience poem ending.

The picture master is unchanged. The web player sets its speed from the actual
media duration divided by 960.6 (approximately 0.324×), and maps subtitle time
and tablet progress to that slower screening. The existing independent music
loop is unchanged. This is a web playback change, not a newly rendered MP4.

The old Korean timing JSON remains a reference for the original picture edit;
the current screening does not load it. Changes are local until published.

Validate with `node scripts/test-screen-subtitles.mjs`.
