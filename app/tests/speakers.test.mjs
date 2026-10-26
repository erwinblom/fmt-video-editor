import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {speakerSummary,mayProposeQuote,mayProposeTeaser} from '../public/speakers.mjs';
import {speakerJobs} from '../speaker-jobs.mjs';
const catalog={imported:true,speakers:{status:'complete',voices:[{id:'a',label:'Stem 1',name:'Interviewer',role:'interviewer'},{id:'b',label:'Stem 2',name:'Gast',role:'guest'}],turns:[{speakerId:'a',start:0,end:2},{speakerId:'b',start:2,end:12}]}};
test('Role mapping controls guest-only proposals; mixed questions stay excluded',()=>{assert.equal(mayProposeQuote(catalog,{start:2,end:12}),true);assert.equal(mayProposeQuote(catalog,{start:0,end:12}),false);assert.equal(speakerSummary(catalog,{start:0,end:12}).label,'Interviewer + Gast');assert.equal(speakerSummary(catalog,{start:0,end:12}).role,'mixed');assert.equal(mayProposeQuote(catalog,{start:12,end:15}),false);});
test('Unknown voices and short interruptions never become guest-only',()=>{const c=structuredClone(catalog);c.speakers.voices[1].role='unknown';assert.equal(mayProposeQuote(c,{start:2,end:12}),false);c.speakers.voices[1].role='guest';c.speakers.turns.push({speakerId:'a',start:5,end:5.2});assert.equal(mayProposeQuote(c,{start:2,end:12}),false);});
test('Speaker mapping and turn corrections persist independently from montage; stale writes rejected',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-speaker-test-'));try{fs.mkdirSync(path.join(root,'data'));const d={...catalog.speakers,revision:1,turns:catalog.speakers.turns.map((t,i)=>({...t,id:'turn'+i,detectedSpeakerId:t.speakerId}))};fs.writeFileSync(path.join(root,'data/speakers.json'),JSON.stringify(d));fs.writeFileSync(path.join(root,'data/montages.json'),'keep');const jobs=speakerJobs(root,root),input={revision:1,voices:d.voices.map(v=>({...v,name:v.name+' test'})),corrections:{turn0:'b'}};const saved=jobs.save(input);assert.equal(saved.revision,2);assert.equal(jobs.read().turns[0].speakerId,'b');assert.equal(jobs.read().turns[0].detectedSpeakerId,'a');assert.equal(fs.readFileSync(path.join(root,'data/montages.json'),'utf8'),'keep');assert.throws(()=>jobs.save(input),/ander venster/);assert.throws(()=>jobs.save({...input,revision:2,corrections:{nope:'b'}}),/Ongeldige/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
import {buildThematicProposal} from '../public/proposals.mjs';
test('Guest proposals exclude questions and mixed passages, conversation retains them',()=>{const c={...structuredClone(catalog),title:'Interview',duration:80,analysis:{id:'test'},quotes:{g:{id:'g',speaker:'Spreker',text:'Antwoord.',start:3,end:11},q:{id:'q',speaker:'Spreker',text:'Vraag?',start:0,end:1},mix:{id:'mix',speaker:'Spreker',text:'Vraag en antwoord.',start:0,end:11}},catalog:{quoteverhaal:[{id:'b',clipIds:['q','g','mix']}],gespreksmontage:[{id:'b',clipIds:['q','g','mix']}]}};const bank={kind:'thematic',id:'test',sourceTitle:c.title,units:Object.values(c.quotes).map((q,i)=>({id:q.id,blockId:'b',priority:90,standalone:true,sourceOrder:i,clips:[q]}))};const m=buildThematicProposal({mode:'quoteverhaal'},c,bank,80);assert.deepEqual(m.blocks[0].clipIds,['g']);assert.deepEqual(m.teaser,['g']);const conversation=buildThematicProposal({mode:'gespreksmontage'},c,bank,80);assert.equal(conversation.blocks[0].clipIds.length,3);c.speakers.voices[1].role='unknown';assert.throws(()=>buildThematicProposal({mode:'quoteverhaal'},c,bank,80),/Koppel eerst/);});
import {edgeWords,sourceText} from '../public/model.mjs';
test('Display names and roles cannot hide source words in an imported mixed passage',()=>{const c={imported:true,words:[{speaker:'old guest',start:0,end:1,text:' Hallo'},{speaker:'old interviewer',start:1,end:2,text:' ja'}]};const q={speaker:'Spreker',start:0,end:2,sourceStart:0,sourceEnd:2};assert.equal(edgeWords(c,q).length,2);assert.equal(sourceText(c,q),'Hallo ja');});

test('teasers allow only short overlapping interviewer responses while keeping the mixed label',()=>{
 const c={imported:true,speakers:{status:'complete',voices:[{id:'g',role:'guest'},{id:'i',role:'interviewer'}],turns:[{speakerId:'g',start:0,end:8},{speakerId:'i',start:3,end:3.4}]}};
 const q={start:0,end:8,text:'My agent arranged the meetings.'};assert.equal(mayProposeQuote(c,q),false);assert.equal(mayProposeTeaser(c,q),true);assert.equal(speakerSummary(c,q).role,'mixed');
 c.speakers.turns[1].end=4;assert.equal(mayProposeTeaser(c,q),false);
 c.speakers.turns=[{speakerId:'g',start:.5,end:8},{speakerId:'i',start:0,end:.4}];assert.equal(mayProposeTeaser(c,q),false);
 c.speakers.voices[1].role='unknown';assert.equal(mayProposeTeaser(c,q),false);
});

test('Demo-assistent timing: two small overlapping voices pass only the teaser check',()=>{
 const c={imported:true,speakers:{status:'complete',voices:[{id:'g',role:'guest'},{id:'i',role:'interviewer'}],turns:[{speakerId:'g',start:98.7,end:106.38},{speakerId:'i',start:102.06,end:102.48},{speakerId:'i',start:106.28,end:106.78},{speakerId:'g',start:106.51,end:106.53},{speakerId:'g',start:106.56,end:113.21}]}};
 const q={start:102.15,end:110.43,text:'We work together. Nobody can tell it is not me writing the emails.'};assert.equal(mayProposeQuote(c,q),false);assert.equal(mayProposeTeaser(c,q),true);assert.equal(speakerSummary(c,q).role,'mixed');
 c.speakers.turns.push({speakerId:'i',start:108,end:108.5});assert.equal(mayProposeTeaser(c,q),false);
});
