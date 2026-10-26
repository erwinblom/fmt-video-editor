import {spawnSync} from 'node:child_process';
const run=(args)=>{const r=spawnSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024});if(r.status!==0)throw Error(r.stderr||'Git-controle mislukt');return r.stdout;};
const forbidden=/(^|\/)(?:data|controle|\.runtime[^/]*|\.venv|node_modules|\.local-history)(\/|$)|(^|\/)\.env(\.|$)(?!example$)|(^|\/)\.fmt-local\.json$|\.(?:mp4|mov|mp3|m4a|zip|bundle)$/i;
export function assertSharedFiles({history=false}={}){
 const files=run(history?['rev-list','--objects','HEAD']:['ls-files','--stage']).trim().split('\n').filter(Boolean);
 const blobs=new Set();
 for(const line of files){
  const entry=history?/^([a-f0-9]+) (.+)$/.exec(line):/^\d+ ([a-f0-9]+) \d\t(.+)$/.exec(line);
  if(!entry)continue;const [,oid,name]=entry;
  if(forbidden.test(name)||/\.(?:wav|flac)$/i.test(name)&&name!=='template/assets/beat-80bpm.wav')throw Error('Lokaal bestand in de softwareversie: '+name);
  // Only inspect textual code/config/docs. Media and fonts remain opaque assets.
  if(/\.(?:mjs|js|py|sh|md|json|swift|command|example)$|(^|\/)\.gitignore$/.test(name))blobs.add(oid);
 }
 for(const oid of blobs){const value=run(['cat-file','-p',oid]);if(/\b(?:sk-proj-[A-Za-z0-9_-]{15,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/.test(value))throw Error('Mogelijke sleutel aangetroffen. Delen gestopt.');}
 return files.length;
}
if(process.argv[1]?.endsWith('check-shared-files.mjs'))try{console.log('Software gecontroleerd:',assertSharedFiles({history:process.argv.includes('--history')}),'Git-objecten/bestanden.');}catch(e){console.error(e.message);process.exitCode=1;}
