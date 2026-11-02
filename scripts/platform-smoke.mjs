import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {findEvidenceBrowser} from '../app/evidence-capture.mjs';
fs.mkdirSync('platform-evidence',{recursive:true});
const url='http://localhost:4319';let server;
async function start(){server=spawn(process.execPath,['app/server.mjs'],{stdio:'inherit'});for(let i=0;i<100;i++){try{if((await fetch(url+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Server start failed');}
async function stop(){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
async function api(route,body){const r=await fetch(url+route,{headers:{Origin:url,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;}
let browser;const proof={platform:process.platform};
try{
 await start();
 browser=await puppeteer.launch({executablePath:await findEvidenceBrowser(),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});await page.goto(url,{waitUntil:'networkidle0'});await page.screenshot({path:'platform-evidence/editor.png'});proof.browser=true;
 let state=await api('/api/state');state.modes[state.mode].blocks[0].title='Platformproef – café';
 state=(await api('/api/state',state)).state;await browser.close();browser=null;await stop();await start();assert.deepEqual(await api('/api/state'),state);proof.restart=true;
 const job=await api('/api/exports',{revision:state.revision,mode:state.mode});let result;
 for(let i=0;i<600;i++){result=await api('/api/exports/'+job.id);if(result.status!=='running')break;await new Promise(r=>setTimeout(r,2000));}
 assert.equal(result.status,'complete',JSON.stringify(result));
 const video=Buffer.from(await (await fetch(url+'/api/exports/'+job.id+'/video')).arrayBuffer());fs.writeFileSync('platform-evidence/export.mp4',video);
 const decode=spawnSync('ffmpeg',['-v','error','-i','platform-evidence/export.mp4','-f','null','-'],{encoding:'utf8'});assert.equal(decode.status,0,decode.stderr);proof.exportDecoded=true;
 const frame=await api('/api/thumbnails',{action:'frame',seconds:2});
 const saved=await api('/api/thumbnails',{action:'save',key:frame.key,id:frame.selectedId,title:'Mijn eerste montage'});
 const jpg=Buffer.from(await (await fetch(url+'/api/thumbnail-output/'+saved.key+'/'+saved.choice.output)).arrayBuffer());
 const sharp=(await import('sharp')).default;const size=await sharp(jpg).metadata();assert.equal(size.width,1280);assert.equal(size.height,720);fs.writeFileSync('platform-evidence/thumbnail.jpg',jpg);proof.thumbnail=true;
 browser=await puppeteer.launch({executablePath:await findEvidenceBrowser(),headless:true,args:['--no-sandbox']});
 const importPage=await browser.newPage();await importPage.setViewport({width:1440,height:1000});await importPage.goto(url,{waitUntil:'networkidle0'});
 await importPage.click('#settingsOpen');await importPage.click('#newInterview');await (await importPage.$('#uploadDialog input[name=media]')).uploadFile('app/data/demo/source.mp4');await importPage.type('#uploadDialog input[name=title]','Platformimport café');await importPage.click('#uploadStart');
 await importPage.waitForSelector('#openInterview:not([hidden])',{timeout:120000});await importPage.click('#openInterview');await importPage.waitForFunction(()=>new URL(location.href).searchParams.has('project'));
 const project=new URL(importPage.url()).searchParams.get('project');assert.notEqual(project,'demo');proof.guiImport=true;
 let imported=await api('/api/state?project='+project);imported.modes[imported.mode].blocks[0].title='Mijn opgeslagen hoofdstuk';imported=(await api('/api/state?project='+project,imported)).state;
 await importPage.reload({waitUntil:'networkidle0'});assert.deepEqual(await api('/api/state?project='+project),imported);
 await importPage.screenshot({path:'platform-evidence/imported-editor.png'});await browser.close();browser=null;await stop();await start();assert.deepEqual(await api('/api/state?project='+project),imported);proof.importedRestart=true;
 const importedJob=await api('/api/exports?project='+project,{revision:imported.revision,mode:imported.mode,manuallyReviewed:true});
 for(let i=0;i<600;i++){result=await api('/api/exports/'+importedJob.id+'?project='+project);if(result.status!=='running')break;await new Promise(r=>setTimeout(r,2000));}
 assert.equal(result.status,'complete',JSON.stringify(result));
 fs.writeFileSync('platform-evidence/imported.mp4',Buffer.from(await (await fetch(url+'/api/exports/'+importedJob.id+'/video?project='+project)).arrayBuffer()));
 const importedDecode=spawnSync('ffmpeg',['-v','error','-i','platform-evidence/imported.mp4','-f','null','-'],{encoding:'utf8'});assert.equal(importedDecode.status,0,importedDecode.stderr);proof.importedExportDecoded=true;
 fs.writeFileSync('platform-evidence/result.json',JSON.stringify(proof,null,2));
}finally{if(browser)await browser.close();if(server&&server.exitCode===null)await stop();}
