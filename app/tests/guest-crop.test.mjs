import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGuestCrop,resolveFraming} from '../public/framing.mjs';
import {montageSignature} from '../public/export-status.mjs';
const catalog={imported:true,hasVideo:true,framing:{source:{width:960,height:540},presets:{}},quotes:{a:{speaker:'renamed',start:0,end:2,nl:'Gast.'}},catalog:{quoteverhaal:[],gespreksmontage:[]}};
const state=()=>({mode:'quoteverhaal',modes:{quoteverhaal:{teaser:['a'],blocks:[{id:'b',title:'Gast',clipIds:['a']}],edits:{}}}});
test('new imports export actual cropped source, and changing it invalidates cached video',()=>{const s=state(),old=montageSignature(s,catalog);s.guestCrop={x:480,y:0,width:480,height:540};const f=resolveFraming(s,catalog,'a','b');assert.equal(f.fullFrame,false);assert.deepEqual(f.crop,{x:480,y:0,width:480,height:540,contain:true});assert.notEqual(montageSignature(s,catalog),old);assert.equal(resolveFraming(state(),catalog,'a','b').fullFrame,true);});
test('guest crop validation rejects malformed, out of bounds and audio-only settings',()=>{validateGuestCrop(undefined,catalog);validateGuestCrop({x:0,y:0,width:960,height:540},catalog);for(const bad of [null,[],{},'crop',{x:-1,y:0,width:100,height:100},{x:0,y:0,width:1,height:100},{x:0.5,y:0,width:100,height:100},{x:900,y:0,width:100,height:100},{x:0,y:0,width:100,height:541},{x:0,y:0,width:100,height:100,extra:1}])assert.throws(()=>validateGuestCrop(bad,catalog),/gastkader/);assert.throws(()=>validateGuestCrop({x:0,y:0,width:100,height:100},{...catalog,hasVideo:false}),/gastkader/);});

import {guestFrame169,moveGuestFrame,zoomGuestFrame,resizeGuestFrame} from '../public/framing.mjs';
test('16:9 frame remains exact and inside landscape, portrait and odd-size sources',()=>{
 for(const source of [{width:960,height:540},{width:720,height:1280},{width:2874,height:1682}]){
 const check=f=>{assert.equal(f.width*9,f.height*16);assert.ok(Object.values(f).every(Number.isInteger));assert.ok(f.x>=0&&f.y>=0&&f.x+f.width<=source.width&&f.y+f.height<=source.height);};
 let frame=guestFrame169(source);check(frame);
 for(const zoom of [1,1.33,3.7,8]){frame=zoomGuestFrame(frame,source,zoom);check(frame);for(const [dx,dy] of [[-9999,9999],[9999,-9999],[13,17]])check(moveGuestFrame(frame,source,dx,dy));
 for(const corner of ['tl','tr','bl','br'])for(const point of [{x:-500,y:-500},{x:9999,y:9999},{x:400,y:300}])check(resizeGuestFrame(frame,source,corner,point));}
 }
});
test('opening an old free crop proposes 16:9 without modifying saved crop; opposite resize corner stays fixed',()=>{
 const source={width:960,height:540},old={x:500,y:40,width:400,height:460},before=structuredClone(old),frame=guestFrame169(source,old);
 assert.deepEqual(old,before);assert.equal(frame.width*9,frame.height*16);const resized=resizeGuestFrame(frame,source,'br',{x:900,y:400});assert.equal(resized.x,frame.x);assert.equal(resized.y,frame.y);
 const zoomed=zoomGuestFrame({x:240,y:135,width:480,height:270},source,3);assert.equal(zoomed.x+zoomed.width/2,480);assert.ok(Math.abs(zoomed.y+zoomed.height/2-270)<=.5);
});

