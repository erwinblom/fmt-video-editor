"""One picture-only chapter boundary, shared by export and the short preview."""
import copy
from pathlib import Path
from PIL import Image,ImageDraw
from framing import picture_command

def chapter_command(ff,reel,event,output,encoder):
    return [ff,'-v','error','-y','-ss',str(event['reelStart']),'-i',reel,'-frames:v',str(event['frames']),'-vf','fps=25,setsar=1',*encoder,output]

def apply_card_transition(ff,clip,card,a,b,source,frame,assets,work,encoder,run):
    shift=b.get('pictureCut',{}).get('frames',0)
    if not shift:return clip,card
    work.mkdir(parents=True,exist_ok=True);out_a=work/'clip.mp4';out_b=work/'card.mp4';n=abs(shift)
    if shift<0:
        # The card replaces the top 900 px; the last quote's caption stays on its audio clock.
        graph=f"[0:v]split=2[p][t];[p]trim=end_frame={a['frames']-n},setpts=PTS-STARTPTS[prefix];[t]trim=start_frame={a['frames']-n},setpts=PTS-STARTPTS[tail];[1:v]trim=end_frame={n},setpts=PTS-STARTPTS,crop=1920:900:0:0[top];[tail][top]overlay=0:0:shortest=1[overlap];[prefix][overlap]concat=n=2:v=1:a=0[out]"
        run([ff,'-v','error','-y','-i',clip,'-i',card,'-filter_complex_threads','1','-filter_complex',graph,'-map','[out]','-frames:v',str(a['frames']),*encoder,out_a])
        graph=f"trim=start_frame={n},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={n/25},trim=end_frame={b['frames']}"
        run([ff,'-v','error','-y','-i',card,'-vf',graph,'-frames:v',str(b['frames']),*encoder,out_b])
    else:
        cont=copy.deepcopy(a);cont['sourceStart']=a['sourceStart']+a['frames']/25;cont['sourceEnd']=cont['sourceStart']+n/25;cont['frames']=n;cont['duration']=n/25;cont.pop('visualSegments',None)
        element=a.get('element');last=(a['frames']-1)/25
        if element and element['start']<=last<element['end']:cont['element']={**element,'start':0,'end':n/25}
        else:cont.pop('element',None)
        blank=Image.new('RGB',(1520,128),'#0A0A0A');ImageDraw.Draw(blank).rectangle((6,6,1513,121),fill='white');blank.save(work/'blank.png')
        (work/'blank.txt').write_text(f"ffconcat version 1.0\nfile 'blank.png'\nduration {n/25}\nfile 'blank.png'\n")
        run(picture_command(ff,cont,source,frame,work/'blank.txt',assets,work/'continuation.mp4',encoder))
        graph=f"[0:v]trim=end_frame={n},setpts=PTS-STARTPTS[tail];[1:v]trim=end_frame={b['frames']-n},setpts=PTS-STARTPTS[body];[tail][body]concat=n=2:v=1:a=0[out]"
        run([ff,'-v','error','-y','-i',work/'continuation.mp4','-i',card,'-filter_complex_threads','1','-filter_complex',graph,'-map','[out]','-frames:v',str(b['frames']),*encoder,out_b]);out_a=clip
    return out_a,out_b
