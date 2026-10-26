import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileAnalysis} from '../thematic-analysis.mjs';
import {buildThematicProposal,proposalDuration} from '../public/proposals.mjs';
import {editorialPrompt,withEditorialRules} from '../editorial-rules.mjs';
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/synthetic-format.json',import.meta.url)));
function compiled(){const p=f.passages.map(p=>({...p,nl:'',speaker:'Gast'})),assignments=p.map(p=>({id:p.id,theme:p.theme,score:90,standalone:true,teaser:false}));return compileAnalysis({title:'Demo Werkplaats formatproef',duration:1650,transcript:p,quotes:{},catalog:{quoteverhaal:[],gespreksmontage:[]}},p,assignments,[{title:'Afspraken rond gereedschap delen',labels:[p[0].theme,p[2].theme],reason:'Werk en resultaat bijeen'},...p.filter((_,i)=>i!==0&&i!==2).map(p=>({title:p.theme,labels:[p.theme],reason:'Andere inhoudelijke kwestie'}))]);}
test('Demo Werkplaats format: verspreide quotes in hetzelfde blok, brontekst en tijdcodes gelijk',()=>{const {catalog}=compiled(),blocks=catalog.catalog.quoteverhaal;assert.deepEqual(blocks[0].clipIds,['media-work','media-result']);for(const p of f.passages){assert.equal(catalog.quotes[p.id].text,p.text);assert.equal(catalog.quotes[p.id].start,p.start);assert.equal(catalog.quotes[p.id].end,p.end);}});
test('format gaat werkelijk mee naar analyse, gespecialiseerde teaserinstructies blijven intact',async()=>{let prompt;await withEditorialRules(async p=>{prompt=p;})('Deel onderwerpen in');assert.ok(prompt.includes(editorialPrompt('format')));assert.ok(prompt.includes('kleinste inhoudelijk verdedigbare indeling'));});
test('beide montagevormen: hele passages en kaarten binnen budget, huidige edits blijven intact',()=>{const {catalog,bank}=compiled();bank.teaserUnits=[];for(const mode of ['quoteverhaal','gespreksmontage'])for(const budget of f.selectionBudgets){const state={mode,revision:4,modes:{quoteverhaal:{edits:{eigen:'Eigen tekst'}},gespreksmontage:{edits:{eigen:'Andere tekst'}}}},before=structuredClone(state);const m=buildThematicProposal(state,catalog,bank,budget);assert.deepEqual(state,before);assert.ok(proposalDuration(m,catalog)<=budget);assert.equal(m.teaser.length,0);for(const b of m.blocks)for(const id of b.clipIds){assert.equal(m.edits[b.id+':'+id].start,catalog.quotes[id].start);assert.equal(m.edits[b.id+':'+id].end,catalog.quotes[id].end);}}});
test('bij gelijke kwaliteit en lengte verdieping boven een extra onderwerpkaart',()=>{const {catalog,bank}=compiled();bank.teaserUnits=[];for(const u of bank.units){u.clips[0].end=u.clips[0].start+10;catalog.quotes[u.id].end=u.clips[0].end;}const m=buildThematicProposal({mode:'gespreksmontage'},catalog,bank,35);assert.equal(m.blocks.length,1);assert.deepEqual(m.blocks[0].clipIds,['media-work','media-result']);assert.equal(proposalDuration(m,catalog),35);});

test('bronindeling krijgt geen opdracht om de verhaalvolgorde te veranderen',async()=>{let prompt;const ask=withEditorialRules(async p=>{prompt=p;});await ask.sourceOrder('Bepaal grenzen');assert.ok(prompt.includes('opnamevolgorde strikt'));assert.ok(!prompt.includes(editorialPrompt('format')));});

test('onderwerpconsolidatie weigert een vergaarbak en dubbele bronverwijzingen',async()=>{
 const {validateTopicGroups}=await import('../thematic-analysis.mjs');const sources=Array.from({length:20},(_,i)=>({id:'T'+i,title:'Onderwerp '+i}));
 assert.throws(()=>validateTopicGroups({groups:[{title:'Platform',question:'Alles?',members:sources.map(s=>s.id)}]},sources),/te veel/);
 assert.throws(()=>validateTopicGroups({groups:[{title:'X',question:'X?',members:['T0','T0']}]},sources),/dubbel/);
});
