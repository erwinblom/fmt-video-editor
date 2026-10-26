import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildProposal,proposalDuration} from '../public/proposals.mjs';import {validateEdits} from '../public/model.mjs';import {exportPlan} from '../export-plan.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/example-catalog.json',import.meta.url))),bank=JSON.parse(fs.readFileSync(new URL('./fixtures/example-bank.json',import.meta.url)));
const state=mode=>({version:1,revision:7,mode,target:600,modes:Object.fromEntries(['quoteverhaal','gespreksmontage'].map(m=>[m,{blocks:structuredClone(catalog.catalog[m]),teaser:catalog.teaserCandidates.slice(0,3),edits:{}}]))});
test('vijfminutenvoorstel behoudt uitleg, praktijk en nuance, telt alle kaarten en teasers mee',()=>{const s=state('gespreksmontage'),before=structuredClone(s),m=buildProposal(s,catalog,bank,300);assert.deepEqual(s,before);assert.ok(proposalDuration(m,catalog)<=300);assert.ok(proposalDuration(m,catalog)>270);assert.equal(m.teaser.length,3);assert.equal(new Set(m.teaser).size,3);assert.equal(m.blocks[0].id,'b2');assert.equal(m.blocks.at(-1).id,'b12');for(const key of ['uitleg','praktijk','nuance','controle','beginnen'])assert.ok(m.proposal.selectedUnits.includes(key));assert.ok(m.blocks.some(b=>b.clipIds.some(id=>catalog.quotes[id].speaker==='Interviewer')));validateEdits(m,catalog,s.mode);const p=exportPlan({...s,target:300,modes:{...s.modes,[s.mode]:m}},catalog);assert.equal(p.duration,proposalDuration(m,catalog));assert.equal(p.events.filter(e=>e.kind==='topic').length,m.blocks.length);assert.ok(p.events.every(e=>e.kind!=='clip'||!e.translationReviewed));});
test('verschillende tijdlimieten leveren hele passages binnen de limiet; geen fragment wordt op duur afgehakt',()=>{for(const mode of ['quoteverhaal','gespreksmontage'])for(const limit of [90,120,180,300,600]){const m=buildProposal(state(mode),catalog,bank,limit);assert.ok(proposalDuration(m,catalog)<=limit);validateEdits(m,catalog,mode);for(const b of m.blocks){assert.equal(new Set(b.clipIds).size,b.clipIds.length);for(const id of b.clipIds){const e=m.edits[`${b.id}:${id}`];assert.ok(bank.units.some(u=>u.clips.some(c=>(mode==='quoteverhaal'?c.quoteId:c.conversationId)===id&&c.start===e.start&&c.end===e.end)));}}if(mode==='quoteverhaal')assert.ok(m.blocks.every(b=>b.clipIds.every(id=>catalog.quotes[id].speaker==='Gast')));}});
test('teaserknip staat los van dezelfde inhoud in de montage; verkeerde bron en onhaalbare limiet geweigerd',()=>{const m=buildProposal(state('quoteverhaal'),catalog,bank,300);assert.notEqual(m.edits['teaser:q10'].start,m.edits['b7:q10'].start);for(const limit of [NaN,0,30,7201])assert.throws(()=>buildProposal(state('gespreksmontage'),catalog,bank,limit));assert.throws(()=>buildProposal(state('gespreksmontage'),{...catalog,title:'Ander interview'},bank,300),/ander interview/);});
test('invalshoek geeft voorrang; alleen beperkt selectie, in beide montagevormen',()=>{
 for(const mode of ['quoteverhaal','gespreksmontage']){
  const s=state(mode),before=structuredClone(s),soft=buildProposal(s,catalog,bank,300,'Focus op uitleenlabels'),strict=buildProposal(s,catalog,bank,300,'Alleen focus op uitleenlabels');
  assert.ok(soft.proposal.selectedUnits.includes('praktijk'));assert.ok(soft.proposal.selectedUnits.length>1);assert.equal(soft.proposal.strict,false);
  assert.deepEqual(strict.proposal.selectedUnits,['praktijk','beginnen']);assert.equal(strict.proposal.strict,true);assert.ok(proposalDuration(strict,catalog)<130);assert.ok(proposalDuration(soft,catalog)<=300);validateEdits(strict,catalog,mode);assert.deepEqual(s,before);
  assert.ok(strict.teaser.every(id=>id==='q10'));assert.match(strict.proposal.warning,/Minder dan drie teasers is toegestaan/);
 }
});
test('onbekende invalshoek en algemene opdracht vervangen de montage niet',()=>{
 const s=state('quoteverhaal'),before=structuredClone(s);
 for(const angle of ['Alleen focus op ruimtevaart','Focus op Demo Werkplaats','x'.repeat(1001)])assert.throws(()=>buildProposal(s,catalog,bank,300,angle));
 assert.deepEqual(s,before);
});
test('algemene selector werkt ook met een andere interviewbank en kent het onderscheid start en begindagen',()=>{
 const bank2=structuredClone(bank),cat2=structuredClone(catalog);bank2.sourceTitle=cat2.title='Ander interview';
 const start=buildProposal(state('quoteverhaal'),cat2,bank2,300,'Alleen focus op start');assert.ok(start.proposal.selectedUnits.includes('beginnen'));
 assert.throws(()=>buildProposal(state('quoteverhaal'),cat2,bank2,300,'Alleen begindagen van het bedrijf'),/Geen voldoende/);
});

test('vrije aanwijzingen worden niet stilzwijgend als een omgekeerde onderwerpkeuze uitgevoerd',()=>{const s=state('quoteverhaal');for(const angle of ['Schrap integraties','Geen Europese keuze','Maak de opbouw spannend'])assert.throws(()=>buildProposal(s,catalog,bank,300,angle),/nog niet automatisch uitvoeren/);});
