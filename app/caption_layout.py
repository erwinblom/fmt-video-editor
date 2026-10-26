from runtime_config import TEMPLATE
import re
from PIL import ImageFont
FPS=25
def timestamp(s):
 n=round(s*1000);return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
FONT=ImageFont.truetype(str(TEMPLATE/'assets/Inter-Regular.ttf'),44)
def lines_for(text):
 if FONT.getlength(text)<=1360:return [text]
 words=text.split();opts=[]
 for i in range(1,len(words)):
  lines=[' '.join(words[:i]),' '.join(words[i:])];sizes=[FONT.getlength(l) for l in lines]
  if max(sizes)<=1360:opts.append((max(sizes)+.1*abs(sizes[0]-sizes[1]),lines))
 return min(opts,key=lambda x:x[0])[1] if opts else None
def captions(text):
 # Whole sentences when they fit; only oversized sentences continue at punctuation/words.
 sentences=re.split(r'(?<=[.!?])\s+',text.strip());out=[]
 for sentence in sentences:
  if not sentence:continue
  if lines_for(sentence):out.append(sentence);continue
  words=sentence.split();chunk=''
  for word in words:
   test=(chunk+' '+word).strip()
   if lines_for(test):chunk=test
   else:
    if not chunk:raise ValueError('Een ondertitelwoord is te breed: '+word)
    out.append(chunk);chunk=word
  if chunk:out.append(chunk)
 assert ' '.join(out).split()==text.split(),'Ondertiteltekst gewijzigd'
 return out

def clip_cues(e,catalog):
 if e.get('subtitleCues'):
  cues=[]
  for c in e['subtitleCues']:
   lines=lines_for(c['text'])
   if not lines:raise ValueError('Betekenisgroep past niet op twee regels.')
   start=max(0,round((c['start']-e['sourceStart'])*FPS)/FPS)
   end=min(e['duration'],round((c['end']-e['sourceStart'])*FPS)/FPS)
   if end-start<.04:raise ValueError('Betekenisgroep is te kort.')
   cues.append({'start':e['start']+start,'end':e['start']+end,'text':c['text'],'lines':lines,'clipId':e['id'],'blockId':e['blockId']})
  if any(a['end']>b['start']+.001 for a,b in zip(cues,cues[1:])):raise ValueError('Betekenisgroepen overlappen.')
  if ' '.join(c['text'] for c in cues).split()!=e['nl'].split():raise ValueError('Tekst en betekenisgroepen verschillen.')
  return cues
 pieces=captions(e['nl']);weights=[len(p.split()) for p in pieces];total=sum(weights)
 words=[w for w in catalog.get('words',[]) if (catalog.get('imported') or w['speaker']==e['speaker']) and w['end']>e['sourceStart'] and w['start']<e['sourceEnd']]
 def at(f):
  if not words:return e['duration']*f
  ix=f*len(words);i=min(len(words)-1,int(ix));w=words[i]
  return max(0,min(e['duration'],w['start']-e['sourceStart']+(w['end']-w['start'])*(ix-i)))
 bounds=[0];acc=0
 for w in weights[:-1]:
  acc+=w;bounds.append(round(at(acc/total)*FPS)/FPS)
 bounds.append(e['duration'])
 if any(b-a<.04 for a,b in zip(bounds,bounds[1:])):bounds=[round(sum(weights[:i])/total*e['frames'])/FPS for i in range(len(weights)+1)]
 cues=[]
 for j,piece in enumerate(pieces):
  start,end=bounds[j:j+2]
  if end<=start:raise ValueError('Te veel ondertiteltekst voor de lengte van het fragment.')
  cues.append({'start':e['start']+start,'end':e['start']+end,'text':piece,'lines':lines_for(piece),'clipId':e['id'],'blockId':e['blockId']})
 return cues

def srt(cues):
 return '\n'.join(f"{i+1}\n{timestamp(c['start'])} --> {timestamp(c['end'])}\n"+'\n'.join(c['lines'])+'\n' for i,c in enumerate(cues))

if __name__=='__main__':
 import sys,json
 data=json.load(sys.stdin)
 cues=[c for e in data['plan']['events'] if e['kind']=='clip' for c in clip_cues(e,data['catalog'])]
 print(json.dumps(cues,ensure_ascii=False) if data.get('format')=='json' else srt(cues),end='')
