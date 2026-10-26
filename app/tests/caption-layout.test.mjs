import {python as runtimePython} from '../runtime-config.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const python=runtimePython,cwd=fileURLToPath(new URL('..',import.meta.url));
function run(code){const r=spawnSync(python,['-c',code],{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
test('shared captions retain sentence text and fit at most two lines',()=>run(`from caption_layout import captions,lines_for,FONT
text='Dit is een korte zin. '+('Een inhoudelijk nauwkeurige ondertitel moet ook in een lange uitleg alle woorden behouden zonder betekenis te veranderen. '*5)
pieces=captions(text)
assert ' '.join(pieces).split()==text.split()
assert pieces[0]=='Dit is een korte zin.'
assert len(pieces)>2
for piece in pieces:
 lines=lines_for(piece)
 assert 1<=len(lines)<=2
 assert all(FONT.getlength(line)<=1360 for line in lines)
`));
test('shared SRT timing uses montage offsets, stays inside clips, and retains clean subtitle text',()=>run(`from caption_layout import clip_cues,srt,timestamp
clip={'nl':'I think it may work. We should test it.','speaker':'Guest','sourceStart':50,'sourceEnd':54,'duration':4,'frames':100,'start':19,'id':'a','blockId':'b'}
cat={'imported':True,'words':[{'text':' uh','start':50,'end':50.5,'speaker':'Spreker'},{'text':' maybe','start':52,'end':53.5,'speaker':'Spreker'}]}
cues=clip_cues(clip,cat)
assert cues[0]['start']==19 and cues[-1]['end']==23
assert all(19<=c['start']<c['end']<=23 for c in cues)
assert all(a['end']==b['start'] for a,b in zip(cues,cues[1:]))
assert ' '.join(c['text'] for c in cues)==clip['nl']
content=srt(cues)
assert '00:00:19,000 -->' in content and '00:00:23,000' in content
assert 'uh' not in content and 'maybe' not in content
assert timestamp(3661.234)=='01:01:01,234'
`));
test('fallback timing without source words stays bounded and rejects impossible density',()=>run(`from caption_layout import clip_cues
clip={'nl':'One sentence. Two sentences.','speaker':'Guest','sourceStart':0,'sourceEnd':4,'duration':4,'frames':100,'start':0,'id':'a','blockId':'b'}
cues=clip_cues(clip,{})
assert cues[0]['start']==0 and cues[-1]['end']==4
assert cues[0]['end']==cues[1]['start']
clip.update(nl='One. Two. Three.',duration=.04,frames=1)
try: clip_cues(clip,{})
except ValueError: pass
else: raise AssertionError('Impossible caption density accepted')
`));
