import {spawn} from 'node:child_process';
import {projectRoot} from '../app/runtime-config.mjs';
const port=process.env.FMT_EDITOR_PORT||'4319',url=`http://localhost:${port}`;
try { const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(1000)}); if(r.ok){console.error('Er draait al een editor op '+url+'. Gebruik dat venster, of kies een andere FMT_EDITOR_PORT in .fmt-local.json.');process.exit(1);} } catch {}
const child=spawn(process.execPath,['app/server.mjs'],{cwd:projectRoot,stdio:'inherit'});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',code=>process.exitCode=code||0);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
for(let n=0;n<100;n++){
 await new Promise(r=>setTimeout(r,200));
 if(child.exitCode!==null)break;
 try{if(!(await fetch(url+'/api/health')).ok)continue;}catch{continue;}
 console.log(`FMT Video Editor: ${url}. Houd dit venster open tijdens gebruik.`);
 if(!process.env.FMT_NO_OPEN){
  const [bin,args]=process.platform==='win32'?['rundll32',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  const opener=spawn(bin,args,{stdio:'ignore'});opener.on('error',()=>console.log('Open de bovenstaande link zelf in je browser.'));
 }
 break;
}
