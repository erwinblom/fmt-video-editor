import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fmt-software-flow-')),a=path.join(root,'a'),b=path.join(root,'b'),remote=path.join(root,'remote.git');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const env={...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_AUTHOR_NAME:'Softwaretest',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'Softwaretest',GIT_COMMITTER_EMAIL:'test@example.invalid',npm_config_cache:path.join(root,'npm-cache'),npm_config_audit:'false',npm_config_fund:'false'};
 const run=(cwd,cmd,args,ok=true)=>{const r=spawnSync(cmd,args,{cwd,env,encoding:'utf8',timeout:60000});if(ok)assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r;};
 const git=(cwd,...args)=>run(cwd,'git',args);
 fs.mkdirSync(path.join(a,'scripts'),{recursive:true});fs.mkdirSync(path.join(a,'app/tests'),{recursive:true});
 for(const f of ['scripts/software.mjs','scripts/check-shared-files.mjs','app/runtime-config.mjs','.gitignore'])fs.copyFileSync(path.join(source,f),path.join(a,f));
 const iconFiles=['scripts/check-app-icon.mjs','scripts/make-mac-app.mjs','app-icon.svg','app-icon.png','app-icon.icns','app-icon-192.png','app-icon-512.png','app.webmanifest','app-icon-hashes.json','index.html','welcome.html','licenses.html'].map(f=>f.startsWith('scripts/')?f:'app/public/'+f);
 for(const f of iconFiles){fs.mkdirSync(path.dirname(path.join(a,f)),{recursive:true});fs.copyFileSync(path.join(source,f),path.join(a,f));}
 fs.writeFileSync(path.join(a,'app/example.mjs'),'export const version=1;\n');
 fs.writeFileSync(path.join(a,'app/tests/example.test.mjs'),"import test from 'node:test';test('fixture',()=>{});\n");
 fs.writeFileSync(path.join(a,'package.json'),JSON.stringify({name:'fmt-test',version:'1.0.0',private:true}));
 fs.writeFileSync(path.join(a,'package-lock.json'),JSON.stringify({name:'fmt-test',version:'1.0.0',lockfileVersion:3,requires:true,packages:{'':{name:'fmt-test',version:'1.0.0'}}}));
 git(a,'init','-b','main');git(a,'add','.');git(a,'commit','-m','Initial software');git(root,'init','--bare',remote);git(a,'remote','add','origin',remote);git(a,'push','-u','origin','main');git(remote,'symbolic-ref','HEAD','refs/heads/main');git(root,'clone',remote,b);
 const local=dir=>{fs.mkdirSync(path.join(dir,'app/data'),{recursive:true});fs.writeFileSync(path.join(dir,'app/data/montages.json'),JSON.stringify({machine:path.basename(dir)}));fs.writeFileSync(path.join(dir,'.env.local'),'OPENAI_API_KEY=local-test-placeholder');};local(a);local(b);
 return {a,b,git,run,action:(dir,name)=>run(dir,process.execPath,['scripts/software.mjs',name],false)};
}
test('software A → repository → B → repository → A preserves different local projects and settings',t=>{
 const f=fixture(t),beforeA=fs.readFileSync(path.join(f.a,'app/data/montages.json'),'utf8'),beforeB=fs.readFileSync(path.join(f.b,'app/data/montages.json'),'utf8');
 fs.writeFileSync(path.join(f.a,'app/example.mjs'),'export const version=2;\n');assert.equal(f.action(f.a,'deel').status,0);
 assert.equal(f.action(f.b,'haal').status,0);assert.match(fs.readFileSync(path.join(f.b,'app/example.mjs'),'utf8'),/version=2/);
 fs.appendFileSync(path.join(f.b,'app/example.mjs'),'export const secondMac=true;\n');assert.equal(f.action(f.b,'deel').status,0);assert.equal(f.action(f.a,'haal').status,0);
 assert.equal(fs.readFileSync(path.join(f.a,'app/data/montages.json'),'utf8'),beforeA);assert.equal(fs.readFileSync(path.join(f.b,'app/data/montages.json'),'utf8'),beforeB);
 for(const dir of [f.a,f.b]){assert.equal(fs.readFileSync(path.join(dir,'.env.local'),'utf8'),'OPENAI_API_KEY=local-test-placeholder');assert.equal(f.git(dir,'ls-files','app/data','.env.local').stdout,'');}
});
test('dirty and diverged software never silently overwrites the other Mac',t=>{
 const f=fixture(t);fs.appendFileSync(path.join(f.b,'app/example.mjs'),'// own change\n');assert.notEqual(f.action(f.b,'haal').status,0);assert.match(fs.readFileSync(path.join(f.b,'app/example.mjs'),'utf8'),/own change/);
 fs.appendFileSync(path.join(f.a,'app/example.mjs'),'// A\n');assert.equal(f.action(f.a,'deel').status,0);assert.notEqual(f.action(f.b,'deel').status,0);assert.match(fs.readFileSync(path.join(f.b,'app/example.mjs'),'utf8'),/own change/);
});
test('forced local data in index stops sharing before upload',t=>{
 const f=fixture(t);f.git(f.a,'add','-f','app/data/montages.json');const head=f.git(f.a,'rev-parse','origin/main').stdout;const r=f.action(f.a,'deel');assert.notEqual(r.status,0);assert.match(r.stderr,/Lokaal bestand/);assert.equal(f.git(f.a,'rev-parse','origin/main').stdout,head);
});
