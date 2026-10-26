import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyVisualCuts,validateTransition,transitionTarget} from '../public/transitions.mjs';
import {exportPlan} from '../export-plan.mjs';
import {validateEdits} from '../public/model.mjs';
import {montageSignature} from '../public/export-status.mjs';
const frame={crop:{x:0,y:0,width:320,height:180},source:{width:320,height:180}};
const event=(id,start)=>({kind:'clip',id,blockId:'b1',frames:50,start:0,duration:2,sourceStart:start,sourceEnd:start+2,framing:structuredClone(frame)});
const state=(frames,nextId='b')=>({mode:'quoteverhaal',modes:{quoteverhaal:{edits:{'b1:a':{transition:{frames,nextId}}}}}});
for(const frames of [-5,5])test(`beeldknip ${frames} frames: audio onveranderd en bronklokken na overgang gelijk`,()=>{
 const e=[event('a',1),event('b',7)],before=structuredClone(e);applyVisualCuts(e,state(frames),{duration:12});
 assert.deepEqual(e.map(({visualSegments,...x})=>x),before);
 assert.equal(e[0].visualSegments.reduce((n,s)=>n+s.frames,0),50);assert.equal(e[1].visualSegments.reduce((n,s)=>n+s.frames,0),50);
 if(frames<0){assert.equal(e[0].visualSegments[0].frames,45);assert.equal(e[0].visualSegments[1].sourceStart,6.8);assert.equal(e[1].visualSegments[0].sourceStart,7);}
 else{assert.equal(e[1].visualSegments[0].sourceStart,3);assert.equal(e[1].visualSegments[1].sourceStart,7.2);}
});
test('hoofdstukkaart is een eigen doel; na verplaatsen naar een andere buur blijft oude keuze uit',()=>{
 const e=[event('a',1),{kind:'topic',blockId:'b2',frames:75},event('b',7)];const cut=applyVisualCuts(e,state(-5,'topic:b2'),{duration:12});assert.equal(cut.length,1);assert.equal(cut[0].frames,-5);assert.deepEqual(e[1].pictureCut,{frames:-5});assert.equal(e[0].visualSegments.length,1);
 const moved=[event('a',1),event('c',7)];applyVisualCuts(moved,state(5),{duration:12});assert.equal(moved[1].visualSegments.length,1);
});
test('korte clips en opnamegrenzen beperken overgang; drie aaneengesloten clips behouden frameaantal',()=>{
 const e=[event('a',1),event('b',0),event('c',8)];e[1].frames=8;e[1].duration=.32;const s=state(-12);s.modes.quoteverhaal.edits['b1:b']={transition:{nextId:'c',frames:-12}};
 const cuts=applyVisualCuts(e,s,{duration:12});assert.equal(cuts[0].frames,0);assert.equal(cuts[1].frames,-4);
 for(const x of e)assert.equal(x.visualSegments.reduce((n,s)=>n+s.frames,0),x.frames);
});
test('onbekende of ongeldige verschuivingen worden geweigerd',()=>{for(const x of [null,{}, {nextId:'b',frames:13},{nextId:'b',frames:1.5},{nextId:'b',frames:NaN},{nextId:'b',frames:2,audio:2}])assert.throws(()=>validateTransition(x));validateTransition({nextId:'b',frames:-12});});
test('bewaren/heropenen, montagevormen onafhankelijk en export behoudt audio/selectie',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/example-catalog.json',import.meta.url)));
 const s={version:1,mode:'quoteverhaal',target:300,modes:Object.fromEntries(['quoteverhaal','gespreksmontage'].map(mode=>[mode,{teaser:[],blocks:structuredClone(catalog.catalog[mode]),edits:{}}]))};
 const b=s.modes.quoteverhaal.blocks.find(b=>b.clipIds.length>1),id=b.clipIds[0],nextId=b.clipIds[1],q=catalog.quotes[id];const before=exportPlan(s,catalog),sig=montageSignature(s,catalog),other=structuredClone(s.modes.gespreksmontage);
 s.modes.quoteverhaal.edits[`${b.id}:${id}`]={start:q.start,end:q.end,nl:q.nl,translationReviewed:false,transition:{frames:-4,nextId}};validateEdits(s.modes.quoteverhaal,catalog,s.mode);
 const loaded=JSON.parse(JSON.stringify(s)),after=exportPlan(loaded,catalog);
 assert.equal(before.duration,after.duration);assert.deepEqual(before.events.map(e=>[e.kind,e.id,e.sourceStart,e.sourceEnd,e.frames,e.nl,e.subtitleCues,e.element]),after.events.map(e=>[e.kind,e.id,e.sourceStart,e.sourceEnd,e.frames,e.nl,e.subtitleCues,e.element]));
 assert.deepEqual(other,loaded.modes.gespreksmontage);assert.notEqual(sig,montageSignature(loaded,catalog));assert.equal(after.visualCuts.find(c=>c.id===id&&c.blockId===b.id).frames,-4);
});

