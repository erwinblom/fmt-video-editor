import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {cutProposalService} from '../cut-proposal-service.mjs';
import {audioOptions,cutContext,proposalDraft} from '../cut-proposal-rules.mjs';
import {montageSignature,montageReview} from '../public/export-status.mjs';
import {exportPlan} from '../export-plan.mjs';
const catalog={imported:true,hasVideo:true,duration:30,title:'Test',framing:{source:{width:320,height:180},image:{x:208,y:32,width:1504,height:846},caption:{x:200,y:916,width:1520,height:128},presets:{}},quotes:{a:{id:'a',start:2,end:6,speaker:'Gast',nl:'Een voorbeeld.',text:'An example.'},b:{id:'b',start:12,end:16,speaker:'Gast',nl:'Een tweede.',text:'A second.'},c:{id:'c',start:20,end:24,speaker:'Gast',nl:'Een slot.',text:'A close.'}},words:[{text:'An',start:2.16,end:2.6},{text:'example.',start:5.3,end:5.82}],catalog:{quoteverhaal:[{id:'one'},{id:'two'}],gespreksmontage:[{id:'one'},{id:'two'}]}};
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-cut-proposal-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const data=path.join(root,'data');fs.mkdirSync(data);const source=path.join(root,'source.mp4');fs.writeFileSync(source,'test source');
 const mode=()=>({teaser:['a'],blocks:[{id:'one',title:'Een',clipIds:['a','b']},{id:'two',title:'Twee',clipIds:['c']}],edits:{'one:a':{start:2,end:6,nl:'Een voorbeeld.',translationReviewed:true,translationRange:{start:2,end:6},shot:'medium',element:{type:'statement',text:'Voorbeeld',value:'',label:'',source:'',artworkId:'a'.repeat(64),assetId:null,start:0,end:2,layout:'side'},subtitleTiming:{start:2,end:6,text:'Een voorbeeld.',cues:[{start:2,end:6,text:'Een voorbeeld.'}]}},'one:b':{start:12,end:16,nl:'Een tweede.',translationReviewed:false,shot:'wide'}},subtitleLanguage:'nl'});
 const state={version:1,target:300,mode:'quoteverhaal',revision:4,guestFrames:{wide:{x:0,y:0,width:320,height:180},medium:{x:16,y:9,width:288,height:162}},modes:{quoteverhaal:mode(),gespreksmontage:mode()}},file=path.join(data,'montages.json');const save=()=>fs.writeFileSync(file,JSON.stringify(state));save();let calls=0,renders=0;
 const deps={evidence:async()=>({silences:[{start:1.9,end:2.14},{start:5.84,end:6.1}]}),model:async(dir,work)=>work(async(input,n,schema)=>{calls++;assert.equal(input[0].role,'user');return {candidate:schema.properties.candidate.enum[1]||'keep',reason:'Korte meetbare verbetering.',confidence:'medium'};}),render:async()=>({key:String(++renders).padStart(64,'0'),captionDraft:false})};
 const svc=()=>cutProposalService('',root,catalog,source,{},deps),input=(kind='audio',id='a',blockId='one')=>({kind,id,blockId,mode:state.mode,revision:state.revision});
 return {root,data,source,state,file,save,svc,input,reads:()=>({calls,renders}),load:()=>JSON.parse(fs.readFileSync(file))};
}
test('local audio candidates preserve word centres and require measured silence',()=>{
 const q={start:2,end:6};assert.equal(audioOptions(q,catalog.words,[],30).length,1);
 const opts=audioOptions(q,catalog.words,[{start:1.9,end:2.14},{start:5.84,end:6.1}],30);assert.ok(opts.length>1);for(const o of opts.slice(1)){assert.ok(o.start<=2.145);assert.ok(o.end>=5.835);assert.ok(Math.abs(o.start-2)<=.481&&Math.abs(o.end-6)<=.481);}
});
test('generation is cached, concurrent requests share work, and never writes montage or reviews',async t=>{
 const f=fixture(t),before=fs.readFileSync(f.file);const [a,b]=await Promise.all([f.svc().generate(f.input()),f.svc().generate(f.input())]);assert.equal(a.key,b.key);assert.equal(f.reads().calls,1);assert.equal((await f.svc().generate(f.input())).key,a.key);assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(fs.existsSync(path.join(f.data,'review-baseline.json')),false);assert.equal(a.hasChange,true);
});
test('skip and adjusted proposals survive reopening without approving or changing montage',async t=>{
 const f=fixture(t),r=await f.svc().generate(f.input()),before=fs.readFileSync(f.file),draft={start:2.04,end:6};f.svc().decide({...f.input(),key:r.key,action:'draft',draft});f.svc().decide({...f.input(),key:r.key,action:'skip'});const loaded=f.svc().read(f.input());assert.equal(loaded.decision.action,'skip');assert.deepEqual(loaded.draft,draft);assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(fs.existsSync(path.join(f.data,'review-baseline.json')),false);
});
test('preview renders independent snapshots; apply requires exact preview and preserves hand edits/modes',async t=>{
 const f=fixture(t),r=await f.svc().generate(f.input()),before=structuredClone(f.state),draft={start:2.04,end:6.04};const p=await f.svc().preview({...f.input(),key:r.key,draft});assert.equal(f.reads().renders,2);assert.deepEqual(f.load(),before);assert.throws(()=>f.svc().decide({...f.input(),key:r.key,action:'apply',draft,proof:'bad'}),/voorbeeld/);assert.throws(()=>f.svc().decide({...f.input(),key:r.key,action:'apply',draft:{start:2,end:6},proof:p.proof}),/gewijzigd/);
 const applied=f.svc().decide({...f.input(),key:r.key,action:'apply',draft,proof:p.proof});assert.equal(applied.state.revision,5);assert.deepEqual(applied.state.modes.gespreksmontage,before.modes.gespreksmontage);const e=applied.state.modes.quoteverhaal.edits['one:a'];assert.equal(e.nl,before.modes.quoteverhaal.edits['one:a'].nl);assert.deepEqual(e.element,before.modes.quoteverhaal.edits['one:a'].element);assert.equal(e.shot,'medium');assert.equal(e.subtitleTiming.start,2.04);assert.equal(e.subtitleTiming.cues[0].end,6.04);assert.equal(applied.audit.montageReview.modes.quoteverhaal.items.find(x=>x.key==='one:a').audioReview.method,'human');assert.ok(fs.readdirSync(path.join(f.data,'herstel')).length);
});
test('visual proposal and chapter boundary keep every audio/subtitle frame and existing crops',async t=>{
 const f=fixture(t),before=exportPlan(f.state,catalog);for(const [id,draft]of [['a',{frames:-4,nextShot:'wide'}],['b',{frames:4,nextShot:null}]]){
  const i=f.input('visual',id),next=proposalDraft(f.state,catalog,i,draft),after=exportPlan(next,catalog);assert.equal(after.duration,before.duration);assert.deepEqual(after.events.map(e=>[e.id,e.sourceStart,e.sourceEnd,e.frames,e.subtitleCues,e.nl,e.element]),before.events.map(e=>[e.id,e.sourceStart,e.sourceEnd,e.frames,e.subtitleCues,e.nl,e.element]));assert.deepEqual(next.guestFrames,f.state.guestFrames);
 }
 const i=f.input('visual','b'),r=await f.svc().generate(i),p=await f.svc().preview({...i,key:r.key,draft:{frames:-4,nextShot:null}}),applied=f.svc().decide({...i,key:r.key,action:'apply',draft:{frames:-4,nextShot:null},proof:p.proof});assert.equal(applied.state.modes.quoteverhaal.edits['one:b'].transition.nextId,'topic:two');assert.equal(applied.audit.montageReview.modes.quoteverhaal.items[0].visualReview.method,'human');
});
test('scope includes source, subtitles, crops, mode, actual neighbors and hand edits',async t=>{
 const f=fixture(t),i=f.input(),r=await f.svc().generate(i),p=await f.svc().preview({...i,key:r.key,draft:r.draft});
 f.state.revision++;f.state.modes.quoteverhaal.edits['one:a'].nl='Mijn correctie.';f.save();assert.throws(()=>f.svc().decide({...f.input(),key:r.key,action:'apply',draft:r.draft,proof:p.proof}),/eerdere/);await assert.rejects(f.svc().preview({...i,key:r.key,draft:r.draft}),/gewijzigd/);assert.equal(f.load().modes.quoteverhaal.edits['one:a'].nl,'Mijn correctie.');
 assert.equal(f.svc().read(f.input()).status,'none');fs.appendFileSync(f.source,'replacement');assert.notEqual(f.svc().read(f.input()).key,r.key);
});
test('invalid fields, unsupported boundaries and crossing/removing captions are rejected',t=>{
 const f=fixture(t);for(const bad of [{start:1,end:6},{start:2,end:6,audio:'x'},{start:NaN,end:6}])assert.throws(()=>proposalDraft(f.state,catalog,f.input(),bad));
 for(const bad of [{frames:13,nextShot:'wide'},{frames:2.5,nextShot:'wide'},{frames:-4,nextShot:'close'},{frames:4,nextShot:'wide',extra:true}])assert.throws(()=>proposalDraft(f.state,catalog,f.input('visual'),bad));
 assert.throws(()=>cutContext(f.state,catalog,f.input('visual','c','two')),/geen verplaatsbare/);assert.throws(()=>cutContext(f.state,catalog,f.input('audio','a','wrong')),/plek/);
});
test('bad model results cannot be applied or saved as valid suggestions',async t=>{
 const f=fixture(t),svc=cutProposalService('',f.root,catalog,f.source,{}, {evidence:async()=>({silences:[]}),model:async(dir,work)=>work(async()=>({candidate:'invented',reason:'Do it',confidence:'high'}))});await assert.rejects(svc.generate(f.input('visual')),/onderbouwd/);assert.equal(svc.read(f.input('visual')).status,'none');
});
test('approval of an unchanged proposal records only its domain and keeps export current',async t=>{
 const f=fixture(t),i=f.input('audio'),r=await f.svc().generate(i),draft=r.current,p=await f.svc().preview({...i,key:r.key,draft}),before=fs.readFileSync(f.file),sig=montageSignature(f.state,catalog),result=f.svc().decide({...i,key:r.key,action:'apply',draft,proof:p.proof});assert.equal(result.changed,false);assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(montageSignature(result.state,catalog),sig);const reviewed=montageReview(result.state,catalog,result.audit);assert.equal(reviewed.items.find(x=>x.key==='one:a').audio,true);assert.equal(reviewed.items.find(x=>x.key==='one:a').visual,false);assert.equal(reviewed.items.find(x=>x.key==='teaser:a').audio,false);
});
test('a word cut in half gets a recovery candidate even in continuous speech',()=>{
 const w=[{text:'Word.',start:2,end:2.64},{text:'Next',start:2.64,end:3.2}];const o=audioOptions({start:1.9,end:2.4},w,[],8);assert.ok(o.some(x=>x.end===2.64));assert.ok(o.every(x=>x.end<=2.64));
});
test('unrelated edits preserve a skipped proposal, but local crop and neighbor changes invalidate it',async t=>{
 const f=fixture(t),i=f.input('audio'),r=await f.svc().generate(i);f.svc().decide({...i,key:r.key,action:'skip'});f.state.revision++;f.state.modes.quoteverhaal.blocks[1].title='Andere titel';f.state.modes.quoteverhaal.edits['two:c']={start:20,end:23,nl:'Andere tekst.',translationReviewed:false};f.save();assert.equal(f.svc().read(f.input()).key,r.key);assert.equal(f.svc().read(f.input()).decision.action,'skip');f.state.guestFrames.medium.x=0;f.save();assert.notEqual(f.svc().read(f.input()).key,r.key);
});
test('a slow AI response cannot publish a valid proposal after the human changes that cut',async t=>{
 const f=fixture(t),svc=cutProposalService('',f.root,catalog,f.source,{}, {evidence:async()=>({silences:[]}),model:async(dir,work)=>work(async()=>{f.state.revision++;f.state.modes.quoteverhaal.edits['one:a'].end=5.96;f.save();return {candidate:'keep',reason:'Geen winst.',confidence:'medium'};})});await assert.rejects(svc.generate(f.input('visual')),/eerdere/);assert.equal(f.load().modes.quoteverhaal.edits['one:a'].end,5.96);
});
test('a running audit blocks application without writing state, review or decision',async t=>{
 const f=fixture(t),i=f.input(),r=await f.svc().generate(i),p=await f.svc().preview({...i,key:r.key,draft:r.draft}),before=fs.readFileSync(f.file);fs.writeFileSync(path.join(f.data,'audio-audit.json'),JSON.stringify({status:'running'}));assert.throws(()=>f.svc().decide({...i,key:r.key,action:'apply',draft:r.draft,proof:p.proof}),/lopende/);assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(fs.existsSync(path.join(f.data,'review-baseline.json')),false);
});
test('a failed decision write rolls both montage and human review back',async t=>{
 const f=fixture(t),i=f.input(),r=await f.svc().generate(i),p=await f.svc().preview({...i,key:r.key,draft:r.draft}),before=fs.readFileSync(f.file);fs.mkdirSync(path.join(f.data,'cut-proposals',r.key,'decision.json'));assert.throws(()=>f.svc().decide({...i,key:r.key,action:'apply',draft:r.draft,proof:p.proof}));assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(fs.existsSync(path.join(f.data,'review-baseline.json')),false);
});
test('short subtitle cues cannot disappear under an adjusted audio edge',t=>{
 const f=fixture(t);f.state.modes.quoteverhaal.edits['one:a'].subtitleTiming.cues=[{start:2,end:2.08,text:'Een'},{start:2.08,end:6,text:'voorbeeld.'}];assert.throws(()=>proposalDraft(f.state,catalog,f.input(),{start:2.12,end:6}),/ondertitel/);
});
test('a model cannot describe a measured cut through a word as a fully preserved ending',async t=>{
 const f=fixture(t);const e=f.state.modes.quoteverhaal.edits['one:a'];e.end=5.6;e.translationReviewed=false;delete e.translationRange;e.subtitleTiming.end=5.6;e.subtitleTiming.cues[0].end=5.6;f.save();const svc=cutProposalService('',f.root,catalog,f.source,{}, {evidence:async()=>({silences:[]}),model:async(dir,work)=>work(async()=>({candidate:'keep',reason:'Het volledige slotwoord is behouden.',confidence:'high'}))});const r=await svc.generate(f.input());assert.equal(r.hasChange,false);assert.equal(r.confidence,'low');assert.match(r.reason,/binnen.*example/);assert.doesNotMatch(r.reason,/volledige slotwoord/);
});
