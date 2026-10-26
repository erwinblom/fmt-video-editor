from runtime_config import TEMPLATE
#!/usr/bin/env python3
"""Local immutable FMT export: approved HyperFrames graphics + source recut."""
import os,sys,json,subprocess,shutil,time,re,math,wave,traceback,concurrent.futures
from pathlib import Path
from framing import clip_filter,picture_command
from card_transition import apply_card_transition,chapter_command
from auphonic_audio import process_audio
import numpy as np
from PIL import Image,ImageDraw,ImageFont
JOB=Path(sys.argv[1]).resolve(); ROOT=Path(__file__).resolve().parent.parent
T=TEMPLATE; A=T/'assets'
CONTEXT=json.loads((JOB/'export-context.json').read_text())
SOURCE=Path(CONTEXT['source'])
NODE=shutil.which('node') or str(Path.home()/'.local/bin/node'); HF=os.environ.get('FMT_HYPERFRAMES_CLI',str(ROOT/'node_modules/hyperframes/bin/hyperframes.mjs'))
FF=shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'; PROBE=shutil.which('ffprobe') or '/opt/homebrew/bin/ffprobe'
PLAN=json.loads((JOB/'plan.json').read_text()); FPS=25; SR=48000
STATUS=json.loads((JOB/'status.json').read_text()); STATUS['pid']=os.getpid()
VIDEO=JOB/STATUS['videoFile']; SUBTITLES=JOB/STATUS['subtitleFile']
def writejson(p,data):
 temp=p.with_suffix(p.suffix+'.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2));temp.replace(p)
def update(message,progress,**kw):
 STATUS.update(message=message,progress=progress,updatedAt=time.time(),**kw);writejson(JOB/'status.json',STATUS);print(message,flush=True)
def run(cmd,cwd=None):
 with open(JOB/'commands.log','a') as log:
  log.write('\n'+repr([str(x) for x in cmd])+'\n');log.flush();result=subprocess.run([str(x) for x in cmd],cwd=cwd,stdout=log,stderr=log)
 if result.returncode:
  tail=(JOB/'commands.log').read_text(errors='replace').strip().splitlines()[-1]
  raise RuntimeError(tail[:700]+' (details in exportlog)')
def hf(*args,cwd):run([NODE,HF,*args],cwd)
from caption_layout import FONT,clip_cues,srt
ENC=['-an','-c:v','libx264','-preset','veryfast','-crf','18','-profile:v','high','-pix_fmt','yuv420p','-threads','3','-g','50','-video_track_timescale','25000']
def main():
 if SOURCE.stat().st_size!=CONTEXT['sourceBytes'] or abs(SOURCE.stat().st_mtime_ns/1e6-CONTEXT['sourceModifiedMs'])>1:
  raise RuntimeError('Het bronbestand is gewijzigd sinds het starten. Start een nieuwe export.')
 update('Videokaarten voorbereiden',2,status='running')
 cfg={k:CONTEXT[k] for k in ['guest','organization','intro']};cfg['subjects']=PLAN['subjects'];cfg['style']=CONTEXT.get('style',{})
 writejson(JOB/'interview.json',cfg);graphics=JOB/'graphics'
 if not (graphics/'.fmt-graphics-ready').exists():
  if not (graphics/'package.json').exists():hf('init',str(graphics),'--non-interactive','--example=blank','--skill=general-video',cwd=JOB)
  # Template helper owns established design. Generate separately, then adopt into scaffold.
  generated=JOB/'template-graphics';shutil.rmtree(generated,ignore_errors=True);run([sys.executable,Path(__file__).with_name('make-cards.py'),'--config',JOB/'interview.json','--output',generated])
  for name in ['index.html','template.json','interview.json','graphics-plan.json']:shutil.copy2(generated/name,graphics/name)
  shutil.copytree(generated/'assets',graphics/'assets',dirs_exist_ok=True)
  html=(graphics/'index.html').read_text().replace('width:1920px;height:1080px','width:100%;height:100%');(graphics/'index.html').write_text(html)
  (graphics/'BRIEF.md').write_text('---\nworkflow: general-video\nflow: automation\nstoryboard: no\n---\n# FMT grafische onderdelenbank\nBestaande vastgestelde FMT-template; kaarten volgen exact de gebruikersselectie. Geen nieuwe stijl of inhoud. Bronmontage en ondertitels worden op één 25-fps tijdlijn samengevoegd.\n')
  (graphics/'.fmt-graphics-ready').write_text('1')
 hf('check','--json',cwd=graphics)
 hf('preview','--background','--port','4321',cwd=graphics)
 update('HyperFrames rendert intro, onderwerpkaarten en outro',6)
 hf('usage','--json',cwd=graphics)
 try:hf('render','--quality','looks','--fps','25','--output',str(graphics/'cards.mp4'),cwd=graphics)
 finally:hf('preview','--stop',cwd=graphics)
 update('Ondertitels verdelen en bronbeeld uitsnijden',12)
 catalog=json.loads((JOB/'catalog.json').read_text());allcues=[];clips=[e for e in PLAN['events'] if e['kind']=='clip']
 cue_dir=JOB/'captions';cue_dir.mkdir(exist_ok=True)
 # Each subtitle image occupies the fixed rail only.
 frame_overlay=JOB/'interview-frame.png'
 frame_image=Image.open(A/'interview-frame.png').convert('RGBA')
 if PLAN.get('subtitleLanguage','nl')!='nl':
  frame_draw=ImageDraw.Draw(frame_image);frame_draw.rectangle((30,976,110,1024),fill=(245,243,238,255))
  frame_draw.text((40,986),PLAN['subtitleLanguage'].upper(),font=ImageFont.truetype(str(A/'PaperMono-Regular.ttf'),24),fill='#0A0A0A')
 frame_image.save(frame_overlay)
 blank=Image.new('RGB',(1520,128),'#0A0A0A');ImageDraw.Draw(blank).rectangle((6,6,1513,121),fill='white');blank.save(cue_dir/'blank.png')
 for ci,e in enumerate(clips):
  cues=clip_cues(e,catalog);local=[]
  for j,cue in enumerate(cues):
   start,end=cue['start']-e['start'],cue['end']-e['start'];piece=cue['text']
   lines=cue['lines'];im=blank.copy();draw=ImageDraw.Draw(im)
   for k,line in enumerate(lines):
    bb=draw.textbbox((0,0),line,font=FONT);top=64+(k-(len(lines)-1)/2)*50-(bb[3]-bb[1])/2-bb[1];draw.text((760-draw.textlength(line,font=FONT)/2,top),line,font=FONT,fill='#0A0A0A')
   name=f'c{ci:03}-{j:03}.png';im.save(cue_dir/name);local.append((name,end-start));allcues.append({'start':e['start']+start,'end':e['start']+end,'text':piece,'lines':lines,'clipId':e['id'],'blockId':e['blockId']})
  if not local:local=[('blank.png',e['duration'])]
  concat='ffconcat version 1.0\n'+''.join(f"file '{name}'\nduration {d:.8f}\n" for name,d in local)+f"file '{local[-1][0]}'\n"
  (cue_dir/f'clip-{ci:03}.txt').write_text(concat);e['captionIndex']=ci
 writejson(JOB/'captions.json',allcues)
 SUBTITLES.write_text(srt(allcues))
 # No beauty treatment: preserve original skin tones and source detail.
 shots=JOB/'shots';shots.mkdir(exist_ok=True)
 if not CONTEXT['hasVideo']:
  panel=Image.new('RGB',(1920,1080),'#F5F3EE');draw=ImageDraw.Draw(panel)
  for text,top,maxsize in [(CONTEXT['guest'],340,90),(CONTEXT['title'],530,54)]:
   for size in range(maxsize,17,-2):
    font=ImageFont.truetype(str(A/'Inter-Bold.ttf'),size)
    words=text.split();lines=[];line=''
    for word in words:
     candidate=(line+' '+word).strip()
     if font.getlength(candidate)>1320 and line:lines.append(line);line=word
     else:line=candidate
    if line:lines.append(line)
    if len(lines)<=3 and all(font.getlength(line)<=1320 for line in lines):break
   for j,line in enumerate(lines):draw.text((960,top+j*size*1.2),line,font=font,anchor='mt',fill='#0A0A0A')
  panel.save(JOB/'audio-card.png')
 def encode_clip(pair):
  ci,e=pair;out=shots/f'clip-{ci:03}.mp4'
  if CONTEXT['hasVideo']:
   run(picture_command(FF,e,SOURCE,frame_overlay,cue_dir/f'clip-{ci:03}.txt',JOB/'elements',out,ENC))
  else:
   filt='[0:v]setsar=1,fps=25[base];[base][1:v]overlay=0:0[framed];[framed][2:v]overlay=200:916:repeatlast=1[out]'
   run([FF,'-v','error','-y','-loop','1','-framerate','25','-i',JOB/'audio-card.png','-i',frame_overlay,'-f','concat','-safe','0','-i',cue_dir/f'clip-{ci:03}.txt','-filter_complex_threads','1','-filter_complex',filt,'-map','[out]','-frames:v',str(e['frames']),*ENC,out])
  return ci
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for done,_ in enumerate(pool.map(encode_clip,enumerate(clips)),1):update(f'Interviewfragment {done}/{len(clips)} vormgegeven',12+round(62*done/len(clips)))
 update('Kaarten en bronfragmenten samenvoegen',76)
 playlist=[];ci=0
 for ei,e in enumerate(PLAN['events']):
  if e['kind']=='clip':out=shots/f'clip-{ci:03}.mp4';ci+=1
  else:
   out=shots/f'card-{ei:03}.mp4';run(chapter_command(FF,graphics/'cards.mp4',e,out,ENC))
  playlist.append(f"file '{out}'")
 for i in range(len(PLAN['events'])-1):
  a,b=PLAN['events'][i:i+2]
  if a['kind']=='clip' and b.get('pictureCut'):
   before,after=apply_card_transition(FF,shots/f"clip-{a['captionIndex']:03}.mp4",shots/f"card-{i+1:03}.mp4",a,b,SOURCE,frame_overlay,JOB/'elements',shots/f'boundary-{i}',ENC,run)
   playlist[i]=f"file '{before}'";playlist[i+1]=f"file '{after}'"
 (JOB/'video-concat.txt').write_text('\n'.join(playlist)+'\n')
 update('Lokale audiomix maken',80)
 run([FF,'-v','error','-y','-i',SOURCE,'-vn','-ac','2','-ar',str(SR),'-c:a','pcm_s16le',JOB/'source.wav'])
 def readwav(p):
  with wave.open(str(p)) as w:return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,w.getnchannels()).astype(np.float32)/32768
 source=readwav(JOB/'source.wav');N=round(PLAN['duration']*SR);mix=np.zeros((N,2),np.float32);beat=np.zeros((SR,2),np.float32);beat=np.repeat(beat,2,axis=1) if beat.shape[1]==1 else beat
 beat*=.538819/max(.0001,float(np.max(abs(beat))))
 events=PLAN['events'];music_events=[]
 for i,e in enumerate(events):
  dest=round(e['start']*SR);nn=round(e['duration']*SR)
  if e['kind']=='clip':
   part=source[round(e['sourceStart']*SR):round(e['sourceEnd']*SR)][:nn].copy();fade=min(round(PLAN.get('audio',{}).get('edgeFadeMs',5)/1000*SR),len(part)//2);part[:fade]*=np.linspace(0,1,fade)[:,None];part[-fade:]*=np.linspace(1,0,fade)[:,None];mix[dest:dest+len(part)]+=part
  else:
   nextclip=next((v for v in events[i+1:] if v['kind']=='clip'),None)
   # Duck already at the first speech boundary; no speech masking by a late beat.
   length=e['duration'] if e['kind']=='outro' or i+1>=len(events) or events[i+1]['kind']!='clip' else e['duration']+1.25
   length=min(length,(N-dest)/SR);count=round(length*SR);part=np.tile(beat,(math.ceil(count/len(beat)),1))[:count].copy();tt=np.arange(count)/SR;env=np.ones(count)
   if e['kind']=='outro':env=np.minimum(1,np.maximum(0,(length-tt)/.55))**1.4
   else:
    rel=e['duration'];mid=(tt>=rel-.14)&(tt<rel);env[mid]=1-.87*(tt[mid]-(rel-.14))/.14;tail=tt>=rel;env[tail]=.13*np.maximum(0,1-(tt[tail]-rel)/1.25)**1.5
   # Carve speech frequencies in the quiet overlap tail; original beat retained on cards.
   tail=tt>=e['duration']
   if np.any(tail):
    band=np.fft.rfft(part[tail],axis=0);freq=np.fft.rfftfreq(int(tail.sum()),1/SR);carve=1-.85*np.clip((freq-700)/700,0,1);part[tail]=np.fft.irfft(band*carve[:,None],n=int(tail.sum()),axis=0)
   part*=env[:,None];mix[dest:dest+count]+=part;music_events.append({'start':e['start'],'end':e['start']+length,'kind':e['kind']})
 del source
 peak=float(np.max(abs(mix)));gain=min(1,.94/max(.001,peak));mix*=gain
 with wave.open(str(JOB/'soundtrack.wav'),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(np.round(mix*32767).astype('<i2').tobytes())
 del mix
 writejson(JOB/'mix.json',{'peakBeforeMaster':peak,'masterGain':gain,'music':music_events,'speechFadeMs':PLAN.get('audio',{}).get('edgeFadeMs',5)})
 from optional_mastering import optional_mastering
 mastered, audio_receipt = optional_mastering(JOB/'soundtrack.wav', ROOT/'app/data/auphonic-cache', lambda message: update(message,86), process_audio)
 writejson(JOB/'auphonic.json',audio_receipt)
 update('MP4 en ondertitels afronden',90)
 run([FF,'-v','error','-y','-f','concat','-safe','0','-i',JOB/'video-concat.txt','-i',mastered,'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','volume=-0.3dB','-c:a','aac','-b:a','256k','-t',str(PLAN['duration']),'-movflags','+faststart',VIDEO])
 run([FF,'-v','error','-y','-ss','0.5','-i',VIDEO,'-frames:v','1','-vf','scale=960:-2','-q:v','3',JOB/'poster.jpg'])
 update('Volledige video controleren',95)
 probe=json.loads(subprocess.check_output([PROBE,'-v','error','-show_format','-show_streams','-of','json',str(VIDEO)]))
 v=next(s for s in probe['streams'] if s['codec_type']=='video');assert int(v['nb_frames'])==PLAN['frames'];assert abs(float(probe['format']['duration'])-PLAN['duration'])<.05
 run([FF,'-v','error','-i',VIDEO,'-f','null','-'])
 writejson(JOB/'qc.json',{'completeDecode':True,'frames':v['nb_frames'],'duration':probe['format']['duration'],'expectedDuration':PLAN['duration'],'fps':v['r_frame_rate'],'captions':len(allcues),'sourceRevision':PLAN['revision'],'mode':PLAN['mode'],'translationAudioHumanChecked':False,'captionTiming':'Explicit semantic source-word groups' if all(e.get('subtitleCues') for e in PLAN['events'] if e['kind']=='clip') else 'Automatic word weighting; editorial preview','quantization':PLAN['rounding']})
 update('Klaar — bekijk je video',100,status='complete',completedAt=time.time())
 # Keep immutable source selection, cues, graphics and output; intermediate video/audio is reproducible.
 for name in ['source.wav','soundtrack.wav']:(JOB/name).unlink(missing_ok=True)
 shutil.rmtree(shots);shutil.rmtree(JOB/'template-graphics',ignore_errors=True)
if __name__=='__main__':
 try:main()
 except Exception as e:
  traceback.print_exc();update('Export mislukt: '+str(e),STATUS.get('progress',0),status='failed');sys.exit(1)
