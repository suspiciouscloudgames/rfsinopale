"""Shorten silent subtitle gaps, preserving every reading duration and the ending."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
base = json.loads((ROOT/'content/manifests/subtitle-timing-original.json').read_text())
path = ROOT/'assets/video/resonant-field-film/resonant_field_bilingual_timeline.json'
timeline = json.loads(path.read_text())
cut = base['preserveEndingFrom']
saved = base['duration'] - base['targetDuration']
visible = sum(c['end']-c['start'] for c in base['cues'] if c['end'] <= cut)
gap_scale = (cut-visible-saved)/(cut-visible)
assert 0 < gap_scale < 1
points = [[0, 0]]
old = new = 0
for cue in base['cues']:
    start, end = cue['start'], cue['end']
    if start >= cut:
        points.extend([[start, start-saved], [end, end-saved]])
        continue
    new += (start-old)*gap_scale
    points.append([start, new])
    new += end-start
    points.append([end, new])
    old = end
points.append([base['duration'], base['targetDuration']])
mapping = dict(points)
assert [c['id'] for c in timeline['subtitles']] == [c['id'] for c in base['cues']]
for cue, original in zip(timeline['subtitles'], base['cues']):
    cue['start'] = round(mapping[original['start']], 4)
    cue['end'] = round(mapping[original['end']], 4)
    assert abs(cue['end']-cue['start']-(original['end']-original['start'])) < .001
timeline['duration'] = base['targetDuration']
path.write_text(json.dumps(timeline, ensure_ascii=False, indent=2)+'\n')
(ROOT/'content/manifests/picture-time-map.json').write_text(json.dumps({'points':points,'gapScale':gap_scale}, indent=2)+'\n')
print(f"{base['targetDuration']} seconds; all subtitle reading durations and final 61.6 seconds preserved")
