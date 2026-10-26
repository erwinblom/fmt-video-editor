import sys,json,subprocess,tempfile,shutil
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from card_transition import apply_card_transition
from runtime_config import TEMPLATE
ff=sys.argv[1];probe=sys.argv[2]
def run(args):
 p=subprocess.run([str(x) for x in args],capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr.decode()[-2000:])
 return p.stdout
encoder=['-an','-c:v','libx264','-preset','ultrafast','-crf','18','-threads','2','-pix_fmt','yuv420p']
def pixel(file,frame,x,y):
 data=run([ff,'-v','error','-i',file,'-vf',f"select=eq(n\\,{frame}),format=rgb24,crop=1:1:{x}:{y}",'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'])
 assert len(data)==3;return list(data)
with tempfile.TemporaryDirectory(prefix='fmt-card-cut-') as d:
 d=Path(d);source=d/'source.mp4';clip=d/'clip.mp4';card=d/'card.mp4'
 run([ff,'-v','error','-y','-f','lavfi','-i','testsrc2=size=320x180:rate=25:duration=5',*encoder,source])
 run([ff,'-v','error','-y','-f','lavfi','-i','color=c=red:s=1920x1080:r=25:d=2','-vf','drawbox=x=0:y=916:w=1920:h=164:color=blue:t=fill',*encoder,clip])
 run([ff,'-v','error','-y','-f','lavfi','-i','color=c=0x00FF00:s=1920x1080:r=25:d=3',*encoder,card])
 a={'frames':50,'duration':2,'sourceStart':1,'sourceEnd':3,'framing':{'source':{'width':320,'height':180},'crop':{'x':0,'y':0,'width':320,'height':180},'fullFrame':True}}
 for shift in [-6,6]:
  b={'frames':75,'pictureCut':{'frames':shift}};x,y=apply_card_transition(ff,clip,card,a,b,source,TEMPLATE/'assets/interview-frame.png',d,d/str(shift),encoder,run)
  for file,expected in [(x,50),(y,75)]:
   meta=json.loads(run([probe,'-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','json',file]));assert int(meta['streams'][0]['nb_frames'])==expected;run([ff,'-v','error','-i',file,'-f','null','-'])
  if shift<0:
   before=pixel(x,43,100,100);after=pixel(x,44,100,100);caption=pixel(x,49,100,1000)
   assert before[0]>200 and before[1]<30,(before,after)
   assert after[1]>200 and after[0]<30,(before,after)
   assert caption[2]>200 and caption[1]<30,caption
  else:
   before=pixel(y,5,20,20);after=pixel(y,6,20,20)
   assert not(before[1]>200 and before[0]<30),before
   assert after[1]>200 and after[0]<30,after
 Image.new('RGBA',(1920,900),(180,0,180,255)).save(d/'art.png')
 a['element']={'geometry':{'x':90,'y':215,'width':900,'height':506},'artworkId':'art','start':0,'end':2}
 _,y=apply_card_transition(ff,clip,card,a,{'frames':75,'pictureCut':{'frames':3}},source,TEMPLATE/'assets/interview-frame.png',d,d/'with-element',encoder,run)
 color=pixel(y,0,20,20);assert color[0]>150 and color[1]<30 and color[2]>150,color
 print('Exacte framegrens, captionbehoud, 50+75 frames en decode voor beide richtingen akkoord')
