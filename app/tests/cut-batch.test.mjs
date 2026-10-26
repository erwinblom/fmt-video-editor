import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {cutBatch,batchTasks,batchIsRunning,changedCutTasks} from '../cut-batch.mjs';
import {reviewSnapshot} from '../public/export-status.mjs';
import {cutProposalService} from '../cut-proposal-service.mjs';
const catalog={imported:true,hasVideo:true,duration:30,title:'Proef',framing:{source:{width:320,height:180},image:{x:208,y:32,width:1504,height:846},caption:{x:200,y:916,width:1520,height:128},presets:{}},quotes:Object.fromEntries([['a',2,6],['b',12,16],['c',20,24]].map(([id,start,end])=>[id,{id,start,end,nl:'Een proef.',text:'An example.',speaker:'Gast'}])),words:[2,12,20].flatMap(start=>[{text:'An',start:start+.16,end:start+.6},{text:'example.',start:start+3.3,end:start+3.82}]),catalog:{quoteverhaal:[{id:'one'},{id:'two'}],gespreksmontage:[{id:'one'},{id:'two'}]}};
function fixture(t,options={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-batch-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'data'));const source=path.join(root,'source.mp4');fs.writeFileSync(source,'source');const file=path.join(root,'data/montages.json'),mode=()=>({teaser:['a'],blocks:[{id:'one',title:'Eerste',clipIds:['a','b']},{id:'two',title:'Slot',clipIds:['c']}],edits:{},subtitleLanguage:'nl'});const state={version:1,target:300,mode:'quoteverhaal',revision:2,guestFrames:{wide:{x:0,y:0,width:320,height:180}},modes:{quoteverhaal:mode(),gespreksmontage:mode()}};const save=()=>fs.writeFileSync(file,JSON.stringify(state));save();const calls=[];let gate=options.gate;
 const factory=()=>{let task;const core=cutProposalService('',root,catalog,source,{}, {evidence:async(p,input)=>{task=input;return {silences:[{start:Math.max(0,p.context.q.start-.3),end:p.context.q.start+.14},{start:p.context.q.end-.15,end:p.context.q.end+.3}]};},model:async(dir,work)=>work(async(prompt,tokens,schema)=>({candidate:options.keep?.(task)?'keep':schema.properties.candidate.enum[1]||'keep',reason:'Een kleine verbetering.',confidence:'medium'})),render:async()=>({key:'a'.repeat(64),captionDraft:false})});return {...core,async generate(input){calls.push(input.kind+':'+input.blockId+':'+input.id);if(gate){const wait=gate;gate=null;await wait;}if(options.fail?.(input))throw Error('OpenAI is niet bereikbaar.');return core.generate(input);}};};
 const batch=()=>cutBatch('',root,catalog,source,{}, {service:factory,delayMs:options.delayMs??0});const input=()=>{const s=JSON.parse(fs.readFileSync(file));return {mode:s.mode,revision:s.revision};};return {root,file,state,save,batch,input,calls,core:factory,jobFile:path.join(root,'data/cut-proposals/batch-quoteverhaal.json')};
}
test('tasks cover every audio occurrence before all movable pictures, including chapter-ending quotes',t=>{
 const f=fixture(t),tasks=batchTasks(f.state,catalog);assert.equal(tasks.length,6);assert.deepEqual(tasks.map(t=>t.kind),['audio','audio','audio','audio','visual','visual']);assert.ok(tasks.some(t=>t.kind==='visual'&&t.id==='b'));assert.ok(!tasks.some(t=>t.kind==='visual'&&t.id==='c'));assert.equal(batchTasks(f.state,{...catalog,hasVideo:false}).length,4);
});
test('one call processes the entire montage, filters unchanged results, preserves state and reviews, and reopens',async t=>{
 const f=fixture(t,{keep:i=>i.kind==='audio'&&i.id==='b'}),before=fs.readFileSync(f.file);f.batch().start(f.input());await f.batch().settled();const view=f.batch().read();assert.equal(view.status,'complete');assert.equal(view.totals.total,6);assert.equal(view.totals.proposals,5);assert.equal(view.totals.unchanged,1);assert.ok(f.calls.slice(0,4).every(x=>x.startsWith('audio:')));assert.ok(f.calls.slice(4).every(x=>x.startsWith('visual:')));assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(fs.existsSync(path.join(f.root,'data/review-baseline.json')),false);const count=f.calls.length;f.batch().start(f.input());await f.batch().settled();assert.equal(f.calls.length,count);assert.equal(f.batch().read().totals.proposals,5);
});
test('a skipped proposal and adjusted draft stay out of the worklist after reopening',async t=>{
 const f=fixture(t);f.batch().start(f.input());await f.batch().settled();const task=f.batch().read().tasks.find(t=>t.status==='ready'),svc=f.core(),before=fs.readFileSync(f.file),input={...f.input(),...task};svc.decide({...input,action:'draft',draft:{start:task.result.current.start+.04,end:task.result.current.end}});svc.decide({...input,action:'skip'});let view=f.batch().read();assert.equal(view.tasks.find(t=>t.taskId===task.taskId).status,'skipped');assert.deepEqual(fs.readFileSync(f.file),before);f.batch().start(f.input());await f.batch().settled();view=f.batch().read();assert.equal(view.totals.skipped,1);assert.equal(view.totals.proposals,5);
});
test('approving audio automatically rechecks only affected pictures; never undoes that approval',async t=>{
 const f=fixture(t);f.batch().start(f.input());await f.batch().settled();const view=f.batch().read(),task=view.tasks.find(t=>t.kind==='audio'&&t.blockId==='one'&&t.id==='a'),svc=f.core(),input={...f.input(),id:task.id,blockId:task.blockId,kind:task.kind,key:task.key,batchId:view.id,draft:task.result.draft};const preview=await svc.preview(input),before=JSON.parse(fs.readFileSync(f.file)),response=svc.decide({...input,action:'apply',proof:preview.proof}),count=f.calls.length;
 f.batch().refreshAfterDecision({...input,action:'apply'},response,before);await f.batch().settled();const after=f.batch().read();assert.equal(after.tasks.find(t=>t.taskId===task.taskId).status,'applied');assert.ok(f.calls.slice(count).length>0);assert.ok(f.calls.slice(count).every(x=>x.startsWith('visual:')));assert.ok(f.calls.slice(count).every(x=>x==='visual:one:a'));assert.deepEqual(JSON.parse(fs.readFileSync(f.file)).modes.gespreksmontage,f.state.modes.gespreksmontage);
});
test('duplicate starts never create simultaneous jobs; stopping and resuming keeps completed work',async t=>{
 let release;const gate=new Promise(r=>release=r),f=fixture(t,{gate});const first=f.batch().start(f.input()),second=f.batch().start(f.input());assert.equal(first.id,second.id);await Promise.resolve();assert.equal(batchIsRunning(f.root),true);f.batch().stop({...f.input(),batchId:first.id});release();await f.batch().settled();assert.equal(f.batch().read().status,'stopped');assert.equal(batchIsRunning(f.root),false);assert.equal(f.calls.length,1);f.batch().start(f.input());await f.batch().settled();assert.equal(f.batch().read().status,'complete');assert.equal(f.calls.length,6);
});
test('interruption is explicit and resumable; completed proposals are not regenerated',async t=>{
 const f=fixture(t);f.batch().start(f.input());await f.batch().settled();const job=JSON.parse(fs.readFileSync(f.jobFile));job.status='running';fs.writeFileSync(f.jobFile,JSON.stringify(job));assert.equal(f.batch().read().status,'interrupted');const count=f.calls.length;f.batch().start(f.input());await f.batch().settled();assert.equal(f.calls.length,count);assert.equal(f.batch().read().status,'complete');
});
test('provider failure stops further paid requests and does not falsely report a complete round',async t=>{
 const f=fixture(t,{fail:()=>true}),before=fs.readFileSync(f.file);f.batch().start(f.input());await f.batch().settled();const view=f.batch().read();assert.equal(f.calls.length,1);assert.equal(view.status,'interrupted');assert.equal(view.totals.errors,1);assert.ok(view.totals.pending>0);assert.deepEqual(fs.readFileSync(f.file),before);
});
test('other montage modes, stale revisions and removed occurrences never overwrite prior choices',async t=>{
 const f=fixture(t);assert.throws(()=>f.batch().start({...f.input(),revision:0}),/gewijzigd/);assert.throws(()=>f.batch().start({...f.input(),mode:'gespreksmontage'}),/gewijzigd/);f.batch().start(f.input());await f.batch().settled();f.state.modes.quoteverhaal.blocks[0].clipIds=['a'];f.state.revision++;f.save();const view=f.batch().read();assert.ok(!view.tasks.some(t=>t.id==='b'));assert.ok(view.tasks.some(t=>t.id==='a'&&t.kind==='visual'&&t.status==='pending'));f.state.mode='gespreksmontage';f.save();assert.equal(f.batch().read().status,'none');
});
test('unrelated metadata and visual edits keep completed audio judgments valid',async t=>{
 const f=fixture(t,{keep:i=>i.kind==='audio'});f.batch().start(f.input());await f.batch().settled();f.state.modes.quoteverhaal.blocks[0].title='Nieuwe titel';f.state.modes.quoteverhaal.edits['one:a']={start:2,end:6,nl:'Een proef.',translationReviewed:false,transition:{nextId:'b',frames:-4}};f.state.revision++;f.save();const view=f.batch().read();assert.ok(view.tasks.filter(t=>t.kind==='audio').every(t=>t.status==='unchanged'));assert.ok(view.tasks.some(t=>t.kind==='visual'&&t.status==='pending'));
});
test('resuming after a provider failure retries missing work while reusing finished judgments',async t=>{
 let fail=true;const f=fixture(t,{fail:i=>fail&&i.kind==='audio'&&i.id==='b'});f.batch().start(f.input());await f.batch().settled();assert.equal(f.batch().read().status,'interrupted');assert.equal(f.calls.length,3);fail=false;f.batch().start(f.input());await f.batch().settled();assert.equal(f.batch().read().status,'complete');assert.equal(f.calls.filter(x=>x==='audio:teaser:a').length,1);assert.equal(f.calls.filter(x=>x==='audio:one:a').length,1);
});

