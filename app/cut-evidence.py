"""Local silence measurements and source frames. No original media is uploaded."""
import json,sys,subprocess,io,re
from pathlib import Path
from PIL import Image,ImageDraw

def main(folder):
    d=json.loads((folder/'evidence-request.json').read_text());source=d['source'];ff=d['ffmpeg'];q=d['quote'];duration=d['duration'];silences=[]
    if d['kind']=='audio':
        for edge in [q['start'],q['end']]:
            start=max(0,edge-.75);length=min(duration-start,1.5)
            p=subprocess.run([ff,'-v','info','-ss',str(start),'-t',str(length),'-i',source,'-vn','-af','silencedetect=noise=-35dB:d=0.025','-f','null','-'],capture_output=True,check=True)
            opened=None
            for kind,value in re.findall(r'silence_(start|end): ([\d.]+)',p.stderr.decode(errors='replace')):
                if kind=='start':opened=start+float(value)
                elif opened is not None:silences.append({'start':opened,'end':start+float(value)});opened=None
            if opened is not None:silences.append({'start':opened,'end':start+length})
    sheet=None
    if d['kind']=='visual':
        rows=[(d['event']['sourceStart']+d['event']['frames']/25,d['event']['framing'],'UITGAAND')]
        if d['next']['kind']=='clip':rows.append((d['next']['sourceStart'],d['next']['framing'],'INKOMEND'))
        offsets=d['offsets'];w=240;h=160;im=Image.new('RGB',(w*len(offsets),h*len(rows)), 'white');draw=ImageDraw.Draw(im)
        for row,(boundary,framing,label) in enumerate(rows):
            c=framing['crop'];crop='' if framing.get('fullFrame') else f"crop={c['width']}:{c['height']}:{c['x']}:{c['y']},"
            for col,n in enumerate(offsets):
                t=max(0,min(duration-.04,boundary+n/25));p=subprocess.run([ff,'-v','error','-ss',str(t),'-i',source,'-frames:v','1','-vf',crop+'scale=240:135:force_original_aspect_ratio=decrease,pad=240:135:(ow-iw)/2:(oh-ih)/2:white','-f','image2pipe','-vcodec','png','-'],capture_output=True,check=True)
                frame=Image.open(io.BytesIO(p.stdout));im.paste(frame,(col*w,row*h+25));draw.text((col*w+5,row*h+5),f'{label} {n:+d}f  {t:.3f}s',fill='black')
        sheet=folder/'frames.jpg';im.save(sheet,quality=88)
    print(json.dumps({'silences':silences,'sheet':str(sheet) if sheet else None}))

if __name__=='__main__':
    try:main(Path(sys.argv[1]))
    except subprocess.CalledProcessError as e:sys.stderr.write(e.stderr.decode(errors='replace')[-700:]);raise
