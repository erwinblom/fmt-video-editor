import {python as runtimePython} from '../runtime-config.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSubtitleTiming,alignedSubtitleCues} from '../public/model.mjs';
import {spawnSync} from 'node:child_process';
const timing={start:10,end:15,text:'Een zin. Nog een zin.',cues:[{start:10,end:12,text:'Een zin.'},{start:12,end:15,text:'Nog een zin.'}]};
test('semantic timing is bound to exact text and source cuts',()=>{validateSubtitleTiming(timing,30);assert.deepEqual(alignedSubtitleCues({start:10,end:15,nl:timing.text,subtitleTiming:timing}),timing.cues);assert.throws(()=>alignedSubtitleCues({start:10,end:14,nl:timing.text,subtitleTiming:timing}),/gewijzigd/);assert.throws(()=>alignedSubtitleCues({start:10,end:15,nl:'Andere tekst.',subtitleTiming:timing}),/gewijzigd/);});
test('incomplete text, overlapping and out-of-range semantic groups are rejected',()=>{for(const mutate of [t=>t.cues[0].text='Anders.',t=>t.cues[0].end=13,t=>t.cues[1].end=16,t=>t.cues[1].start=NaN]){const t=structuredClone(timing);mutate(t);assert.throws(()=>validateSubtitleTiming(t,30));}});
test('render and SRT use explicit semantic times instead of word weighting',()=>{const p=runtimePython;const result=spawnSync(p,['-c',`from caption_layout import clip_cues
clip={'nl':'Een zin. Nog een zin.','sourceStart':10,'sourceEnd':15,'start':20,'duration':5,'id':'a','blockId':'b','subtitleCues':[{'start':10,'end':12,'text':'Een zin.'},{'start':12,'end':15,'text':'Nog een zin.'}]}
c=clip_cues(clip,{})
assert c[0]['start']==20 and c[0]['end']==22
assert c[1]['start']==22 and c[1]['end']==25
`],{cwd:new URL('..',import.meta.url),encoding:'utf8'});assert.equal(result.status,0,result.stderr);});
