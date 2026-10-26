import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {elementProposals,validateProposals} from '../element-proposals.mjs';
const source='We have 100 connections, approximately.';
const item={type:'number',text:'',value:'100',label:'koppelingen, ongeveer',source:'Volgens de spreker',reason:'Maakt schaal duidelijk',basis:source,imageIdea:''};
test('voorstellen mogen leeg zijn; verzonnen cijfers en bronpassages worden geweigerd',()=>{assert.deepEqual(validateProposals({reason:'Geen extra uitleg nodig',items:[]},source).items,[]);assert.doesNotThrow(()=>validateProposals({reason:'Schaal',items:[item]},source));assert.throws(()=>validateProposals({reason:'Schaal',items:[{...item,value:'200'}]},source));assert.throws(()=>validateProposals({reason:'Schaal',items:[{...item,basis:'Made up'}]},source));});
test('bronknip, cache, gelijktijdige aanvraag en montage blijven gescheiden',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-proposals-'));
 const catalog={quotes:{q:{start:0,end:10,speaker:'Gast',text:source}},words:[{start:0,end:3,speaker:'Gast',text:source},{start:6,end:9,speaker:'Gast',text:' Other words.'}]};
 const state={mode:'quoteverhaal',modes:{quoteverhaal:{edits:{'b:q':{start:0,end:4,nl:'Ongeveer honderd koppelingen.'}}}}},input={mode:'quoteverhaal',id:'q',blockId:'b'},before=JSON.stringify(state);let calls=0;
 const model=async(dir,work)=>work(async prompt=>{calls++;assert.ok(prompt.includes(source));assert.ok(!prompt.includes('Other words'));return {reason:'Schaal',items:[item]};});
 try{await Promise.all([elementProposals(root,input,state,catalog,model),elementProposals(root,input,state,catalog,model)]);assert.equal(calls,1);await elementProposals(root,input,state,catalog,model);assert.equal(calls,1);assert.equal(JSON.stringify(state),before);state.modes.quoteverhaal.edits['b:q'].nl='Andere tekst.';await elementProposals(root,input,state,catalog,model);assert.equal(calls,2);}finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('honderd in woorden mag 100 worden, maar 1000 mag geen 100 worden',()=>{for(const basis of ['over a hundred integrations','meer dan honderd koppelingen'])assert.doesNotThrow(()=>validateProposals({reason:'Schaal',items:[{...item,basis}]},basis));for(const basis of ['1000 integrations','two hundred integrations'])assert.throws(()=>validateProposals({reason:'Schaal',items:[{...item,basis}]},basis));});
