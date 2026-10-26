import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {captionPreview} from '../caption-preview.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const q={start:0,end:8,speaker:'Gast',nl:'Een zin. Nog een zin.'},catalog={duration:8,quotes:{a:q},words:[]},state={mode:'quoteverhaal',modes:{quoteverhaal:{edits:{}}}};
test('preview gebruikt de ondertitelgroepen van de export met clip-lokale tijden',async()=>{const cues=await captionPreview(root,{mode:'quoteverhaal',id:'a',blockId:'b1',start:0,end:8,nl:q.nl},state,catalog);assert.equal(cues.length,2);assert.equal(cues[0].start,0);assert.equal(cues.at(-1).end,8);assert.equal(cues.map(c=>c.text).join(' '),q.nl);assert.ok(cues.every(c=>c.lines.length<=2));});
test('ongeldige tijden en te grote previewtekst worden vóór verwerking geweigerd',async()=>{const input={mode:'quoteverhaal',id:'a',blockId:'b1',start:-1,end:8,nl:q.nl};await assert.rejects(()=>captionPreview(root,input,state,catalog));await assert.rejects(()=>captionPreview(root,{...input,start:0,nl:'x'.repeat(20001)},state,catalog));});
