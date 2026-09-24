"""Build a slow bilingual screening timeline from the artist's exact revised text."""
import json, math, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'scripts/fixtures/screen-film-translations.txt').read_text()
columns=source.split('\n',1)[1].split('\t')
def sentences(text):
    return [s.strip() for s in re.findall(r'.*?[.!?][”"]?(?=\s|$)',re.sub(r'\s+',' ',text).strip())]
texts=[sentences(t) for t in columns]
assert all(len(t)==54 for t in texts)
def split(text,count):
    words=text.split();parts=[];offset=0
    for part in range(count-1):
        target=len(' '.join(words[offset:]))/(count-part)
        end=min(range(offset+1,len(words)-(count-part-1)+1),key=lambda end:abs(len(' '.join(words[offset:end]))-target)-(target*.12 if re.search(r'[,;:!?]$',words[end-1]) else 0))
        parts.append(' '.join(words[offset:end]));offset=end
    parts.append(' '.join(words[offset:]));return parts
clock=6.;cues=[];paragraph_ends={7,14,21,27,36,41,48,53}
for i,(tr,en) in enumerate(zip(*texts)):
    count=1
    while True:
        a,b=split(tr,count),split(en,count)
        if max(map(len,a+b))<=76:break
        count+=1
    for j,(t,e) in enumerate(zip(a,b)):
        # 90 words/minute in the longer language, two seconds to settle, minimum 7s.
        hold=max(7,math.ceil(max(len(t.split()),len(e.split()))*60/90+2),math.ceil(max(len(t),len(e))/12+2))
        cues.append(dict(id=len(cues)+1,sentenceId=i+1,start=round(clock,2),end=round(clock+hold,2),tr=t,en=e))
        clock+=hold+(0.6 if j<len(a)-1 else 3 if i in paragraph_ends else 1.5)
clock=round(clock+5,2)
base=ROOT/'public/assets/video/resonant-field-film'
data=dict(duration=clock,readingWordsPerMinute=90,minimumCueSeconds=7,subtitles=cues)
(base/'resonant_field_bilingual_timeline.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
for lang,lines in zip(['tr','en'],texts):
    (base/f'resonant_field_subtitles_{lang}.json').write_text(json.dumps(dict(language=lang,subtitles=[dict(id=i+1,text=t) for i,t in enumerate(lines)]),ensure_ascii=False,indent=2)+'\n')
for lang,column in zip(['tr','en'],columns):
    assert ' '.join(c[lang] for c in cues)==re.sub(r'\s+',' ',column).strip()
print(f'{len(cues)} bilingual cards; {clock:.1f}s = {int(clock//60)}m {clock%60:.1f}s; holds {min(c["end"]-c["start"] for c in cues):.0f}–{max(c["end"]-c["start"] for c in cues):.0f}s')
