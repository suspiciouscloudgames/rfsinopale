"""Build the projection edit from visually reviewed, legible source ranges."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1];FPS=25
source=json.loads((ROOT/'content/manifests/media-inspection.json').read_text())
durations={x['file']:x['duration'] for x in source}
timeline=json.loads((ROOT/'assets/video/resonant-field-film/resonant_field_bilingual_timeline.json').read_text())
cues=timeline['subtitles'];TOTAL=round(timeline['duration']*FPS)
original_cues=json.loads((ROOT/'content/manifests/subtitle-timing-original.json').read_text())['cues']
time_points=json.loads((ROOT/'content/manifests/picture-time-map.json').read_text())['points']
def retime(t):
 for (a,x),(b,y) in zip(time_points,time_points[1:]):
  if a<=t<=b:return x+(t-a)/(b-a)*(y-x)
 raise ValueError(t)
frame=lambda t:round(t*FPS)
a=lambda n:'assets/floorVideos/source-clips/youngju__IMG_'+n+('.mp4' if n=='4755' else '.MP4')
h=lambda n:'assets/video/source-clips/hoyeon-trigger-source__IMG_'+n+'.MOV'
city='assets/video/source-clips/hoyeon-trigger-web__IMG_4886.mp4'
walk='assets/video/source-clips/hoyeon-main__resonant_field_picture_01.mp4'
sea='assets/floorVideos/source-clips/hoyeon-main__floor.mp4'
# Return lower-saturation author footage rather than repeating sharper scenes.
# Keep defocused/smeared clips 3, 4, 5, 8, 13 out; numbered clips retain their original order.
author_names=[str(n) for n in [1,2,6,7,9,10,11,12,14,16,17]]+['c']
author_files=['assets/video/source-clips/youngju__'+n+'.mp4' for n in author_names]
weights=[durations[file]-.28 for file in author_files]
gaps=[(a['end']+b['start'])/2 for a,b in zip(original_cues,original_cues[1:]) if b['start']<310]
bounds=[0.];elapsed=0
for weight in weights[:-1]:
 elapsed+=weight;ideal=314.9*elapsed/sum(weights)
 close=[gap for gap in gaps if abs(gap-ideal)<=1.5 and gap>bounds[-1]+4]
 bounds.append(min(close,key=lambda gap:abs(gap-ideal)) if close else ideal)
bounds.append(314.9)
upper_ranges=[(bounds[i],bounds[i+1],file,.12,durations[file]-.16,'Author sequence '+author_names[i]+'; used once, original color retained') for i,file in enumerate(author_files)]
upper_ranges += [
 (314.9,351.1,city,1,34,'Arrival: one stable waterfront gathering'),
 (351.1,454.3,walk,146,235,'First unique street section: encounters and attachment'),
 (454.3,518.2,walk,275,325,'Unique street section before holding-form sentence'),
 (518.2,535.9,'assets/video/source-clips/youngju__IMG_5388.MOV',2,18.7,'Fish bucket with the sentence about holding in a recognizable form; used once'),
 (535.9,672.4,walk,341,449,'Return to later unique street section after the short fish insert'),
 (672.4,723.5,h('4869'),1,40,'Harbor: original water footage, first and only use'),
 (723.5,775.8,h('4872'),1,39,'Second distinct harbor view, used once'),
 (775.8,813.0,'assets/video/source-clips/youngju__IMG_5611.mov',3,29.7,'Everyday Sinop street beneath borders and the right to stay; no literal dog-caption pairing'),
 (813.0,865.9,h('4890'),77,118,'Continue toward the lit waterfront after the street; unique later source section'),
 (865.9,899,h('4891'),99,119,'Only the visible colored-light ending of this source'),
 (899,960.6,'assets/video/source-clips/youngju__g.mp4',.2,37.5,'Author sunset, first and only use; preserved jellyfish ending'),
]
upper_ranges=[(retime(start),retime(end),file,si,so,note) for start,end,file,si,so,note in upper_ranges]
# Dedicated floor media only. Every source interval is used once, including
# three consecutive, disjoint sections of Hoyeon's long water master.
floor_sources=[
 (a('4748'),.2,31,'Blue sky opening'),
 (a('5191'),.3,32.2,'Colored reflection'),
 (sea,0,110,'Water master, first section'),
 (a('5369'),.3,61.8,'Colored harbor lights'),
 (sea,110,225,'Water master, second section'),
 (a('5379'),.3,62.6,'Green water'),
 (a('5394'),.3,39.6,'Shallows'),
 (sea,225,348.4,'Water master, final section'),
]
floor_ranges=[];elapsed=0;total=sum(so-si for _,si,so,_ in floor_sources)
for i,(file,si,so,note) in enumerate(floor_sources):
 start=elapsed/total*timeline['duration'];elapsed+=so-si
 end=timeline['duration'] if i==len(floor_sources)-1 else elapsed/total*timeline['duration']
 floor_ranges.append((start,end,file,si,so,note+'; unique source interval'))
def build(ranges,fade):
 shots=[]
 for start,end,file,si,so,note in ranges:
  assert (ROOT/file).is_file(),file
  assert 0<=si<so<=durations[file],(file,si,so)
  shots.append(dict(startFrame=frame(start),endFrame=frame(end),source=file,sourceIn=si,sourceOut=so,note=note))
 assert shots[0]['startFrame']==0 and shots[-1]['endFrame']==TOTAL
 for i,s in enumerate(shots):
  if i:assert s['startFrame']==shots[i-1]['endFrame']
  s['fadeInFrames']=frame(fade) if i else 0;s['fadeOutFrames']=frame(fade) if i<len(shots)-1 else 0
  s['renderFrames']=s['endFrame']-s['startFrame']+(s['fadeInFrames']+s['fadeOutFrames'])//2
  s['speed']=(s['sourceOut']-s['sourceIn'])/(s['renderFrames']/FPS)
  assert .5<=s['speed']<=1.08,s
  s['sentenceIds']=sorted({c['sentenceId'] for c in cues if frame(c['start'])<s['endFrame'] and frame(c['end'])>s['startFrame']})
 return shots
plan=dict(version=2,fps=FPS,width=1920,height=1080,duration=timeline['duration'],totalFrames=TOTAL,upper=build(upper_ranges,1.2),floor=build(floor_ranges,2.4),
 subtitleFile='assets/video/resonant-field-film/resonant_field_bilingual_timeline.json',audio='assets/audio/stuck-final.mp3',audioMode='Separate original-speed looping soundtrack; picture masters have no audio or burned subtitles',
 rendering={'frameInterpolation':'none; duplicate/drop frames at 25fps','saturation':1,'gamma':1,'contrast':1.04,'scale':'lanczos'},
 excludedAuthorFiles=['15.mp4','a.mp4','b.mp4','d.mp4','e.mp4','f.mp4'],
 projectionSelection={'restoredLowSaturationAuthorClips':author_names,'excludedBlurredAuthorClips':['3.mp4','4.mp4','5.mp4','8.mp4','13.mp4'],'omittedStreetRange':[235,275],'noRepeatedSourceIntervals':True,'noCrossChannelSourceReuse':True,'review':'Restore lower-saturation originals instead of repeating colorful footage. No temporal frame blending.'})
# Resolve source links so aliases cannot conceal repeated footage.
intervals={};channels={}
for channel in ['upper','floor']:
 for shot in plan[channel]:
  key=str((ROOT/shot['source']).resolve())
  assert key not in channels or channels[key]==channel,('Cross-channel reuse',key)
  channels[key]=channel
  for si,so in intervals.get(key,[]):
   assert shot['sourceOut']<=si or shot['sourceIn']>=so,('Repeated source interval',key)
  intervals.setdefault(key,[]).append((shot['sourceIn'],shot['sourceOut']))

(ROOT/'content/manifests/picture-edit-v1.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
print('Plan:',len(plan['upper']),'upper;',len(plan['floor']),'floor;',TOTAL,'frames each')
print('Speed ranges:',[(n,round(min(s['speed'] for s in plan[n]),2),round(max(s['speed'] for s in plan[n]),2)) for n in ['upper','floor']])
