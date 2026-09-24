#!/usr/bin/env python3
"""Link both artists' editing media without duplicating video data."""
from pathlib import Path
import hashlib, json, os, sys
ROOT = Path(__file__).resolve().parents[1]
AUTHOR = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else (ROOT/'assets/editing-originals/youngju' if (ROOT/'assets/editing-originals/youngju').exists() else ROOT.parent/'videos/rf-video')
VIDEO = {'.mp4','.mov','.m4v','.mkv','.webm'}
DEST = {'upper':ROOT/'assets/video/source-clips', 'floor':ROOT/'assets/floorVideos/source-clips'}
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(4*1024*1024),b''):h.update(block)
 return h.hexdigest()
def videos(folder):
 return sorted(p for p in folder.rglob('*') if p.is_file() and p.suffix.lower() in VIDEO)
groups = [
 ('upper','youngju',videos(AUTHOR/'clips')),
 ('floor','youngju',videos(AUTHOR/'floor-clips')),
 ('upper','hoyeon-main',[p for p in videos(ROOT/'assets/video/resonant-field-film') if not p.name.startswith('poiesis-')]),
 ('upper','hoyeon-trigger-source',[p for p in videos(ROOT/'assets/tiggerVideos') if 'web' not in p.relative_to(ROOT/'assets/tiggerVideos').parts]),
 ('upper','hoyeon-trigger-web',videos(ROOT/'assets/tiggerVideos/web')),
 ('floor','hoyeon-main',[p for p in (ROOT/'assets/floorVideos').iterdir() if p.is_file() and p.suffix.lower() in VIDEO and not p.name.startswith('poiesis-')]),
]
manifest=ROOT/'content/manifests/editing-media.json'
previous=json.loads(manifest.read_text()) if manifest.exists() else {'files':[]}
excluded=set(previous.get('excludedExistingCopies',[]))
excluded.update(row['file'] for row in previous['files'] if not (ROOT/row['file']).exists())
records=[]; missing=[]; hashes={}
for channel,label,files in groups:
 DEST[channel].mkdir(parents=True,exist_ok=True)
 for source in files:
  with source.open('rb') as f:header=f.read(120)
  if header.startswith(b'version https://git-lfs.github.com/spec/v1'):
   missing.append(str(source.relative_to(ROOT))); continue
  sha=digest(source); key=(channel,sha)
  target=hashes.get(key)
  if target is None:
   target=DEST[channel]/(label+'__'+source.name)
   if str(target.relative_to(ROOT)) in excluded:continue
   if target.exists() and digest(target)!=sha:
    target=target.with_name(target.stem+'__'+sha[:12]+target.suffix)
   if target.exists() and digest(target)!=sha:
    raise RuntimeError('Existing media differs: '+str(target))
   if not target.is_symlink() or target.resolve()!=source.resolve():
    # Verify existing copies before atomically replacing them with relative links.
    link=target.with_name(target.name+'.link-tmp')
    link.symlink_to(os.path.relpath(source.resolve(),target.parent))
    link.replace(target)
   if digest(target)!=sha:raise RuntimeError('Link verification failed: '+str(target))
   hashes[key]=target
  records.append({'channel':channel,'origin':label,'source':str(source.relative_to(ROOT)) if ROOT in source.parents else str(source.relative_to(ROOT.parent)),'file':str(target.relative_to(ROOT)),'bytes':source.stat().st_size,'sha256':sha})
manifest=ROOT/'content/manifests/editing-media.json'
manifest.write_text(json.dumps({'files':records,'pendingLfsFiles':missing,'excludedExistingCopies':sorted(excluded)},ensure_ascii=False,indent=2)+'\n')
for channel in DEST:
 selected=[r for r in records if r['channel']==channel]
 unique={r['file']:r['bytes'] for r in selected}
 print(channel+': '+str(len(unique))+' verified files, '+str(round(sum(unique.values())/1024**3,2))+' GiB from '+str(len(selected))+' inputs')
if missing:print('Still downloading: '+str(len(missing))+' LFS originals')
else:print('All source videos linked without duplicate storage; hashes match. Originals and playback paths unchanged.')
