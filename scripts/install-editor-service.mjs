import '../app/runtime-config.mjs';
import {bootstrapService} from './bootstrap-service.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),app=path.join(root,'app');
const logs=path.join(os.homedir(),'Library/Logs/FMT-Editor-publicatie');
const label='nl.fmteditor.publicatiekandidaat',domain=`gui/${os.userInfo().uid}`,service=`${domain}/${label}`;
const destination=path.join(os.homedir(),'Library/LaunchAgents',label+'.plist');
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const plist=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(app,'server.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(os.homedir())}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>5</integer><key>ProcessType</key><string>Background</string>
<key>EnvironmentVariables</key><dict><key>FMT_EDITOR_PORT</key><string>${xml(process.env.FMT_EDITOR_PORT||4319)}</string><key>PATH</key><string>${xml(path.dirname(process.execPath))}:${xml(path.join(os.homedir(),'.local/bin'))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
<key>StandardOutPath</key><string>${xml(path.join(logs,'server.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(logs,'server-error.log'))}</string>
</dict></plist>\n`;
const run=(cmd,args)=>spawnSync(cmd,args,{encoding:'utf8'});
if(process.argv.includes('--remove')){run('/bin/launchctl',['bootout',service]);fs.rmSync(destination,{force:true});console.log('Automatisch starten uitgeschakeld. Projecten behouden.');}
else{
 fs.accessSync(path.join(app,'server.mjs'));fs.mkdirSync(logs,{recursive:true});fs.mkdirSync(path.dirname(destination),{recursive:true});
 if(fs.existsSync(destination))fs.copyFileSync(destination,destination+'.previous');
 fs.writeFileSync(destination,plist,{mode:0o644});
 const lint=run('/usr/bin/plutil',['-lint',destination]);if(lint.status!==0)throw Error(lint.stderr||lint.stdout);
 if(run('/bin/launchctl',['print',service]).status===0){const stop=run('/bin/launchctl',['bootout',service]);if(stop.status!==0)throw Error(stop.stderr);}
 run('/bin/launchctl',['enable',service]);
 try{await bootstrapService(run,domain,destination);}catch(error){
  if(fs.existsSync(destination+'.previous')){fs.copyFileSync(destination+'.previous',destination);await bootstrapService(run,domain,destination).catch(()=>{});}
  throw error;
 }
 console.log(`Automatisch starten ingesteld: ${destination}`);
}
