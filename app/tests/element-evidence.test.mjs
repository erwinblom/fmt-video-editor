import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeEvidence} from '../element-evidence.mjs';
import {withSubtitleModel} from '../cloud-subtitle-model.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64');
function folder(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-evidence-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
const url='https://example.com/product';
const selected={suitable:true,candidate:0,reason:'Zichtbare knop',crop:{x:0,y:0,width:1,height:1},annotation:{x:.2,y:.2,width:.2,height:.1,text:'Vraag om akkoord'}};
test('bewijsbeeld gebruikt werkelijke searchprovenance, opgenomen pixels en gecontroleerde annotatie',async t=>{
 const root=folder(t);let calls=0;
 const result=await makeEvidence(root,path.join(root,'job'),{basis:'Ask permission',imageIdea:'Permission button'},{title:'Proef'}, {model:async(dir,work)=>work(async(prompt,tokens,schema,opts)=>{calls++;if(opts?.webSearch)return {url,reason:'Officieel',researchSources:[url]};assert.ok(prompt[0].content.some(c=>c.type==='input_image'));return selected;}),capture:async source=>{assert.equal(source,url);return {bytes:png,width:1,height:1,url,title:'Product',capturedAt:'2026-10-23T08:00:00Z'};}});
 assert.equal(calls,2);assert.equal(result.sourceUrl,url);assert.equal(result.annotation.text,'Vraag om akkoord');assert.ok(fs.existsSync(path.join(root,'data/element-assets',result.assetId+'.png')));
});
test('verzonnen bronURL wordt niet opgehaald',async t=>{
 const root=folder(t);let captured=false;
 await assert.rejects(()=>makeEvidence(root,path.join(root,'job'),{basis:'X',imageIdea:'Y'},{},{model:async(d,w)=>w(async()=>({url,reason:'X',researchSources:['https://example.org/']})),capture:async()=>{captured=true;}}),/passende officiële bron/);assert.equal(captured,false);
});
test('onbruikbare screenshots worden geweigerd, ook met een geldige URL',async t=>{
 const root=folder(t);
 await assert.rejects(()=>makeEvidence(root,path.join(root,'job'),{basis:'X',imageIdea:'Y'},{},{model:async(d,w)=>w(async(p,n,s,o)=>o?.webSearch?{url,researchSources:[url]}:{suitable:false,reason:'Cookievenster'}),capture:async()=>({bytes:png,width:1,height:1,url})}),/Cookievenster/);
});
test('web search wrapper vraagt bronnen op en geeft alleen echte tool/citatie-URLs terug',async t=>{
 const root=folder(t);let body;
 const result=await withSubtitleModel(root,ask=>ask('Zoek een bron',2000,undefined,{webSearch:true}),{allowCloud:true,key:'test-not-a-secret',fetcher:async(u,o)=>{body=JSON.parse(o.body);return new Response(JSON.stringify({status:'completed',model:'test',usage:{input_tokens:2,output_tokens:3},output:[{type:'web_search_call',action:{sources:[{url}]}},{content:[{type:'output_text',text:JSON.stringify({url,reason:'Een bron'}),annotations:[]}]}]}));}});
 assert.deepEqual(body.include,['web_search_call.action.sources']);assert.equal(body.tools[0].type,'web_search');assert.deepEqual(result.researchSources,[url]);assert.equal(body.store,false);
});