function approveFixture(f){
 const source=path.join(f.root,'source.mp4'),stat=fs.statSync(source),file=path.join(f.root,'data/review-baseline.json');
 fs.writeFileSync(file,JSON.stringify({version:1,source:{path:source,bytes:stat.size,modified:stat.mtimeMs},modes:Object.fromEntries(Object.keys(f.state.modes).map(mode=>[mode,reviewSnapshot({...f.state,mode},catalog)]))}));return file;
}
test('valid previous reviews suppress all requests and preserve the montage and receipts',async t=>{
 const f=fixture(t),receipt=approveFixture(f),before=fs.readFileSync(receipt),state=fs.readFileSync(f.file);
 f.batch().start(f.input());await f.batch().settled();const view=f.batch().read();
 assert.equal(view.status,'complete');assert.equal(view.totals.reviewed,6);assert.equal(view.totals.proposals,0);assert.equal(f.calls.length,0);assert.equal(view.totals.skipped,0);assert.deepEqual(fs.readFileSync(receipt),before);assert.deepEqual(fs.readFileSync(f.file),state);
});
test('a valid review outranks older ready proposals without making a human skip decision',async t=>{
 const f=fixture(t);f.batch().start(f.input());await f.batch().settled();assert.equal(f.batch().read().totals.proposals,6);approveFixture(f);
 const view=f.batch().read();assert.equal(view.totals.proposals,0);assert.equal(view.totals.reviewed,6);assert.equal(view.totals.skipped,0);
 const count=f.calls.length;f.batch().start(f.input());await f.batch().settled();assert.equal(f.calls.length,count);assert.equal(f.batch().read().totals.reviewed,6);
});
test('only the relevant domain and neighbors reopen after editing; mode and occurrence stay separate',async t=>{
 const f=fixture(t);approveFixture(f);f.state.modes.quoteverhaal.edits['one:a']={start:2.04,end:6,nl:'Een proef.'};f.state.revision++;f.save();
 let view=f.batch().read();assert.deepEqual(view.tasks.filter(t=>t.status==='pending').map(t=>t.taskId),['audio:one:a','visual:one:a','visual:one:b']);
 f.batch().start(f.input());await f.batch().settled();assert.deepEqual(f.calls,['audio:one:a','visual:one:a','visual:one:b']);
 f.state.mode='gespreksmontage';f.save();view=f.batch().read();assert.equal(view.totals.reviewed,6);assert.equal(view.totals.proposals,0);
});
test('title and element changes preserve approvals; picture edits do not reopen audio',t=>{
 const f=fixture(t);approveFixture(f);f.state.modes.quoteverhaal.blocks[0].title='Nieuw hoofdstuk';f.state.modes.quoteverhaal.edits['one:a']={start:2,end:6,nl:'Een proef.',translationReviewed:false,element:{type:'statement',layout:'side',start:0,end:3,text:'Een kernzin',value:'',label:'',source:'',assetId:null,artworkId:'a'.repeat(64)}};f.state.revision++;f.save();assert.equal(f.batch().read().totals.reviewed,6);
 f.state.guestFrames.wide={x:4,y:0,width:288,height:162};f.save();const view=f.batch().read();assert.equal(view.totals.reviewed,4);assert.ok(view.tasks.filter(t=>t.status==='pending').every(t=>t.kind==='visual'));
});
test('changed source invalidates checks, and returning to checked content restores them',t=>{
 const f=fixture(t);approveFixture(f);f.state.modes.quoteverhaal.edits['one:a']={start:2.04,end:6,nl:'Een proef.'};f.save();assert.ok(f.batch().read().totals.pending>0);f.state.modes.quoteverhaal.edits={};f.save();assert.equal(f.batch().read().totals.reviewed,6);
 fs.appendFileSync(path.join(f.root,'source.mp4'),'changed');assert.equal(f.batch().read().totals.reviewed,0);assert.equal(f.batch().read().totals.pending,6);
});
test('explicit full reassessment has a separate persisted list and never changes previous approvals',async t=>{
 const f=fixture(t),receipt=approveFixture(f),before=fs.readFileSync(receipt);f.batch().start(f.input());await f.batch().settled();const normalId=f.batch().read().id;
 f.batch().start({...f.input(),scope:'full'});await f.batch().settled('full');const full=f.batch().read({scope:'full'});assert.equal(full.status,'complete');assert.equal(full.totals.proposals,6);assert.equal(full.totals.reviewed,0);assert.notEqual(full.id,normalId);assert.equal(f.batch().read().totals.proposals,0);assert.equal(f.batch().read().totals.reviewed,6);assert.deepEqual(fs.readFileSync(receipt),before);
 const task=full.tasks[0],svc=f.core();svc.decide({...f.input(),...task,action:'skip'});assert.equal(f.batch().refreshAfterDecision({action:'skip',batchId:full.id},{}).totals.skipped,1);assert.equal(f.batch().read().totals.reviewed,5);assert.equal(f.batch().read().totals.proposals,0);
 const count=f.calls.length;f.batch().start({...f.input(),scope:'full'});await f.batch().settled('full');assert.equal(f.calls.length,count);assert.throws(()=>f.batch().read({scope:'bad'}),/Kies/);
});
test('normal and full reassessment cannot run concurrently',async t=>{
 let release;const gate=new Promise(r=>release=r),f=fixture(t,{gate});f.batch().start({...f.input(),scope:'full'});await Promise.resolve();assert.equal(batchIsRunning(f.root),true);assert.throws(()=>f.batch().start(f.input()),/loopt al/);const full=f.batch().read({scope:'full'});f.batch().stop({...f.input(),scope:'full',batchId:full.id});release();await f.batch().settled('full');assert.equal(batchIsRunning(f.root),false);assert.equal(f.batch().read({scope:'full'}).status,'stopped');
});

