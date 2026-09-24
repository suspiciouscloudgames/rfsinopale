"""Render the EDL as clean, synchronized masters with real cross-dissolves."""
from pathlib import Path
import json,subprocess,concurrent.futures,hashlib,os,time,argparse
ROOT=Path(__file__).resolve().parents[1]
FF=os.environ.get('FFMPEG','/private/tmp/gamepoem-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1')
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--channel',choices=['upper','floor'],help='Render only the changed channel')
options=parser.parse_args()
plan=json.loads((ROOT/'content/manifests/picture-edit-v1.json').read_text());FPS=plan['fps']
WORK=ROOT/'output/editing/render-v1';WORK.mkdir(parents=True,exist_ok=True)
BASE=[FF,'-hide_banner','-loglevel','error','-nostdin','-threads','2']
ENC=['-an','-c:v','h264_videotoolbox','-b:v','14M','-allow_sw','1','-pix_fmt','yuv420p','-r',str(FPS),'-g','50','-video_track_timescale','25000','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-map_metadata','-1','-movflags','+faststart']
def run(args,dest,frames=None):
 inputs=[Path(args[i+1]) for i,value in enumerate(args[:-1]) if value=='-i']
 key=hashlib.sha256(json.dumps({'args':args,'encoder':ENC,'inputs':[(str(p),p.stat().st_size,p.stat().st_mtime_ns) for p in inputs]}).encode()).hexdigest();stamp=dest.with_suffix('.sha')
 if dest.exists() and stamp.exists() and stamp.read_text()==key:return
 temp=dest.with_name(dest.stem+'.rendering.mp4')
 result=subprocess.run(BASE+args+ENC+(['-frames:v',str(frames)] if frames else [])+['-y',str(temp)],capture_output=True,text=True)
 if result.returncode:raise RuntimeError(dest.name+'\n'+result.stderr)
 temp.replace(dest);stamp.write_text(key)
def normal(task):
 channel,i,s=task;dest=WORK/(channel+'-shot-%02d.mp4'%i)
 factor=(s['renderFrames']/FPS)/(s['sourceOut']-s['sourceIn'])
 # Preserve individual frames during slow playback; no temporal blending.
 vf='setpts=%.9f*(PTS-STARTPTS),scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,fps=%d,eq=contrast=1.04,format=yuv420p,tpad=stop_mode=clone:stop_duration=1'%(factor,FPS)
 run(['-ss',str(s['sourceIn']),'-t',str(s['sourceOut']-s['sourceIn']),'-i',str(ROOT/s['source']),'-vf',vf],dest,s['renderFrames'])
 print('normalized',channel,i+1,flush=True)
 return dest
for channel in ([options.channel] if options.channel else ['upper','floor']):
 shots=plan[channel];tasks=[(channel,i,s) for i,s in enumerate(shots)]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:normalized=list(ex.map(normal,tasks))
 jobs=[];pieces=[]
 for i,s in enumerate(shots):
  body_frames=s['renderFrames']-s['fadeInFrames']-s['fadeOutFrames'];assert body_frames>0
  dest=WORK/(channel+'-piece-%03d.mp4'%(i*2));pieces.append(dest)
  vf='setpts=PTS-STARTPTS'
  if i==0:vf+=',fade=t=in:st=0:d=3'
  jobs.append((['-ss',str(s['fadeInFrames']/FPS),'-i',str(normalized[i]),'-vf',vf],dest,body_frames))
  if i<len(shots)-1:
   duration=s['fadeOutFrames']/FPS;dest=WORK/(channel+'-piece-%03d.mp4'%(i*2+1));pieces.append(dest)
   graph='[0:v]setpts=PTS-STARTPTS,fps=%d,format=yuv420p[a];[1:v]setpts=PTS-STARTPTS,fps=%d,format=yuv420p[b];[a][b]xfade=transition=fade:duration=%.4f:offset=0,format=yuv420p[v]'%(FPS,FPS,duration)
   jobs.append((['-ss',str((s['renderFrames']-s['fadeOutFrames'])/FPS),'-t',str(duration),'-i',str(normalized[i]),'-t',str(duration),'-i',str(normalized[i+1]),'-filter_complex_threads','2','-filter_complex',graph,'-map','[v]'],dest,s['fadeOutFrames']))
 def piece(job):
  run(*job);print('composited',job[1].name,flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:list(ex.map(piece,jobs))
 concat=WORK/(channel+'-concat.txt');concat.write_text(''.join("file '"+str(p).replace("'","'\\''")+"'\n" for p in pieces))
 dest=ROOT/('assets/video/resonant-field-film/poiesis-upper-v1.mp4' if channel=='upper' else 'assets/floorVideos/poiesis-floor-v1.mp4')
 temp=dest.with_name(dest.stem+'.rendering.mp4')
 subprocess.run(BASE+['-f','concat','-safe','0','-i',str(concat),'-map','0:v:0','-c','copy','-an','-map_metadata','-1','-movflags','+faststart','-y',str(temp)],check=True)
 temp.replace(dest)
 print('MASTER COMPLETE',channel,str(dest),flush=True)
print('Requested picture masters rendered. Subtitles and soundtrack remain separate.',flush=True)
