"""Short local cut preview, using the export picture filter and source audio clocks."""
import json,sys,subprocess,shutil
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from runtime_config import TEMPLATE
from framing import picture_command
from card_transition import apply_card_transition,chapter_command
from caption_layout import clip_cues,FONT

def run(args):subprocess.run([str(x) for x in args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def render_captions(e,catalog,folder):
    folder.mkdir(exist_ok=True);local=[]
    blank=Image.new('RGB',(1520,128),'#0A0A0A');ImageDraw.Draw(blank).rectangle((6,6,1513,121),fill='white')
    for j,cue in enumerate(clip_cues(e,catalog) if e.get('nl','').strip() else []):
        im=blank.copy();draw=ImageDraw.Draw(im);lines=cue['lines']
        for k,line in enumerate(lines):
            bb=draw.textbbox((0,0),line,font=FONT);top=64+(k-(len(lines)-1)/2)*50-(bb[3]-bb[1])/2-bb[1]
            draw.text((760-draw.textlength(line,font=FONT)/2,top),line,font=FONT,fill='#0A0A0A')
        name=f'{j}.png';im.save(folder/name);local.append((name,cue['end']-cue['start']))
    if not local:blank.save(folder/'blank.png');local=[('blank.png',e['duration'])]
    (folder/'captions.txt').write_text('ffconcat version 1.0\n'+''.join(f"file '{name}'\nduration {d:.8f}\n" for name,d in local)+f"file '{local[-1][0]}'\n")
    return folder/'captions.txt'

def main(folder):
    data=json.loads((folder/'request.json').read_text());source=Path(data['source']);ff=shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
    frame=folder/'frame.png';im=Image.open(TEMPLATE/'assets/interview-frame.png').convert('RGBA')
    if data.get('subtitleLanguage','nl')!='nl':
        d=ImageDraw.Draw(im);d.rectangle((30,976,110,1024),fill=(245,243,238,255));d.text((40,986),data['subtitleLanguage'].upper(),font=ImageFont.truetype(str(TEMPLATE/'assets/PaperMono-Regular.ttf'),24),fill='#0A0A0A')
    im.save(frame)
    card_pair=len(data['events'])==2 and data['events'][1]['kind']=='topic'
    encoder=['-an','-c:v','libx264','-preset','veryfast','-crf','18','-threads','2','-pix_fmt','yuv420p']
    for i,e in enumerate(data['events']):
        count=min(50,e['frames']);offset=e['frames']-count if i==0 else 0;part=e
        if data.get('windows'):offset,count=data['windows'][i]
        if e['kind']=='clip':
            captions=render_captions(e,data['catalog'],folder/f'captions-{i}')
            if data['catalog'].get('hasVideo') is False:
                graph=f'[0:v][1:v]overlay=200:916,trim=start_frame={offset}:end_frame={offset+count},setpts=PTS-STARTPTS[out]'
                run([ff,'-v','error','-y','-loop','1','-framerate','25','-i',frame,'-f','concat','-safe','0','-i',captions,'-filter_complex_threads','1','-filter_complex',graph,'-map','[out]','-frames:v',str(count),*encoder,folder/f'v{i}.mp4'])
            else:
                run(picture_command(ff,e,source,frame,captions,Path(data['assets']),folder/f'v{i}.mp4',encoder,window=None if card_pair else (offset,count)))
            # Apply the export's fades at actual audio edges, never at window edges.
            length=count/25;filters=[]
            if offset==0:filters.append('afade=t=in:st=0:d=0.005')
            if offset+count==e['frames']:filters.append(f'afade=t=out:st={max(0,length-.005)}:d=0.005')
            run([ff,'-v','error','-y','-ss',str(part['sourceStart']+offset/25),'-t',str(length),'-i',source,'-vn','-af',','.join(filters) or 'anull','-ar','48000','-ac','2','-c:a','pcm_s16le',folder/f'a{i}.wav'])
        else:
            run(chapter_command(ff,Path(data['cards']),e,folder/f'v{i}.mp4',encoder))
            run([ff,'-v','error','-y','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',str(count/25),'-c:a','pcm_s16le',folder/f'a{i}.wav'])
    if card_pair:
        a,b=data['events'];pictures=apply_card_transition(ff,folder/'v0.mp4',folder/'v1.mp4',a,b,source,frame,Path(data['assets']),folder/'boundary',encoder,run)
        for i,(e,picture) in enumerate(zip(data['events'],pictures)):
            count=min(50,e['frames']);offset=e['frames']-count if i==0 else 0
            run([ff,'-v','error','-y','-i',picture,'-vf',f'trim=start_frame={offset}:end_frame={offset+count},setpts=PTS-STARTPTS','-frames:v',str(count),*encoder,folder/f'window-{i}.mp4'])
        for i in range(2):(folder/f'window-{i}.mp4').replace(folder/f'v{i}.mp4')
    for kind,ext in [('v','mp4'),('a','wav')]:
        (folder/f'{kind}.txt').write_text(''.join(f"file '{kind}{i}.{ext}'\n" for i in range(len(data['events']))))
    run([ff,'-v','error','-y','-f','concat','-safe','0','-i',folder/'v.txt','-f','concat','-safe','0','-i',folder/'a.txt','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart',folder/'preview.tmp.mp4'])
    (folder/'preview.tmp.mp4').replace(folder/'preview.mp4')
if __name__=='__main__':
    try:main(Path(sys.argv[1]))
    except subprocess.CalledProcessError as e:sys.stderr.write(e.stderr.decode(errors='replace')[-2000:]);raise
