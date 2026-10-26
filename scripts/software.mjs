import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {projectRoot} from '../app/runtime-config.mjs';
import {assertSharedFiles} from './check-shared-files.mjs';
const action=process.argv[2]||'status';
function git(args,{allowFailure=false}={}){const r=spawnSync('git',args,{cwd:projectRoot,encoding:'utf8',maxBuffer:20*1024*1024});if(r.status!==0&&!allowFailure)throw Error(r.stderr?.trim()||'Git-opdracht mislukt.');return r;}
function idle(){
 const home=path.join(projectRoot,'app/data');if(!fs.existsSync(home))return;
 const visit=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){if(!['herstel','auphonic-cache','.trash'].includes(e.name))visit(p);}else if(/^(?:interview|status|analysis-status|subtitle-status|audio-audit|speakers)\.json$/.test(e.name)){
  let s;try{s=JSON.parse(fs.readFileSync(p,'utf8'));}catch{continue;}
  if(['running','processing'].includes(s.status)||s.backgroundProcessing){let active=!s.pid;if(s.pid)try{process.kill(s.pid,0);active=true;}catch{}if(active)throw Error('Er loopt nog verwerking in de editor. Wacht tot die klaar is.');}
 }}};visit(home);
}
function dirty(){return git(['status','--porcelain','--untracked-files=all']).stdout.trim();}
function tracking(){const r=git(['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}'],{allowFailure:true});if(r.status!==0)throw Error('Deze softwarekopie is nog niet gekoppeld. Laat Chief de privé-repository aansluiten.');return r.stdout.trim();}
try{
 if(action==='status'){console.log(git(['status','--short','--branch']).stdout);process.exit(0);}
 if(!['haal','deel'].includes(action))throw Error('Kies status, haal of deel.');
 const lock=path.join(projectRoot,'.git','fmt-software.lock');
 try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}catch{throw Error('Er loopt al een softwareoverdracht. Probeer het daarna opnieuw.');}
 try{
 idle();const upstream=tracking();
 const [remote,...branchParts]=upstream.split('/'),branch=branchParts.join('/');
 if(action==='haal'&&dirty())throw Error('Er staan eigen softwarewijzigingen klaar. Deel die eerst of laat Chief ze veilig bewaren.');
 git(['fetch',remote]);
 if(action==='haal'){
  const iconCheck=spawnSync(process.execPath,['scripts/check-app-icon.mjs'],{cwd:projectRoot,stdio:'inherit'});if(iconCheck.status!==0)throw Error('Appiconencontrole mislukt; update gestopt.');
  git(['merge','--ff-only',upstream]);
  const install=spawnSync('npm',['ci'],{cwd:projectRoot,stdio:'inherit'});if(install.status!==0)throw Error('Software opgehaald, maar installatie niet voltooid. Start Installeer FMT Video Editor.command.');
  if(process.platform==='darwin'){const app=spawnSync(process.execPath,['scripts/make-mac-app.mjs'],{cwd:projectRoot,stdio:'inherit'});if(app.status!==0)throw Error('Software opgehaald, maar Mac-startapp niet bijgewerkt. Voer npm run app:mac uit.');}
  console.log('Software bijgewerkt. Video’s en projecten zijn behouden. Herstart de editor om de nieuwe versie te gebruiken.');
 }else{
  if(git(['merge-base','--is-ancestor',upstream,'HEAD'],{allowFailure:true}).status!==0)throw Error('De andere Mac heeft al wijzigingen gedeeld. Laat Chief beide versies samenvoegen; er is niets overschreven.');
  git(['add','--all']);
  assertSharedFiles();assertSharedFiles({history:true});
  const icons=spawnSync(process.execPath,['scripts/check-app-icon.mjs'],{cwd:projectRoot,stdio:'inherit'});if(icons.status!==0)throw Error('Appiconencontrole mislukt; er is niets gedeeld.');
  const tests=spawnSync(process.execPath,['--test',...fs.readdirSync(path.join(projectRoot,'app/tests')).filter(n=>n.endsWith('.test.mjs')).map(n=>'app/tests/'+n)],{cwd:projectRoot,stdio:'inherit'});
  if(tests.status!==0)throw Error('De controles slagen nog niet. Er is niets gedeeld.');
  if(git(['diff','--cached','--quiet'],{allowFailure:true}).status!==0)git(['commit','-m',process.argv[3]||'Werk FMT Video Editor bij']);
  assertSharedFiles({history:true});
  git(['push',remote,`HEAD:refs/heads/${branch}`]);
  console.log('Softwarewijzigingen gedeeld. Haal ze op de andere Mac op. Video’s en projecten blijven lokaal.');
 }
 }finally{fs.rmSync(lock,{force:true});}
}catch(e){console.error('\n'+e.message);process.exitCode=1;}
