import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {proposeStoryline,selectApprovedStoryline,storylineCore} from '../public/storyline.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/example-catalog.json',import.meta.url)));
const bank=JSON.parse(fs.readFileSync(new URL('./fixtures/example-bank.json',import.meta.url)));
const state=()=>({mode:'gespreksmontage',target:600,modes:{gespreksmontage:{blocks:[],teaser:[],edits:{}},quoteverhaal:{blocks:[],teaser:[],edits:{}}}});
test('verhaallijn verandert geen montage en bevat bestaande bronvoorbeelden',()=>{const s=state(),before=structuredClone(s),story=proposeStoryline(s,catalog,bank);assert.deepEqual(s,before);assert.ok(story.chapters.length<=5);assert.ok(story.key.length<100);for(const c of story.chapters)assert.ok(catalog.quotes[c.example.id]);assert.throws(()=>selectApprovedStoryline(s,catalog,bank,story),/akkoord/);});
test('akkoord selecteert uitsluitend goedgekeurde onderwerpen in hun gekozen volgorde',()=>{const s=state(),story=proposeStoryline(s,catalog,bank);story.chapters=story.chapters.slice(0,2).reverse();story.status='approved';const m=selectApprovedStoryline(s,catalog,bank,story);assert.deepEqual(m.blocks.map(b=>b.id),story.chapters.map(b=>b.id));assert.ok(m.blocks.every(b=>b.clipIds.length));assert.equal(m.storyline.status,'approved');assert.deepEqual(s.modes.gespreksmontage.blocks,[]);});
test('gewijzigde tijd, montagevorm, aanwijzing of bron maakt oud akkoord ongeldig',()=>{for(const mutate of [s=>s.target=300,s=>s.mode='quoteverhaal',s=>s.modes.gespreksmontage.selectionAngle='Europese controle']){const s=state(),story=proposeStoryline(s,catalog,bank);story.status='approved';mutate(s);assert.throws(()=>selectApprovedStoryline(s,catalog,bank,story),/gewijzigd/);}const s=state(),story=proposeStoryline(s,catalog,bank);story.status='approved';assert.throws(()=>selectApprovedStoryline(s,catalog,{...bank,id:'new'},story),/gewijzigd/);});
test('bewaren en heropenen behoudt voorstel en laat montage intact',()=>{const s=state();s.modes.gespreksmontage.storyline=proposeStoryline(s,catalog,bank);const read=JSON.parse(JSON.stringify(s));assert.deepEqual(read,s);assert.throws(()=>selectApprovedStoryline(read,catalog,bank,read.modes.gespreksmontage.storyline),/akkoord/);});
test('thematic imports use source topics, and approval survives stored direction',()=>{
 const q={id:'q',start:0,end:10,text:'Een hele uitspraak.',speaker:'Gast',nl:'Een hele uitspraak.'};
 const c={title:'Nieuw',duration:30,imported:true,analysis:{id:'a'},quotes:{q},catalog:{gespreksmontage:[{id:'b',title:'Concrete ervaring',clipIds:['q']}]}};
 const u={id:'q',blockId:'b',order:0,sourceOrder:0,priority:90,standalone:true,reason:'Een concrete ervaring geeft het verhaal een begin.',clips:[{quoteId:'q',conversationId:'q',...q}]};
 const b={id:'a',sourceTitle:'Nieuw',kind:'thematic',direction:'Focus op ervaring',summary:'Algemene analyse',units:[u]};
 const s=state();s.target=60;s.modes.gespreksmontage.selectionAngle=b.direction;
 const story=proposeStoryline(s,c,b);assert.equal(story.core,'Concrete ervaring');story.status='approved';assert.equal(selectApprovedStoryline(s,c,b,story).blocks[0].id,'b');
});
test('quoteverhaal also requires approval and preserves other montage',()=>{const s=state();s.mode='quoteverhaal';const original=structuredClone(s.modes.gespreksmontage),story=proposeStoryline(s,catalog,bank);story.status='approved';assert.ok(selectApprovedStoryline(s,catalog,bank,story).blocks.length);assert.deepEqual(s.modes.gespreksmontage,original);});

test('kernregel volgt onderwerpvolgorde en weglaten',()=>{const story={topicCore:true,core:'Oude volgorde',chapters:[{title:'Uitleg'},{title:'Voorbeeld'}]};assert.equal(storylineCore(story),'Uitleg → Voorbeeld');story.chapters.reverse();assert.equal(storylineCore(story),'Voorbeeld → Uitleg');story.chapters.pop();assert.equal(storylineCore(story),'Voorbeeld');});
