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
 const {renderThumbnail}=await import('../app/thumbnail-service.mjs');
 const frame=spawnSync('ffmpeg',['-v','error','-i','app/data/demo/source.mp4','-frames:v','1','-f','image2pipe','-vcodec','png','-']);assert.equal(frame.status,0);
 fs.writeFileSync('platform-evidence/thumbnail.jpg',await renderThumbnail(frame.stdout,'Mijn eerste montage'));proof.thumbnail=true;
 fs.writeFileSync('platform-evidence/result.json',JSON.stringify(proof,null,2));
}finally{if(browser)await browser.close();if(server&&server.exitCode===null)await stop();}
