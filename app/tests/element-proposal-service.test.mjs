import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {elementProposalService,elementTiming,elementGenerationRunning} from '../element-proposal-service.mjs';
import {elementAssets} from '../element-assets.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64');
function fixture(t,deps={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-elements-work-'));fs.mkdirSync(path.join(root,'data'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const catalog={duration:100,primarySpeaker:'Gast',title:'Proef',catalog:{quoteverhaal:[{id:'b'}],gespreksmontage:[]},quotes:{q:{start:10,end:30,speaker:'Gast',text:'Work with context.',nl:'Werk met context.'}}};
 const original={version:1,revision:7,mode:'quoteverhaal',target:600,modes:{quoteverhaal:{teaser:['q'],blocks:[{id:'b',title:'Werken',clipIds:['q']}],edits:{'b:q':{start:10,end:30,nl:'Eigen tekst.',translationReviewed:false}}},gespreksmontage:{teaser:[],blocks:[],edits:{}}}};
 const file=path.join(root,'data/montages.json');fs.writeFileSync(file,JSON.stringify(original));const id=elementAssets(root).put(png).id;
 const idea={type:'diagram',text:'Werk met context',value:'',label:'',source:'Volgens de spreker',reason:'Verklaart de werkwijze',basis:'Work with context.',imageIdea:'',diagram:{steps:['Werk','Context','Keuze'],feedback:'Bijsturen'}};
 let calls=0;const service=elementProposalService(root,catalog,{}, {planner:async()=>{calls++;return {reason:'Eén zinvolle toevoeging',items:[idea]};},...deps});
 const input={mode:'quoteverhaal',id:'q',blockId:'b'};
 return {root,catalog,file,original,id,service,input,calls:()=>calls,idea};
}
test('genereren, heropenen, concept en afkeuren bewaren geen montagewijziging',async t=>{
 const f=fixture(t),before=fs.readFileSync(f.file,'utf8');assert.equal(f.service.read(f.input).status,'none');
 const [a,b]=await Promise.all([f.service.generate(f.input),f.service.generate(f.input)]);assert.equal(a.key,b.key);assert.equal(f.calls(),1);assert.equal(a.items[0].element.type,'diagram');
 const base={...f.input,key:a.key,proposalId:'0'},element={...a.items[0].element,artworkId:f.id};
 f.service.decide({...base,action:'draft',element});assert.equal(f.service.read(f.input).items[0].status,'draft');
 f.service.decide({...base,action:'reject'});await f.service.generate(f.input);assert.equal(f.service.read(f.input).items[0].status,'rejected');assert.equal(f.calls(),1);assert.equal(fs.readFileSync(f.file,'utf8'),before);
});
test('goedkeuring wijzigt uitsluitend element op deze plek, revisie en herstelkopie',async t=>{
 const f=fixture(t),r=await f.service.generate(f.input),element={...r.items[0].element,artworkId:f.id};
 const result=f.service.decide({...f.input,key:r.key,proposalId:'0',action:'approve',element,currentElement:null});
 assert.equal(result.state.revision,8);assert.deepEqual(result.before,f.original);const expected=structuredClone(f.original);expected.revision=8;expected.modes.quoteverhaal.edits['b:q'].element=element;assert.deepEqual(result.state,expected);
 assert.equal(f.service.read(f.input).items[0].status,'approved');assert.equal(fs.readdirSync(path.join(f.root,'data/herstel')).length,1);
 assert.equal(f.service.decide({...f.input,key:r.key,proposalId:'0',action:'approve',element,currentElement:element}).changed,false);
});
test('gewijzigde knip of handmatig element kan niet worden overschreven vanuit oud voorstel',async t=>{
 const f=fixture(t),r=await f.service.generate(f.input),element={...r.items[0].element,artworkId:f.id},req={...f.input,key:r.key,proposalId:'0',action:'approve',element,currentElement:null};
 let state=structuredClone(f.original);state.modes.quoteverhaal.edits['b:q'].element={...element,text:'Handmatige keuze'};fs.writeFileSync(f.file,JSON.stringify(state));
 assert.throws(()=>f.service.decide(req),/intussen gewijzigd/);
 state.modes.quoteverhaal.edits['b:q'].start=11;fs.writeFileSync(f.file,JSON.stringify(state));assert.throws(()=>f.service.decide(req),/knip of brontekst/);
 assert.throws(()=>f.service.read({...f.input,blockId:'ontbreekt'}),/niet in de actieve/);
});
test('mislukt bewijs is een fout, nooit een toepasbaar bewijsbeeld',async t=>{
 const f=fixture(t,{planner:async()=>({reason:'Echt beeld gewenst',items:[{type:'annotatedProof',text:'Bijsturen',reason:'Voorbeeld',basis:'Work with context.',imageIdea:'Echte knop',value:'',label:'',source:''}]}),evidence:async()=>{throw Error('Geen passende bron');}});
 const r=await f.service.generate(f.input);assert.equal(r.items[0].element,null);assert.equal(r.items[0].creationError,'Geen passende bron');assert.equal(JSON.parse(fs.readFileSync(f.file)).revision,7);
});
test('onbekende assets en buiten de quote vallende elementen worden niet goedgekeurd',async t=>{
 const f=fixture(t),r=await f.service.generate(f.input),base={...f.input,key:r.key,proposalId:'0',action:'approve',currentElement:null};
 assert.throws(()=>f.service.decide({...base,element:{...r.items[0].element,artworkId:'a'.repeat(64)}}));
 assert.throws(()=>f.service.decide({...base,element:{...r.items[0].element,artworkId:f.id,end:21}}),/binnen dit fragment/);
 assert.equal(JSON.parse(fs.readFileSync(f.file)).revision,7);
});

test('een late basispassage begint niet eerder om de kaart te vullen',()=>{const q={start:0,end:30,speaker:'Gast'},catalog={words:[{start:25,end:29,text:'Laatste uitspraak.',speaker:'Gast'}]};assert.deepEqual(elementTiming(q,catalog,'Laatste uitspraak.','diagram'),{start:25,end:30});});
