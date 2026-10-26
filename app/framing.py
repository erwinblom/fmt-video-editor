"""The source crop changes; the approved FMT frame and caption rail do not."""
def _single_clip_filter(event):
    f=event['framing'];c=f['crop'];s=f['source']
    if any(not isinstance(c[k],int) or c[k]<0 for k in ['x','y','width','height']) or c['width']<2 or c['height']<2 or c['x']+c['width']>s['width'] or c['y']+c['height']>s['height']:
        raise ValueError('Ongeldige bronuitsnede')
    crop=("" if f.get("fullFrame") else f"crop={c['width']}:{c['height']}:{c['x']}:{c['y']}:exact=1,")+"scale=1504:846"
    crop+=(':force_original_aspect_ratio=decrease:flags=lanczos,pad=1504:846:(ow-iw)/2:(oh-ih)/2:color=0xF5F3EE' if c.get('contain') else ':flags=lanczos')
    element=event.get("element")
    if element:
        g=element["geometry"];start=element["start"];end=element["end"];active=f"gte(t,{start})*lt(t,{end})"
        return f"[0:v]{crop},setsar=1,fps=25,tpad=stop_mode=clone:stop_duration=0.08,trim=end_frame={event['frames']},setpts=PTS-STARTPTS,split=2[normal][guest];[normal]pad=1920:1080:208:32:color=0xF5F3EE[base];[base][1:v]overlay=0:0[framed];[framed][2:v]overlay=200:916:repeatlast=1[captioned];[guest]scale={g['width']}:{g['height']}[small];[captioned][small]overlay={g['x']}:{g['y']}:enable='{active}'[withguest];[withguest][3:v]overlay=0:0:enable='{active}'[out]"
    return f"[0:v]{crop},setsar=1,fps=25,tpad=stop_mode=clone:stop_duration=0.08,trim=end_frame={event['frames']},setpts=PTS-STARTPTS,pad=1920:1080:208:32:color=0xF5F3EE[base];[base][1:v]overlay=0:0[framed];[framed][2:v]overlay=200:916:repeatlast=1[out]"


def crop_filter(f):
    c=f['crop']
    crop=('' if f.get('fullFrame') else f"crop={c['width']}:{c['height']}:{c['x']}:{c['y']}:exact=1,")+'scale=1504:846'
    return crop+(':force_original_aspect_ratio=decrease:flags=lanczos,pad=1504:846:(ow-iw)/2:(oh-ih)/2:color=0xF5F3EE' if c.get('contain') else ':flags=lanczos')


def visual_inputs(event, source):
    segments=event.get('visualSegments') or [{'sourceStart':event['sourceStart'],'frames':event['frames']}]
    inputs=[['-ss',str(s['sourceStart']),'-t',str(min(s['frames']/25,s.get('sourceEnd',s['sourceStart']+s['frames']/25)-s['sourceStart'])),'-i',source] for s in segments]
    return inputs[0], [arg for items in inputs[1:] for arg in items]


def clip_filter(event):
    segments=event.get('visualSegments',[])
    if len(segments)<2 and (not segments or segments[0]['framing']==event['framing'] and segments[0]['sourceStart']==event['sourceStart']):
        return _single_clip_filter(event)
    import copy
    clean=copy.deepcopy(event);clean['framing']['fullFrame']=True
    suffix=_single_clip_filter(clean)
    # After source assembly the existing frame, captions and artwork remain on the audio clock.
    start=suffix.index(',pad=1920') if not event.get('element') else suffix.index(',split=2')
    prefix=[];extra=4 if event.get('element') else 3
    for i,s in enumerate(segments):
        index=0 if i==0 else extra+i-1
        prefix.append(f"[{index}:v]{crop_filter(s['framing'])},setsar=1,fps=25,tpad=stop_mode=clone:stop_duration=0.08,trim=end_frame={s['frames']},setpts=PTS-STARTPTS[v{i}]")
    prefix.append(''.join(f'[v{i}]' for i in range(len(segments)))+f"concat=n={len(segments)}:v=1:a=0[visual]")
    return ';'.join(prefix)+';[visual]'+suffix[start+1:]


def picture_command(ff, event, source, frame, captions, assets, output, encoder, window=None):
    first,extra=visual_inputs(event,source)
    artwork=['-i',assets/(event['element']['artworkId']+'.png')] if event.get('element') else []
    graph=clip_filter(event);mapping='[out]';count=event['frames']
    if window is not None:
        offset,count=window
        graph+=f';[out]trim=start_frame={offset}:end_frame={offset+count},setpts=PTS-STARTPTS[preview]'
        mapping='[preview]'
    return [ff,'-v','error','-y',*first,'-i',frame,'-f','concat','-safe','0','-i',captions,*artwork,*extra,'-filter_complex_threads','1','-filter_complex',graph,'-map',mapping,'-frames:v',str(count),*encoder,output]
