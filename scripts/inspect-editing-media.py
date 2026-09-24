from pathlib import Path
import json,re,subprocess,concurrent.futures
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/editing';OUT.mkdir(parents=True,exist_ok=True)
FF='/private/tmp/gamepoem-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
rows=json.loads((ROOT/'content/manifests/editing-media.json').read_text())['files']
rows=list({r['file']:r for r in rows if (ROOT/r['file']).exists()}.values())
def inspect(r):
 p=ROOT/r['file'];result=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True).stderr
 m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',result)
 if not m:raise RuntimeError(str(p)+'\n'+result)
 duration=int(m[1])*3600+int(m[2])*60+float(m[3]);r['duration']=duration
 r['streamInfo']='\n'.join(l.strip() for l in result.splitlines() if 'Video:' in l or 'rotation of' in l)
 r['thumbs']=[]
 for n,f in enumerate([.15,.55]):
  dest=OUT/(p.stem+'-'+str(n)+'.jpg')
  subprocess.run([FF,'-hide_banner','-loglevel','error','-ss',str(duration*f),'-i',str(p),'-frames:v','1','-vf','scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2','-q:v','3','-y',str(dest)],check=True)
  r['thumbs'].append(str(dest))
 return r
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(inspect,rows))
(OUT/'media-inspection.json').write_text(json.dumps(rows,indent=2))
for start in range(0,len(rows),8):
 part=rows[start:start+8];sheet=Image.new('RGB',(660,220*len(part)),(22,22,22));draw=ImageDraw.Draw(sheet)
 for i,r in enumerate(part):
  draw.text((10,i*220+4),Path(r['file']).name+'   '+str(r['duration'])+'s',fill='white')
  for j,p in enumerate(r['thumbs']):sheet.paste(Image.open(p),(10+j*325,i*220+25))
 sheet.save(OUT/('contact-'+str(start//8)+'.jpg'))
print('Inspected',len(rows),'videos')