test('approving in the separate full round refreshes that round and leaves ordinary checks leading',async t=>{
 const f=fixture(t);approveFixture(f);f.batch().start({...f.input(),scope:'full'});await f.batch().settled('full');const full=f.batch().read({scope:'full'}),task=full.tasks.find(t=>t.kind==='audio'&&t.id==='a'&&t.blockId==='one'),svc=f.core(),input={...f.input(),...task,batchId:full.id,draft:task.result.draft};const preview=await svc.preview(input),before=JSON.parse(fs.readFileSync(f.file)),response=svc.decide({...input,action:'apply',proof:preview.proof});
 f.batch().refreshAfterDecision({...input,action:'apply'},response,before);await f.batch().settled('full');const after=f.batch().read({scope:'full'});assert.equal(after.id,full.id);assert.equal(after.scope,'full');assert.equal(after.tasks.find(t=>t.taskId===task.taskId).status,'applied');const normal=f.batch().read();assert.equal(normal.totals.proposals,2);assert.ok(normal.tasks.filter(t=>t.status==='ready').every(t=>t.kind==='visual'));assert.ok(['reviewed','applied'].includes(normal.tasks.find(t=>t.taskId===task.taskId).status));assert.equal(normal.totals.pending,0);
});

function manualCut(f,patch={start:2.04,end:6},ref='one:a'){
 const before=JSON.parse(fs.readFileSync(f.file));f.state.modes[f.state.mode].edits[ref]={start:2,end:6,nl:'Een proef.',translationReviewed:false,...f.state.modes[f.state.mode].edits[ref],...patch};f.state.revision++;f.save();return {before,after:structuredClone(f.state)};
}
test('automatic work includes only an existing changed range and affected pictures, also before a chapter card',t=>{
 const f=fixture(t),{before,after}=manualCut(f);assert.deepEqual(changedCutTasks(before,after,catalog),['audio:one:a','visual:one:a','visual:one:b']);
 const audioBefore=structuredClone(before),audioAfter=structuredClone(after);delete audioBefore.guestFrames;delete audioAfter.guestFrames;assert.deepEqual(changedCutTasks(audioBefore,audioAfter,{...catalog,hasVideo:false}),['audio:one:a']);
 const copy=structuredClone(before);copy.modes.quoteverhaal.edits['one:b']={start:12,end:15.96,nl:'Een proef.',translationReviewed:false};assert.ok(changedCutTasks(before,copy,catalog).includes('visual:one:b'));
 copy.mode='gespreksmontage';assert.deepEqual(changedCutTasks(before,copy,catalog),[]);
});
test('title, element, subtitle and picture-only edits never trigger automatic cut requests',t=>{
 const f=fixture(t),before=structuredClone(f.state);f.state.modes.quoteverhaal.blocks[0].title='Nieuw';f.state.modes.quoteverhaal.edits['one:a']={start:2,end:6,nl:'Nieuwe tekst.',translationReviewed:false};f.state.guestFrames.wide={x:4,y:0,width:288,height:162};f.save();assert.equal(f.batch().afterManualEdit(before,f.state),null);assert.equal(fs.existsSync(f.jobFile),false);assert.equal(f.calls.length,0);
});
test('automatic work does not expand to unrelated unchecked occurrences and never changes state or receipts',async t=>{
 const f=fixture(t),{before,after}=manualCut(f),saved=fs.readFileSync(f.file);f.batch().afterManualEdit(before,after);await f.batch().settled();const view=f.batch().read();assert.deepEqual(f.calls,['audio:one:a','visual:one:a','visual:one:b']);assert.equal(view.totals.deferred,3);assert.equal(view.totals.proposals,3);assert.equal(view.automatic,true);assert.deepEqual(fs.readFileSync(f.file),saved);assert.equal(fs.existsSync(path.join(f.root,'data/review-baseline.json')),false);
 const reopened=f.batch().read();assert.equal(reopened.totals.proposals,3);f.batch().start(f.input());await f.batch().settled();assert.equal(f.calls.length,6);assert.equal(f.batch().read().totals.deferred,0);
});
test('fast frame clicks are coalesced and only the final saved range is assessed',async t=>{
 const f=fixture(t,{delayMs:20});approveFixture(f);let edit=manualCut(f);f.batch().afterManualEdit(edit.before,edit.after);edit=manualCut(f,{start:2.08,end:6});f.batch().afterManualEdit(edit.before,edit.after);edit=manualCut(f,{start:2.12,end:6});f.batch().afterManualEdit(edit.before,edit.after);assert.equal(f.calls.length,0);await f.batch().settled();assert.deepEqual(f.calls,['audio:one:a','visual:one:a','visual:one:b']);assert.equal(f.batch().read().tasks.find(t=>t.taskId==='audio:one:a').result.current.start,2.12);
});
test('additional cuts during an active automatic round join without processing unrelated items',async t=>{
 let release;const gate=new Promise(r=>release=r),f=fixture(t,{gate});let edit=manualCut(f);f.batch().afterManualEdit(edit.before,edit.after);await Promise.resolve();await Promise.resolve();edit=manualCut(f,{start:20,end:23.96},'two:c');f.batch().afterManualEdit(edit.before,edit.after);release();await f.batch().settled();assert.ok(f.calls.includes('audio:two:c'));assert.ok(!f.calls.includes('audio:teaser:a'));assert.ok(!f.calls.includes('audio:one:b'));assert.equal(new Set(f.calls).size,f.calls.length);
});
test('undo before the waiting period ends restores existing reviews without any model call',async t=>{
 const f=fixture(t,{delayMs:20});approveFixture(f);const edit=manualCut(f);f.batch().afterManualEdit(edit.before,edit.after);const changed=structuredClone(f.state);
 fs.writeFileSync(f.file,JSON.stringify(edit.before));f.batch().afterManualEdit(changed,edit.before);await f.batch().settled();assert.equal(f.calls.length,0);assert.equal(f.batch().read().totals.reviewed,6);
});
test('automatic interruption is visible and targeted resume never assesses unrelated unchecked cuts',async t=>{
 let fail=true;const f=fixture(t,{fail:()=>fail}),edit=manualCut(f);f.batch().afterManualEdit(edit.before,edit.after);await f.batch().settled();assert.equal(f.batch().read().status,'interrupted');assert.equal(f.calls.length,1);fail=false;f.batch().start({...f.input(),targeted:true});await f.batch().settled();assert.ok(!f.calls.includes('audio:teaser:a'));assert.ok(!f.calls.includes('audio:one:b'));assert.equal(f.batch().read().totals.deferred,3);
});
test('automatic work waits for explicit full work and remains stoppable while waiting',async t=>{
 let release;const gate=new Promise(r=>release=r),f=fixture(t,{gate});f.batch().start({...f.input(),scope:'full'});await Promise.resolve();await Promise.resolve();const edit=manualCut(f);f.batch().afterManualEdit(edit.before,edit.after);const auto=f.batch().read();assert.equal(auto.inFlight,true);assert.equal(f.calls.length,1);f.batch().stop({...f.input(),batchId:auto.id});release();await f.batch().settled('full');await f.batch().settled();assert.equal(f.batch().read().status,'stopped');assert.equal(batchIsRunning(f.root),false);
});

test('editing the same cut during an in-flight request discards the old reply and assesses the latest saved range',async t=>{
 let release;const gate=new Promise(r=>release=r),f=fixture(t,{gate});approveFixture(f);let edit=manualCut(f);f.batch().afterManualEdit(edit.before,edit.after);await Promise.resolve();await Promise.resolve();assert.equal(f.calls.length,1);edit=manualCut(f,{start:2.16,end:6});f.batch().afterManualEdit(edit.before,edit.after);release();await f.batch().settled();const view=f.batch().read();assert.equal(view.status,'complete');assert.equal(view.totals.errors,0);assert.equal(view.tasks.find(t=>t.taskId==='audio:one:a').result.current.start,2.16);assert.equal(f.calls.filter(x=>x==='audio:one:a').length,2);assert.ok(f.calls.every(x=>['audio:one:a','visual:one:a','visual:one:b'].includes(x)));
});
