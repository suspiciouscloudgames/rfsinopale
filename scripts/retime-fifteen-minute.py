"""Time whole bilingual sentences at a natural pace, deriving the film duration."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'content/manifests/subtitle-timing-original.json').read_text())
path=ROOT/'assets/video/resonant-field-film/resonant_field_bilingual_timeline.json'
timeline=json.loads(path.read_text())
sentences=[]
for cue in timeline['subtitles']:
    if sentences and sentences[-1]['sentenceId']==cue['sentenceId']:
        for lang in ['tr','en']:sentences[-1][lang]+=' '+cue[lang]
    else:sentences.append({key:cue[key] for key in ['sentenceId','tr','en']})
original={}
for cue in base['cues']:
    span=original.setdefault(cue['sentenceId'],[cue['start'],cue['end']])
    span[1]=cue['end']
assert len(sentences)==len(original)==54
# Reading time comes first; the film duration follows the text, not a target runtime.
opening=4.0;gap=1.2;closing=8.0;rate=80;minimum=9;orientation=3
# Pause when the narration enters the personal story, the harbour, and the ending.
transitions={16,38,50}
t=opening
for index,s in enumerate(sentences):
    load=max(max(len(s[l].split()),len(s[l])/6.5) for l in ['tr','en'])
    duration=max(minimum,orientation+load*60/rate)
    s.update(id=s['sentenceId'],start=round(t,4),end=round(t+duration,4))
    next_id=sentences[index+1]['sentenceId'] if index+1<len(sentences) else None
    t+=duration+(2.5 if next_id in transitions else gap)
ending=next(s for s in sentences if original[s['sentenceId']][0]>=base['preserveEndingFrom'])
# Keep the last picture's existing breathing room, in addition to the separate jellyfish hold.
import math
duration=math.ceil(max(sentences[-1]['end']+closing,ending['start']+base['duration']-base['preserveEndingFrom'])*25)/25
points=[[0,0]]
for s in sentences:
    a,b=original[s['sentenceId']];points.extend([[a,s['start']],[b,s['end']]])
points.append([base['duration'],duration])
timeline.update(duration=duration,readingWordsPerMinute=rate,minimumCueSeconds=minimum,
                orientationSeconds=orientation,charactersPerReadingWord=6.5,sentenceGapSeconds=gap,transitionGapSeconds=2.5,transitionSentenceIds=sorted(transitions),subtitles=sentences)
path.write_text(json.dumps(timeline,ensure_ascii=False,indent=2)+'\n')
(ROOT/'content/manifests/picture-time-map.json').write_text(json.dumps({'points':points,'mode':'whole-sentence reading allocation'},indent=2)+'\n')
print(f"{len(sentences)} full sentences; {duration} seconds; reading range {min(s['end']-s['start'] for s in sentences):.1f}–{max(s['end']-s['start'] for s in sentences):.1f}s; ending span preserved")