test('overgang bekijken na audioknip kan vóór nieuwe ondertitelcontrole; export blijft streng',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('./fixtures/example-catalog.json',import.meta.url)));const m={teaser:[],blocks:structuredClone(c.catalog.quoteverhaal),edits:{}};const s={mode:'quoteverhaal',target:300,modes:{quoteverhaal:m}};
 const b=m.blocks.find(b=>b.clipIds.length>1),id=b.clipIds[0],q=c.quotes[id];m.edits[`${b.id}:${id}`]={start:q.start+.04,end:q.end,nl:q.nl,translationReviewed:false,subtitleTiming:{start:q.start,end:q.end,text:q.nl,cues:[{start:q.start,end:q.end,text:q.nl}]}};
 assert.throws(()=>exportPlan(s,c),/gewijzigd/);const p=exportPlan(s,c,{preview:true});assert.equal(p.events.find(e=>e.id===id&&e.blockId===b.id).sourceStart,q.start+.04);
});

test('kaartgrens eerder en later behoudt alle event- en audioframes',()=>{
 for(const frames of [-12,12]){const e=[event('a',1),{kind:'topic',blockId:'b2',frames:75,start:2,duration:3,reelStart:6}],before=structuredClone(e);applyVisualCuts(e,state(frames,'topic:b2'),{duration:12});assert.deepEqual(e.map(({visualSegments,pictureCut,...x})=>x),before);assert.equal(e[1].pictureCut.frames,frames);}
});
test('laatste quote vindt de volgende niet-lege hoofdstukkaart, laatste hoofdstuk en teaser stoppen',()=>{
 const s={mode:'quoteverhaal',modes:{quoteverhaal:{teaser:['t'],blocks:[{id:'b1',clipIds:['a','b']},{id:'empty',clipIds:[]},{id:'b2',title:'Volgend onderwerp',clipIds:['c']}]}}};
 assert.equal(transitionTarget(s,'a','b1').nextId,'b');assert.equal(transitionTarget(s,'b','b1').nextId,'topic:b2');assert.equal(transitionTarget(s,'b','b1').title,'Volgend onderwerp');assert.equal(transitionTarget(s,'c','b2'),null);assert.equal(transitionTarget(s,'t','teaser'),null);
});
test('kaartovergang blijft na JSON-heropenen bewaard en telt mee in export/status',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('./fixtures/example-catalog.json',import.meta.url)));const m={teaser:[],blocks:structuredClone(c.catalog.quoteverhaal),edits:{}};const s={mode:'quoteverhaal',target:300,modes:{quoteverhaal:m}};const b=m.blocks[0],id=b.clipIds.at(-1),q=c.quotes[id],nextId='topic:'+m.blocks[1].id,old=exportPlan(s,c),sig=montageSignature(s,c);
 m.edits[`${b.id}:${id}`]={start:q.start,end:q.end,nl:q.nl,translationReviewed:false,transition:{frames:6,nextId}};validateEdits(m,c,s.mode);const p=exportPlan(JSON.parse(JSON.stringify(s)),c);assert.equal(p.duration,old.duration);assert.equal(p.frames,old.frames);assert.equal(p.events.find(e=>e.kind==='topic'&&e.blockId===m.blocks[1].id).pictureCut.frames,6);assert.notEqual(sig,montageSignature(s,c));m.edits[`${b.id}:${id}`].transition.nextId='topic:nonexistent';assert.throws(()=>validateEdits(m,c,s.mode));
});
