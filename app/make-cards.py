from runtime_config import TEMPLATE
#!/usr/bin/env python3
"""Maak een nieuwe grafische onderdelenbank vanuit de vaste FMT-template."""
import argparse, html, json, shutil
from pathlib import Path
from PIL import ImageFont
p=argparse.ArgumentParser();p.add_argument('--config',required=True,type=Path);p.add_argument('--output',required=True,type=Path);args=p.parse_args()
T=TEMPLATE;cfg=json.loads(args.config.read_text());out=args.output.resolve()
style=cfg.get('style',{});style_name=style.get('name','');website=style.get('website','');own_logo=style.get('logo','')
if out.exists() and any(out.iterdir()):raise SystemExit('De uitvoermap bevat al bestanden; kies een nieuwe map.')
for key in ['guest','intro','subjects']:
 if not cfg.get(key):raise SystemExit(f'Ontbrekend veld: {key}')
if not isinstance(cfg['subjects'],list) or not all(isinstance(t,str) and t.strip() for t in cfg['subjects']):raise SystemExit('subjects moet een lijst met onderwerpteksten zijn.')
out.mkdir(parents=True,exist_ok=True);shutil.copytree(T/'assets',out/'assets');shutil.copy2(T/'template.json',out/'template.json');(out/'interview.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2))
assets=out/'assets'
# Preserve the original target geometry; recolor only the chapter badge.
(assets/'fmt-target-badge.svg').write_text((assets/'fmt-target-logo.svg').read_text().replace('fill="#0A0A0A"','fill="#FFFFFF"').replace('fill="#E10600"','fill="#0A0A0A"'))
head=ImageFont.truetype(str(assets/'Inter-Bold.ttf'),118);body=ImageFont.truetype(str(assets/'Inter-Regular.ttf'),51)
def balanced(text,font,width,maximum):
 words=text.split()
 if font.getlength(text)<=width:return [text]
 # Minimum number of complete word lines; balance two-line headlines.
 if maximum==2:
  opts=[]
  for i in range(1,len(words)):
   lines=[' '.join(words[:i]),' '.join(words[i:])];sizes=[font.getlength(s) for s in lines]
   if max(sizes)<=width:opts.append((max(sizes)+.15*abs(sizes[0]-sizes[1]),lines))
  if not opts:raise ValueError('De onderwerpkop is te lang voor twee regels: '+text)
  return min(opts,key=lambda q:q[0])[1]
 lines=[];line=''
 for word in words:
  candidate=(line+' '+word).strip()
  if font.getlength(candidate)>width:
   if not line:raise ValueError('Een woord is te breed: '+word)
   lines.append(line);line=word
  else:line=candidate
 if line:lines.append(line)
 if len(lines)>maximum:raise ValueError('De intro is te lang; kort hem redactioneel in.')
 return lines
esc=html.escape
intro_lines=balanced(cfg['intro'],body,1360,3)
label=' / '.join(s for s in [cfg['guest'],cfg.get('organization','')] if s).upper()
if ImageFont.truetype(str(assets/'PaperMono-Regular.ttf'),24).getlength(label)>1320:raise ValueError('Naam/organisatie te lang voor kaartlabel.')
name_font=min(90,90*1400/max(1,ImageFont.truetype(str(assets/'Inter-Bold.ttf'),90).getlength(style_name)))
css='''@font-face{font-family:Grotesk;src:url(assets/Inter-Bold.ttf)}@font-face{font-family:Sans;src:url(assets/Inter-Regular.ttf)}@font-face{font-family:Mono;src:url(assets/PaperMono-Regular.ttf)}*{box-sizing:border-box}html,body{margin:0;overflow:hidden;background:#F5F3EE}#root{position:relative;width:1920px;height:1080px;color:#0A0A0A;background:#F5F3EE}.clip{position:absolute;inset:0}.target{position:absolute;left:1776px;top:48px;width:104px;height:104px}.brand{position:absolute;left:96px;top:58px;font:30px Grotesk}.rule{position:absolute;left:96px;top:140px;width:1560px;height:8px;background:#0A0A0A}.footer{position:absolute;left:96px;bottom:58px;font:24px Mono}.fmt{position:absolute;left:208px;top:214px;background:#E10600;color:white;border:8px solid #0A0A0A;box-shadow:12px 12px 0 #0A0A0A;padding:8px 30px;font:90px Grotesk}.handpicked{position:absolute;left:208px;top:365px;font:170px/.98 Grotesk;letter-spacing:-5px}.description{position:absolute;left:216px;top:596px;font:51px/1.22 Sans;width:1400px}.introline{position:absolute;left:216px;top:835px;width:1400px;height:12px;background:#E10600;transform-origin:left center}.stamp{position:absolute;left:216px;top:895px;font:24px Mono}.box{position:absolute;left:208px;top:290px;width:1504px;height:430px;border:8px solid #0A0A0A;background:white;box-shadow:16px 16px 0 #0A0A0A}.stripe{height:18px;background:#E10600;transform-origin:left center}.num{position:absolute;left:88px;top:378px;width:152px;height:152px;background:#E10600;color:white;border:8px solid #0A0A0A;box-shadow:10px 10px 0 #0A0A0A;display:flex;align-items:center;justify-content:center;font:68px Grotesk}.num img{width:104px;height:104px;display:block}.head{position:absolute;left:280px;top:380px;width:1320px;font:118px/1.02 Grotesk;letter-spacing:-3px}.label{position:absolute;left:280px;top:627px;font:24px Mono}.outro .fmt{top:260px}.outro .handpicked{top:420px}.outro .introline{top:650px}'''
css+=f'.fmt{{font-size:{name_font}px}}'
clips=[];js=[];plan=[]
def add_scene(sid,start,duration,content,extra=''):
 clips.append(f'<section id="{sid}" class="clip {extra}" data-start="{start}" data-duration="{duration}" data-track-index="0"><div class="brand">{esc(style_name)}</div><div class="footer" style="left:auto;right:96px">{esc(website)}</div><div class="rule"></div>{content}</section>')
 plan.append({'id':sid,'reel_start':start,'duration':duration})
def tween(sid,selector,fr,to,t,d=.3):js.append(f"tl.fromTo('#{sid} .{selector}',{fr},{{{to},duration:{d},ease:'power4.out'}},{t});")
desc=''.join(f'<div>{esc(s)}</div>' for s in intro_lines)
# Bold the guest name in the intro when it appears on one complete line.
guest=esc(cfg['guest'])
if guest in desc:desc=desc.replace(guest,'<span style="font-family:Grotesk">'+guest+'</span>',1)
add_scene('intro',0,6,'<div class="fmt">'+esc(style_name)+'</div><div class="handpicked">Gesprek</div><div class="description">'+desc+'</div><div class="introline"></div><div class="stamp">HET GESPREK / DE KERN</div><div class="footer">INTERVIEW</div>')
tween('intro','fmt','{scale:1.35,opacity:0}','scale:1,opacity:1',.12,.32);tween('intro','handpicked','{x:-120,opacity:0}','x:0,opacity:1',.52,.38);tween('intro','description','{y:64,opacity:0}','y:0,opacity:1',1.08,.4);tween('intro','introline','{scaleX:0}','scaleX:1',1.48,.48);tween('intro','stamp','{y:32,opacity:0}','y:0,opacity:1',1.72)
for i,title in enumerate(cfg['subjects'],1):
 st=6+(i-1)*3;sid=f'topic-{i:02}'
 for size in range(118,21,-2):
  fitted=ImageFont.truetype(str(assets/'Inter-Bold.ttf'),size)
  try:lines=balanced(title,fitted,1320,2);break
  except ValueError:continue
 else:raise ValueError('Deze titel past niet leesbaar op de kaart. Gebruik een kortere titel: '+title)
 title_html=''.join('<div>'+esc(s)+'</div>' for s in lines)
 add_scene(sid,st,3,f'<div class="box"><div class="stripe"></div></div><div class="num" aria-hidden="true">{i}</div><div class="head" style="font-size:{size}px">{title_html}</div><div class="label">{esc(label)}</div><div class="footer">INTERVIEW / {esc(cfg["guest"].upper())}</div>')
 for sel,fr,to,dt in [('box','{x:100,opacity:0}','x:0,opacity:1',0),('num','{scale:1.35,opacity:0}','scale:1,opacity:1',.12),('head','{y:75,opacity:0}','y:0,opacity:1',.24),('label','{y:35,opacity:0}','y:0,opacity:1',.4),('stripe','{scaleX:0}','scaleX:1',.12)]:tween(sid,sel,fr,to,st+dt)
st=6+3*len(cfg['subjects']);add_scene('outro',st,6,'<div class="fmt">'+esc(style_name)+'</div><div class="handpicked">Gesprek</div><div class="introline"></div>','outro');tween('outro','fmt','{scale:1.3,opacity:0}','scale:1,opacity:1',st+.06,.28);tween('outro','handpicked','{x:-100,opacity:0}','x:0,opacity:1',st+.38,.36);tween('outro','introline','{scaleX:0}','scaleX:1',st+.8,.4)
duration=st+6;js.append(f'tl.to({{}},{{duration:.01}},{duration-.01});')
logo=f'<img class="clip target" src="{esc(own_logo)}" data-start="0" data-duration="{duration}" data-track-index="2" style="inset:auto;left:1776px;top:48px;width:104px;height:104px;object-fit:contain">' if own_logo else ''

(out/'index.html').write_text(f'<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>Gesprekskaarten — {esc(cfg["guest"])}</title><script src="assets/gsap.min.js"></script><style>{css}.fmt:empty{{display:none}}</style></head><body><main id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="{duration}" data-fps="25">'+''.join(clips)+logo+'</main><script>const tl=gsap.timeline({paused:true});'+''.join(js)+'window.__timelines={main:tl};</script></body></html>')
(out/'hyperframes.json').write_text(json.dumps({'paths':{'assets':'assets'},'authoringSkill':'general-video'}));(out/'graphics-plan.json').write_text(json.dumps({'kind':'graphics-parts-reel','duration':duration,'parts':plan,'audio_asset':None,'audio_placement':'Use template.json; final speech starts belong to the actual interview, not this reel.'},indent=2));print(out)