import {validateGuestFrames,guestFrameChoices} from '../public/framing.mjs';
import {exportPlan} from '../export-plan.mjs';
function tripleFixture(){
 const frames={wide:{x:480,y:0,width:480,height:270},medium:{x:520,y:100,width:320,height:180},close:{x:600,y:200,width:160,height:90}};
 const quotes=Object.fromEntries(['a','b','c'].map((id,i)=>[id,{id,speaker:i===1?'Interviewer':'Gast',start:i*2,end:i*2+2,text:'Dit is een proef.',nl:'Dit is een proef.'}]));
 const block={id:'b',title:'Test',clipIds:['a','b','c']},m={teaser:['a'],blocks:[block],edits:{}};
 const cat={...catalog,duration:8,quotes,catalog:{quoteverhaal:[block],gespreksmontage:[block]}};
 return {catalog:cat,state:{version:1,revision:0,mode:'quoteverhaal',target:300,guestFrames:frames,modes:{quoteverhaal:structuredClone(m),gespreksmontage:structuredClone(m)}}};
}
test('own frames require wide and strict valid 16:9; optional frames can be omitted',()=>{
 const {catalog:c,state:s}=tripleFixture();validateGuestFrames(s.guestFrames,c);validateGuestFrames({wide:s.guestFrames.wide},c);
 for(const f of [null,{},[],{medium:s.guestFrames.medium},{wide:undefined},{wide:{x:0,y:0,width:100,height:100}},{...s.guestFrames,wrong:s.guestFrames.wide},{wide:{x:900,y:0,width:160,height:90}}])assert.throws(()=>validateGuestFrames(f,c));
 assert.throws(()=>validateGuestFrames(s.guestFrames,{...c,hasVideo:false}));
});
test('automatic cycle uses only configured frames in timeline order in both modes, including teasers',()=>{
 const {catalog:c,state:s}=tripleFixture();const modes=structuredClone(s.modes);
 for(const mode of ['quoteverhaal','gespreksmontage']){s.mode=mode;const clips=exportPlan(s,c).events.filter(e=>e.kind==='clip');assert.deepEqual(clips.map(e=>e.framing.shot),['wide','medium','close','wide']);for(const e of clips){assert.deepEqual(e.framing.crop,{...s.guestFrames[e.framing.shot],contain:true});assert.equal(e.framing.fullFrame,false);}}
 delete s.guestFrames.medium;s.mode='quoteverhaal';assert.deepEqual(guestFrameChoices(s),['wide','close']);assert.deepEqual(exportPlan(s,c).events.filter(e=>e.kind==='clip').map(e=>e.framing.shot),['wide','close','wide','close']);delete s.guestFrames.close;assert.ok(exportPlan(s,c).events.filter(e=>e.kind==='clip').every(e=>e.framing.shot==='wide'));assert.deepEqual(s.modes,modes);
});
test('manual choice is local to mode and fragment place; removal falls back to wide and cached exports become stale',()=>{
 const {catalog:c,state:s}=tripleFixture(),old=montageSignature(s,c);s.modes.quoteverhaal.edits['b:a']={start:0,end:2,nl:'Dit is een proef.',translationReviewed:false,shot:'close'};
 assert.equal(resolveFraming(s,c,'a','b').shot,'close');assert.equal(resolveFraming(s,c,'a','teaser').shot,'wide');assert.equal(resolveFraming({...s,mode:'gespreksmontage'},c,'a','b').shot,'medium');assert.notEqual(montageSignature(s,c),old);
 const saved=JSON.parse(JSON.stringify(s));assert.equal(resolveFraming(saved,c,'a','b').shot,'close');delete saved.guestFrames.close;assert.equal(resolveFraming(saved,c,'a','b').shot,'wide');assert.match(resolveFraming(saved,c,'a','b').reason,/niet ingesteld/);
 const changed=JSON.parse(JSON.stringify(s));changed.guestFrames.close.x+=10;assert.notEqual(montageSignature(changed,c),montageSignature(s,c));delete s.modes.quoteverhaal.edits['b:a'];assert.equal(montageSignature(s,c),old);
});
