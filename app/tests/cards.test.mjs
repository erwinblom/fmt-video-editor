import {python as runtimePython} from '../runtime-config.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
test('eigen langere koppen blijven compleet en passen op twee kaartregels',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-cards-')),output=path.join(tmp,'cards'),titles=['Een agent is een collega die je kunt volgen',Array(12).fill('WWWWWWWWW').join(' ')],config=path.join(tmp,'interview.json');
 try{fs.writeFileSync(config,JSON.stringify({guest:'Gast Voorbeeld',intro:'Het interview.',subjects:titles}));
 const result=spawnSync(runtimePython,[path.resolve('app/make-cards.py'),'--config',config,'--output',output],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const html=fs.readFileSync(path.join(output,'index.html'),'utf8'),heads=[...html.matchAll(/class="head" style="font-size:(\d+)px">((?:<div>[^<]*<\/div>)+)/g)];assert.equal(heads.length,2);assert.equal((html.match(/class="num" aria-hidden="true">[12]<\/div>/g)||[]).length,2);assert.ok(Number(heads[0][1])<118);assert.ok(!html.includes('FMT HANDPICKED'));assert.ok(!html.includes('class="clip target"'));

 for(let i=0;i<heads.length;i++){const lines=[...heads[i][2].matchAll(/<div>([^<]*)<\/div>/g)].map(m=>m[1]);assert.ok(lines.length<=2);assert.equal(lines.join(' '),titles[i]);}
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
