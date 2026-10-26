import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reviewService} from '../review-service.mjs';
import {auditService} from '../audio-audit.mjs';
import {reviewSnapshot,montageReview} from '../public/export-status.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/example-catalog.json',import.meta.url)));
function fixture(t,withBaseline=true){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-human-review-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'data'));const source=path.join(root,'source.wav');fs.writeFileSync(source,'original');
 const mode=()=>({blocks:structuredClone(catalog.catalog.quoteverhaal),teaser:catalog.teaserCandidates.slice(0,1),edits:{},subtitleLanguage:'nl'}),state={revision:3,mode:'quoteverhaal',modes:{quoteverhaal:mode(),gespreksmontage:mode()}};
 const stateFile=path.join(root,'data/montages.json'),reviewFile=path.join(root,'data/review-baseline.json'),auditFile=path.join(root,'data/audio-audit.json');const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state));save();
 if(withBaseline){const stat=fs.statSync(source);fs.writeFileSync(reviewFile,JSON.stringify({version:1,source:{path:source,bytes:stat.size,modified:stat.mtimeMs},modes:{[state.mode]:reviewSnapshot(state,catalog)}}));}
 const service=()=>reviewService(root,catalog,source),read=()=>auditService('',root,catalog,source).read(),check=()=>montageReview(state,catalog,read());
 const payload=(kind,key)=>{const item=reviewSnapshot(state,catalog).items.find(x=>x.key===key);return {kind,id:item.id,blockId:item.blockId,mode:state.mode,revision:state.revision,sourceToken:service().decorate({status:'none'}).reviewSourceToken,signature:JSON.stringify(item[kind])};};
 return {root,source,state,stateFile,reviewFile,auditFile,save,service,read,check,payload};
}
test('approve audio and picture separately; survive reopening without writing the montage',t=>{
 const f=fixture(t),item=reviewSnapshot(f.state,catalog).items[2];f.state.modes.quoteverhaal.edits[item.key]={start:item.audio.start+.04};f.state.revision++;f.save();const before=fs.readFileSync(f.stateFile),others=JSON.parse(fs.readFileSync(f.reviewFile)).modes.quoteverhaal.items.filter(x=>x.key!==item.key);
 f.service().confirm(f.payload('audio',item.key));let current=f.check().items.find(x=>x.key===item.key);assert.equal(current.audio,true);assert.equal(current.audioHuman,true);assert.equal(current.visual,false);
 f.service().confirm(f.payload('visual',item.key));current=f.check().items.find(x=>x.key===item.key);assert.equal(current.audio,true);assert.equal(current.visual,true);assert.equal(current.visualHuman,true);assert.deepEqual(fs.readFileSync(f.stateFile),before);
 assert.deepEqual(JSON.parse(fs.readFileSync(f.reviewFile)).modes.quoteverhaal.items.filter(x=>x.key!==item.key),others);assert.ok(fs.readdirSync(path.join(f.root,'data/herstel')).length>=1);
});
test('a frame change returns only the picture warning, and restoring it restores the human approval',t=>{
 const f=fixture(t),items=reviewSnapshot(f.state,catalog).items,item=items.find((x,i)=>items[i+1]?.blockId===x.blockId),next=items[items.indexOf(item)+1];f.service().confirm(f.payload('visual',item.key));f.state.modes.quoteverhaal.edits[item.key]={transition:{nextId:next.id,frames:-3}};f.save();let q=f.check().items.find(x=>x.key===item.key);assert.equal(q.audio,true);assert.equal(q.visual,false);delete f.state.modes.quoteverhaal.edits[item.key];f.save();assert.equal(f.check().items.find(x=>x.key===item.key).visual,true);
});
test('audio edits return audio warnings; titles and elements do not revoke confirmation',t=>{
 const f=fixture(t),item=reviewSnapshot(f.state,catalog).items[2];f.service().confirm(f.payload('audio',item.key));f.state.modes.quoteverhaal.blocks[0].title='New title';f.state.modes.quoteverhaal.edits[item.key]={element:{type:'statement',text:'Card'}};f.state.revision++;f.save();assert.equal(f.check().items.find(x=>x.key===item.key).audio,true);f.state.modes.quoteverhaal.edits[item.key].nl='New words';f.save();assert.equal(f.check().items.find(x=>x.key===item.key).audio,false);
});
test('reject stale revision, mode, fingerprint, source and unknown occurrences without changing the receipt',t=>{
 const f=fixture(t),item=reviewSnapshot(f.state,catalog).items[0],p=f.payload('audio',item.key),before=fs.readFileSync(f.reviewFile);for(const bad of [{...p,revision:2},{...p,mode:'gespreksmontage'},{...p,signature:'old'},{...p,sourceToken:'old'},{...p,id:'unknown'},{...p,kind:'both'}])assert.throws(()=>f.service().confirm(bad));assert.deepEqual(fs.readFileSync(f.reviewFile),before);fs.appendFileSync(f.source,'replacement');assert.throws(()=>f.service().confirm(p),/bron/);assert.deepEqual(fs.readFileSync(f.reviewFile),before);
});
test('a first approval never approves other occurrences, domains or montage modes',t=>{
 const f=fixture(t,false),item=reviewSnapshot(f.state,catalog).items[0];f.service().confirm(f.payload('audio',item.key));let q=f.check().items.find(x=>x.key===item.key);assert.equal(q.audio,true);assert.equal(q.visual,false);assert.ok(f.check().items.filter(x=>x.key!==item.key).every(x=>!x.audio&&!x.visual));f.state.mode='gespreksmontage';f.save();assert.equal(f.check().audioComplete,false);
});
test('manual audio review resolves its current audit finding without falsifying the original report; a new audit can raise it again',t=>{
 const f=fixture(t),item=reviewSnapshot(f.state,catalog).items[0],job={id:'audit-one',status:'review',mode:f.state.mode,issues:[{key:item.key,resolved:false}]};fs.writeFileSync(f.auditFile,JSON.stringify(job));assert.equal(f.check().items.find(x=>x.key===item.key).audio,false);f.service().confirm(f.payload('audio',item.key));assert.equal(f.check().items.find(x=>x.key===item.key).audio,true);assert.equal(f.read().status,'ready');auditService('',f.root,catalog,f.source).assertReady();assert.equal(JSON.parse(fs.readFileSync(f.auditFile)).issues[0].resolved,false);job.id='audit-two';fs.writeFileSync(f.auditFile,JSON.stringify(job));assert.equal(f.check().items.find(x=>x.key===item.key).audio,false);
});
test('source replacement resets reviews in both domains and other modes; running audit blocks confirmation',t=>{
 const f=fixture(t),item=reviewSnapshot(f.state,catalog).items[0];fs.appendFileSync(f.source,'new source');f.service().confirm(f.payload('visual',item.key));let q=f.check().items.find(x=>x.key===item.key);assert.equal(q.visual,true);assert.equal(q.audio,false);assert.ok(f.check().items.filter(x=>x.key!==item.key).every(x=>!x.audio&&!x.visual));fs.writeFileSync(f.auditFile,JSON.stringify({status:'running'}));const before=fs.readFileSync(f.reviewFile);assert.throws(()=>f.service().confirm(f.payload('audio',item.key)),/lopende/);assert.deepEqual(fs.readFileSync(f.reviewFile),before);
});
