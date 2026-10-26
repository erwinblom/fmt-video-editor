import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {validateElement,resolveElement,elementActive} from '../public/elements.mjs';
import {elementAssets} from '../element-assets.mjs';
import {exportPlan} from '../export-plan.mjs';
import {montageSignature} from '../public/export-status.mjs';
const element=()=>({type:'statement',layout:'side',start:1,end:5,text:'Een kernzin.',value:'',label:'',source:'',assetId:null,artworkId:'a'.repeat(64)});
const catalog={duration:8,quotes:{a:{start:0,end:8,speaker:'Gast',nl:'Een zin.'}}};
const mode=()=>({teaser:['a'],blocks:[{id:'b1',title:'Proef',clipIds:['a']}],edits:{'b1:a':{start:0,end:8,nl:'Een zin.',translationReviewed:false,element:element()}}});
test('element blijft bij fragmentplek en montagevorm; beeldkeuze en exportveroudering',()=>{
 const s={mode:'quoteverhaal',target:60,modes:{quoteverhaal:mode(),gespreksmontage:mode()}};const before=structuredClone(s),signature=montageSignature(s,catalog),p=exportPlan(s,catalog),clips=p.events.filter(e=>e.kind==='clip');
 assert.equal(clips[0].element,null);assert.equal(clips[1].element.text,'Een kernzin.');assert.deepEqual(clips[1].element.geometry,{x:90,y:215,width:900,height:506});assert.deepEqual(s,before);
 s.modes.quoteverhaal.edits['b1:a'].element.text='Een andere zin.';assert.notEqual(montageSignature(s,catalog),signature);assert.equal(s.modes.gespreksmontage.edits['b1:a'].element.text,'Een kernzin.');
});
test('tijd binnen gewijzigde knip; einde exclusief en geen wijziging van opgeslagen element',()=>{const e=element(),copy=structuredClone(e),r=resolveElement(e,2);assert.equal(r.end,2);assert.equal(elementActive(r,1),true);assert.equal(elementActive(r,2),false);assert.deepEqual(e,copy);const short=resolveElement({...e,start:7,end:8},.04);assert.equal(short.start,0);assert.equal(short.end,.04);});
test('ongeldige typen, timing, paden, lange tekst en bewijs zonder bron worden geweigerd',()=>{assert.doesNotThrow(()=>validateElement(element()));for(const patch of [{type:'__proto__'},{layout:'evil'},{start:-1},{end:NaN},{artworkId:'../../secret'},{text:'x'.repeat(121)},{type:'proof',assetId:'b'.repeat(64),source:''}])assert.throws(()=>validateElement({...element(),...patch}));});
test('lokale PNG-assets zijn inhoudsgericht, geïsoleerd en exportkopieën onveranderlijk',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-element-assets-'));try{const a=elementAssets(root),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64'),id=a.put(png).id;assert.equal(a.put(png).id,id);assert.throws(()=>a.file('../escape'));assert.throws(()=>a.put(Buffer.from('<svg/>')));assert.throws(()=>a.put(png.subarray(0,40)));const out=path.join(root,'snapshot.png');a.snapshot(id,out);assert.deepEqual(fs.readFileSync(out),png);fs.writeFileSync(a.file(id),'changed');assert.throws(()=>a.snapshot(id,out),/gewijzigd/);assert.deepEqual(fs.readFileSync(out),png);}finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("element begint ook bij afronding van de bronpositie",()=>{const e={start:4.96,end:13.96};assert.equal(elementActive(e,295.599999-290.64),true);assert.equal(elementActive(e,(290.64+13.96)-290.64),false);});
