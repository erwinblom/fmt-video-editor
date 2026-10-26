import {readStyle,saveStyle} from './own-style.mjs';
import {thumbnailService,thumbnailRunning} from './thumbnail-service.mjs';
import {transitionPreview,transitionFile} from './transition-preview.mjs';
import {cutProposalService} from './cut-proposal-service.mjs';
import {cutBatch,batchIsRunning} from './cut-batch.mjs';
import {elementProposalService,elementGenerationRunning} from './element-proposal-service.mjs';
import {elementReviewQueue} from './element-review-queue.mjs';
import {captionPreview} from './caption-preview.mjs';
import {elementAssets} from './element-assets.mjs';
import {reviewService} from './review-service.mjs';
import {auditService} from './audio-audit.mjs';
import {spawn} from 'node:child_process';
import {exportPlan} from './export-plan.mjs';
import {subtitleJobs} from './subtitle-jobs.mjs';
import {speakerJobs} from './speaker-jobs.mjs';
import {analysisJobs} from './analysis-jobs.mjs';
import {interviewStore} from './interviews.mjs';
import {DEFAULT_FRAMING,validateGuestCrop,validateGuestFrames} from './public/framing.mjs';
import {exportJobs} from './export-jobs.mjs';
import {validateEdits} from './public/model.mjs';
import http from 'node:http';
import {python,templateDir} from './runtime-config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)), port=Number(process.env.FMT_EDITOR_PORT||4319);
const interviews=interviewStore(root);

function loadContext(id){const ctx=interviews.context(id),catalog=JSON.parse(fs.readFileSync(ctx.catalogFile,'utf8'));catalog.framing??=DEFAULT_FRAMING;catalog.primarySpeaker??='Gast';catalog.speakers=speakerJobs(root,ctx.root).read();let proposalBank=fs.existsSync(ctx.bankFile)?JSON.parse(fs.readFileSync(ctx.bankFile,'utf8')):null;const analysisFile=path.join(ctx.root,'data/analysis-status.json');if(fs.existsSync(analysisFile)){const job=JSON.parse(fs.readFileSync(analysisFile,'utf8'));if(job.status==='complete'&&/^analysis-result-[a-zA-Z0-9-]+\.json$/.test(job.resultFile||'')){const resultFile=path.join(ctx.root,'data',job.resultFile);if(fs.existsSync(resultFile)){const latest=JSON.parse(fs.readFileSync(resultFile,'utf8'));if(latest.id===proposalBank?.id&&latest.sourceTitle===catalog.title)proposalBank=latest;}}}if(Array.isArray(proposalBank?.teaser))catalog.teaserCandidates=[...new Set([...catalog.teaserCandidates,...proposalBank.teaser.map(q=>q.id)])];const exports=exportJobs(ctx.root,catalog,{appRoot:root,source:ctx.exportSource,metadata:ctx.metadata,projectId:id});return {...ctx,catalog,proposalBank,exports};}
function valid(s,catalog){
 validateGuestCrop(s.guestCrop,catalog);
 validateGuestFrames(s.guestFrames,catalog);
 if(s.version!==1||!['quoteverhaal','gespreksmontage'].includes(s.mode)||!Number.isFinite(s.target)||s.target<30||s.target>7200)throw Error('Ongeldige montage');
 for(const mode of ['quoteverhaal','gespreksmontage']){
  const m=s.modes?.[mode];if(m?.selectionAngle!==undefined&&(typeof m.selectionAngle!=='string'||m.selectionAngle.length>1000))throw Error('Ongeldige redactie-aanwijzing');if(!m||!Array.isArray(m.blocks)||m.blocks.length>100||!Array.isArray(m.teaser)||m.teaser.length>3||new Set(m.teaser).size!==m.teaser.length)throw Error('Ongeldige blokken');
  const check=id=>{const q=catalog.quotes[id];if(!q||mode==='quoteverhaal'&&!catalog.imported&&q.speaker!==catalog.primarySpeaker)throw Error('Onbekend of ongeldig bronfragment');};
  m.teaser.forEach(check);
  for(const b of m.blocks){if(typeof b.id!=='string'||typeof b.title!=='string'||b.title.length>200||!Array.isArray(b.clipIds)||b.clipIds.length>2000||new Set(b.clipIds).size!==b.clipIds.length)throw Error('Ongeldig blok');b.clipIds.forEach(check);}
  if(new Set(m.blocks.map(b=>b.id)).size!==m.blocks.length)throw Error('Dubbel blok');
  validateEdits(m,catalog,mode);
 }
 return s;
}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function mediaType(p){return ({'.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.aac':'audio/aac','.ogg':'audio/ogg','.flac':'audio/flac','.webm':'video/webm','.mov':'video/quicktime'})[path.extname(p)]||'video/mp4';}
function file(req,res,p,type){const stat=fs.statSync(p),range=req.headers.range;let start=0,end=stat.size-1,status=200;
 if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match){res.writeHead(416);return res.end();}start=+match[1];end=match[2]?Math.min(+match[2],end):end;if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}status=206;}
 const headers={'Content-Type':type,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(p,{start,end});req.on('close',()=>stream.destroy());stream.pipe(res);
}
http.createServer(async(req,res)=>{
 try{
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return json(res,403,{error:'Alleen lokaal'});
 const url=new URL(req.url,`http://localhost:${port}`);
 const localOrigin=[`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin);
 if(url.pathname==='/api/own-style'){
  if(req.method==='GET')return json(res,200,readStyle(root));
  if(req.method!=='POST')return json(res,405,{error:'Onbekende actie'});
  if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2900000)return json(res,413,{error:'Logo te groot'});}
  return json(res,200,saveStyle(root,JSON.parse(raw)));
 }
 const adminMetadata=/^\/api\/interviews\/(demo|[a-f0-9-]{36})\/metadata$/.exec(url.pathname);
 const adminArchive=/^\/api\/interviews\/(demo|[a-f0-9-]{36})\/archive$/.exec(url.pathname);
 const adminRestore=/^\/api\/admin\/trash\/(\d+-(?:demo|[a-f0-9-]{36}))\/restore$/.exec(url.pathname);
 const adminPurge=/^\/api\/admin\/trash\/(\d+-(?:demo|[a-f0-9-]{36}))$/.exec(url.pathname);
 if(url.pathname==='/api/admin/trash'&&req.method==='GET')return json(res,200,interviews.listTrash());
 if((adminMetadata&&req.method==='PATCH'||adminArchive&&req.method==='POST'||adminRestore&&req.method==='POST'||adminPurge&&req.method==='DELETE')){
  if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>8000)return json(res,413,{error:'Verzoek te groot'});}
  const body=raw?JSON.parse(raw):{};
  if(adminMetadata)return json(res,200,interviews.updateMetadata(adminMetadata[1],body));
  if(adminArchive){if(thumbnailRunning(interviews.context(adminArchive[1]).root)||batchIsRunning(interviews.context(adminArchive[1]).root)||elementGenerationRunning(interviews.context(adminArchive[1]).root))throw Error('Voor dit interview worden nog voorstellen gemaakt. Stop de ronde of wacht tot die klaar is.');return json(res,200,interviews.archive(adminArchive[1]));}
  if(adminRestore)return json(res,200,interviews.restore(adminRestore[1]));
  return json(res,200,interviews.purge(adminPurge[1]));
 }
 if(url.pathname==='/api/interviews'&&req.method==='GET')return json(res,200,interviews.list());
 if(url.pathname==='/api/interviews'&&req.method==='POST'){
  if(!localOrigin||req.headers['content-type']!=='application/octet-stream')return json(res,403,{error:'Ongeldige herkomst'});
  return json(res,201,await interviews.upload(req,url));
 }
 const mediaRoute=/^\/api\/interviews\/([a-f0-9-]{36})\/media$/.exec(url.pathname);
 if(mediaRoute&&req.method==='GET'){const source=interviews.media(mediaRoute[1]);return file(req,res,source,mediaType(source));}
 const interviewRoute=/^\/api\/interviews\/([a-f0-9-]{36})(\/retry)?$/.exec(url.pathname);
 if(interviewRoute){if(req.method==='GET'&&!interviewRoute[2])return json(res,200,interviews.read(interviewRoute[1]));if(req.method==='POST'&&interviewRoute[2]&&localOrigin){let raw='';for await(const c of req){raw+=c;if(raw.length>1000)throw Error('Verzoek te groot');}return json(res,202,interviews.start(interviewRoute[1],raw?JSON.parse(raw):{}));}return json(res,405,{error:'Niet toegestaan'});}

 if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{app:'fmt-interview-editor',ready:true});
 if(url.pathname==='/'&&['GET','HEAD'].includes(req.method)&&!url.searchParams.has('project')){
  const items=interviews.list();
  if(!items.some(i=>i.id==='demo')){
   const ready=items.find(i=>i.status==='ready');
   if(ready){res.writeHead(302,{Location:'/?project='+ready.id});return res.end();}
   return file(req,res,path.join(root,'public/welcome.html'),'text/html; charset=utf-8');
  }
 }
 const map={'/transition-panel.js':'transition-panel.js','/transitions.mjs':'transitions.mjs','/caption-preview.js':'caption-preview.js','/elements.mjs':'elements.mjs','/element-panel.js':'element-panel.js','/guest-crop.js':'guest-crop.js','/welcome.js':'welcome.js','/audio-audit.js':'audio-audit.js','/':'index.html','/storyline.mjs':'storyline.mjs','/subtitle-state.mjs':'subtitle-state.mjs','/speakers.mjs':'speakers.mjs','/speaker-panel.js':'speaker-panel.js','/app.js':'app.js','/interviews.js':'interviews.js','/model.mjs':'model.mjs','/framing.mjs':'framing.mjs','/sentences.mjs':'sentences.mjs','/proposals.mjs':'proposals.mjs','/export-status.mjs':'export-status.mjs','/style.css':'style.css','/target.svg':'target.svg','/Inter-Bold.ttf':'Inter-Bold.ttf','/Inter-Regular.ttf':'Inter-Regular.ttf'};
 map['/thumbnail-panel.js']='thumbnail-panel.js';
 map['/element-artwork.js']='element-artwork.js';
 map['/element-panel.css']='element-panel.css';
 map['/element-review-panel.js']='element-review-panel.js';
 map['/cut-proposal-panel.js']='cut-proposal-panel.js';
 map['/cut-batch-panel.js']='cut-batch-panel.js';
 Object.assign(map,{'/app-icon.svg':'app-icon.svg','/app-icon-192.png':'app-icon-192.png','/app-icon-512.png':'app-icon-512.png','/app.webmanifest':'app.webmanifest','/licenties':'licenses.html','/own-style.js':'own-style.js','/Inter-OFL.txt':'Inter-OFL.txt'});
 const name=map[url.pathname];if(name&&['GET','HEAD'].includes(req.method)){
 const types={'.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf'};file(req,res,path.join(root,'public',name),types[path.extname(name)]);return;}
 if(url.pathname==='/interview-frame.png')return file(req,res,path.join(templateDir,'assets/interview-frame.png'),'image/png');
 const project=url.searchParams.get('project')||'demo';
 const {catalog,proposalBank,exports,stateFile,source,exportSource,metadata,root:projectRoot}=loadContext(project);
 const thumbnails=thumbnailService(projectRoot,exportSource,stateFile,metadata,root);
 if(url.pathname==='/api/thumbnails'){
  if(req.method==='GET')return json(res,200,thumbnails.status());
  if(req.method!=='POST'||!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>2000)return json(res,413,{error:'Verzoek te groot'});}
  const input=JSON.parse(raw);if(!['start','save','frame'].includes(input.action))throw Error('Onbekende thumbnailactie.');
  return json(res,200,input.action==='start'?thumbnails.start():input.action==='frame'?await thumbnails.frame(input):await thumbnails.save(input));
 }
 const thumbnailImage=/^\/api\/thumbnails\/([a-f0-9]{64})\/(\d{3}|m\d{1,10})$/.exec(url.pathname);
 if(thumbnailImage&&['GET','HEAD'].includes(req.method))return file(req,res,thumbnails.image(thumbnailImage[1],thumbnailImage[2]),'image/jpeg');
 const thumbnailOutput=/^\/api\/thumbnail-output\/([a-f0-9]{64})\/([a-f0-9]{64})$/.exec(url.pathname);
 if(thumbnailOutput&&['GET','HEAD'].includes(req.method))return file(req,res,thumbnails.download(thumbnailOutput[1],thumbnailOutput[2]),'image/jpeg');
 const assets=elementAssets(projectRoot);
 const batch=cutBatch(root,projectRoot,catalog,exportSource,metadata,{context:()=>loadContext(project)});
 if(url.pathname==='/api/cut-batch'){
  if(req.method==='GET')return json(res,200,batch.read({scope:url.searchParams.get('scope')||undefined}));
  if(req.method!=='POST'||!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>2000)return json(res,413,{error:'Verzoek te groot'});}
  const input=JSON.parse(raw);if(!['start','stop'].includes(input.action))throw Error('Kies starten of stoppen.');
  return json(res,200,batch[input.action](input));
 }
 const cutProposalRoute=/^\/api\/cut-proposals\/(read|generate|preview|decide)$/.exec(url.pathname);
 if(cutProposalRoute&&req.method==='POST'){
  if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>12000)return json(res,413,{error:'Verzoek te groot'});}
  const input=JSON.parse(raw),service=cutProposalService(root,projectRoot,catalog,exportSource,metadata);
  const before=input.action==='apply'?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
  const response=await service[cutProposalRoute[1]](input);
  if(cutProposalRoute[1]==='decide'&&input.action!=='draft')response.batch=batch.refreshAfterDecision(input,response,before);
  return json(res,200,response);
 }
 if(url.pathname==='/api/element-review-queue'&&req.method==='GET')return json(res,200,elementReviewQueue(projectRoot,catalog,metadata).read({mode:url.searchParams.get('mode')||undefined}));
 if(url.pathname==='/api/element-review-queue/progress'&&req.method==='POST'){
  if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>2000)return json(res,413,{error:'Verzoek te groot'});}
  return json(res,200,elementReviewQueue(projectRoot,catalog,metadata).progress(JSON.parse(raw)));
 }
 const elementRoute=url.pathname==='/api/element-proposals',elementDecision=url.pathname==='/api/element-proposals/decide';
 if(elementRoute&&req.method==='GET')return json(res,200,elementProposalService(projectRoot,catalog,metadata).read(Object.fromEntries(url.searchParams)));
 if((elementRoute||elementDecision)&&req.method==='POST'){
  if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>30000)return json(res,413,{error:'Verzoek te groot'});}
  const service=elementProposalService(projectRoot,catalog,metadata),input=JSON.parse(raw);
  return json(res,200,elementDecision?service.decide(input):await service.generate(input));
 }
 if(url.pathname==='/api/element-assets'&&req.method==='POST'){
  if(!localOrigin||req.headers['content-type']!=='image/png')return json(res,403,{error:'Ongeldige herkomst of afbeelding'});
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>5*1024*1024)return json(res,413,{error:'Afbeelding is te groot'});chunks.push(c);}return json(res,201,assets.put(Buffer.concat(chunks)));
 }
 const elementImage=/^\/api\/element-assets\/([a-f0-9]{64})$/.exec(url.pathname);
 if(elementImage&&['GET','HEAD'].includes(req.method))return file(req,res,assets.file(elementImage[1]),'image/png');
 if(url.pathname==='/api/preview-captions'&&req.method==='POST'){if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});let raw='';for await(const c of req){raw+=c;if(raw.length>120000)return json(res,413,{error:'Verzoek te groot'});}return json(res,200,await captionPreview(root,JSON.parse(raw),JSON.parse(fs.readFileSync(stateFile,'utf8')),catalog));}
 if(url.pathname==='/api/transition-preview'&&req.method==='POST'){
  if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>2000)return json(res,413,{error:'Verzoek te groot'});}
  return json(res,200,await transitionPreview(root,projectRoot,exportSource,JSON.parse(raw),JSON.parse(fs.readFileSync(stateFile,'utf8')),catalog,metadata));
 }
 const transitionVideo=/^\/api\/transition-preview\/([a-f0-9]{64})$/.exec(url.pathname);
 if(transitionVideo&&['GET','HEAD'].includes(req.method))return file(req,res,transitionFile(projectRoot,transitionVideo[1]),'video/mp4');
 const audit=auditService(root,projectRoot,catalog,exportSource);
 if(url.pathname==='/api/reviews'&&req.method==='POST'){
  if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>256000)return json(res,413,{error:'Verzoek te groot'});}
  return json(res,200,reviewService(projectRoot,catalog,exportSource).confirm(JSON.parse(raw)));
 }

 if(url.pathname==='/api/audio-audit'&&req.method==='GET')return json(res,200,audit.read());
 if(['/api/audio-audit','/api/audio-audit/resolve'].includes(url.pathname)&&req.method==='POST'){
  if(!localOrigin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>4000)return json(res,413,{error:'Verzoek te groot'});}
  const input=JSON.parse(raw);return json(res,200,url.pathname.endsWith('/resolve')?audit.resolve(input):audit.start(input.revision));
 }
 if(url.pathname==='/api/subtitles/download'&&req.method==='GET'){
  const state=valid(JSON.parse(fs.readFileSync(stateFile,'utf8')),catalog);
  if(url.searchParams.get('mode')!==state.mode)throw Error('Je montagevorm is gewijzigd. Bewaar en probeer opnieuw.');
  const plan=exportPlan(state,catalog);
  const result=await new Promise((resolve,reject)=>{
   const child=spawn(python,[path.join(root,'caption_layout.py')],{stdio:['pipe','pipe','pipe']});let out='',err='';
   child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.stdin.on('error',()=>{});child.on('close',code=>code===0?resolve(out):reject(Error('Ondertitels exporteren mislukt. '+err.slice(-300))));child.stdin.end(JSON.stringify({plan,catalog}));
  });
  res.writeHead(200,{'Content-Type':'application/x-subrip; charset=utf-8','Content-Disposition':`attachment; filename=ondertitels-${plan.subtitleLanguage}.srt`,'Cache-Control':'no-store'});return res.end(result);
 }
 if(url.pathname==='/api/subtitles'){
  const jobs=subtitleJobs(root,projectRoot,catalog);
  if(req.method==='GET')return json(res,200,jobs.read());
  if(req.method==='POST'&&localOrigin&&req.headers['content-type']==='application/json'){
   let raw='';for await(const c of req){raw+=c;if(raw.length>2000)return json(res,413,{error:'Verzoek te groot'});}
   return json(res,202,jobs.start(JSON.parse(raw)));
  }
  return json(res,403,{error:'Ongeldige herkomst'});
 }
 if(url.pathname==='/api/speakers'){
  if(project==='demo')return json(res,400,{error:'Dit bestaande project gebruikt zijn gecontroleerde sprekerlabels.'});
  const jobs=speakerJobs(root,projectRoot);
  if(req.method==='GET')return json(res,200,jobs.read());
  if(req.method==='POST'&&localOrigin&&req.headers['content-type']==='application/json'){let raw='';for await(const c of req){raw+=c;if(raw.length>150000)return json(res,413,{error:'Sprekerwijziging te groot'});}const input=JSON.parse(raw);return json(res,200,input.action==='save'?jobs.save(input):jobs.start(input));}
  return json(res,403,{error:'Ongeldige herkomst'});
 }
 if(url.pathname==='/api/analysis'){
  if(project==='demo')return json(res,400,{error:'Demo Werkplaats gebruikt zijn bestaande redactionele analyse.'});
  const jobs=analysisJobs(root,projectRoot);
  if(req.method==='GET'){const job=jobs.read();if(job.status==='complete'&&job.resultFile)job.bank=JSON.parse(fs.readFileSync(path.join(projectRoot,'data',job.resultFile),'utf8'));return json(res,200,job);}
  if(req.method==='POST'&&localOrigin&&req.headers['content-type']==='application/json'){let raw='';for await(const c of req){raw+=c;if(raw.length>12000)return json(res,413,{error:'Aanwijzing te lang'});}return json(res,202,jobs.start(JSON.parse(raw)));}
  return json(res,403,{error:'Ongeldige herkomst'});
 }


 if(req.method==='POST'){
  if(![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin)||req.headers['content-type']!=='application/json')return json(res,403,{error:'Ongeldige herkomst'});
  if(url.pathname==='/api/exports'){let body='';for await(const c of req){body+=c;if(body.length>1000)return json(res,413,{error:'Verzoek te groot'});}const input=JSON.parse(body),state=valid(JSON.parse(fs.readFileSync(stateFile,'utf8')),catalog);if(input.revision!==(state.revision??0)||input.mode!==state.mode)return json(res,409,{error:'Je selectie is nog niet volledig bewaard. Probeer opnieuw.'});if(!catalog.synthetic&&input.manuallyReviewed!==true)audit.assertReady();return json(res,202,exports.start(state,{reviewMethod:catalog.synthetic?'synthetic-demo':input.manuallyReviewed===true?'manual':'automatic'}));}
  if(url.pathname!=='/api/state')return json(res,404,{error:'Onbekende actie'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>1500000)return json(res,413,{error:'Montage te groot'});}
  const state=valid(JSON.parse(raw),catalog);for(const m of Object.values(state.modes))for(const e of Object.values(m.edits||{}))if(e.element){for(const id of [e.element.artworkId,e.element.assetId].filter(Boolean))if(!fs.existsSync(assets.file(id)))throw Error('Elementbeeld ontbreekt; kies de afbeelding opnieuw.');}const oldState=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(state.revision!==(oldState.revision??0))return json(res,409,{error:'Deze montage is in een ander venster gewijzigd. Herlaad voordat je verder redigeert.'});state.revision=(oldState.revision??0)+1;const revisions=path.join(projectRoot,'data/herstel');fs.mkdirSync(revisions,{recursive:true});fs.copyFileSync(stateFile,path.join(revisions,`${Date.now()}.json`));const files=fs.readdirSync(revisions,{withFileTypes:true}).filter(d=>d.isFile()&&/^\d+\.json$/.test(d.name)).map(d=>d.name).sort();for(const old of files.slice(0,-40))fs.unlinkSync(path.join(revisions,old));
  fs.writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2));fs.renameSync(stateFile+'.tmp',stateFile);let proposals=null,proposalError=null;try{if(process.env.FMT_ALLOW_CLOUD==='1')proposals=batch.afterManualEdit(oldState,state);}catch(e){proposalError='Knip bewaard; voorstellen niet gestart: '+e.message;}return json(res,200,{saved:true,state:JSON.parse(fs.readFileSync(stateFile,'utf8')),proposals,proposalError});
 }
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Niet toegestaan'});
 if(url.pathname==='/api/exports')return json(res,200,exports.list());
 const exportRoute=/^\/api\/exports\/([a-f0-9-]{36})(?:\/(video|subtitles|poster))?$/.exec(url.pathname);
 if(exportRoute){const [,id,kind]=exportRoute,job=exports.read(id);if(!kind)return json(res,200,job);if(job.status!=='complete')return json(res,409,{error:'De video is nog niet klaar.'});if(kind==='poster')return file(req,res,exports.file(id,'poster.jpg'),'image/jpeg');if(kind==='subtitles')res.setHeader('Content-Disposition','attachment; filename=ondertitels-'+(job.subtitleLanguage||'nl')+'.srt');return file(req,res,exports.file(id,kind==='video'?(job.videoFile||'FMT-Demo Werkplaats.mp4'):(job.subtitleFile||'ondertitels-nl.srt')),kind==='video'?'video/mp4':'application/x-subrip; charset=utf-8');}
 if(url.pathname==='/api/proposal-bank')return json(res,200,proposalBank);
 if(url.pathname==='/api/catalog')return json(res,200,catalog);
 if(url.pathname==='/api/state'){const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));state.revision??=0;return json(res,200,state);}
 if(url.pathname==='/bron.mp4')return file(req,res,source,mediaType(source));
 if(url.pathname==='/proef.mp4')return file(req,res,path.join(root,'../proef-hyperframes/proef-twee-quotes.mp4'),'video/mp4');
 return json(res,404,{error:'Niet gevonden'});
 }catch(e){json(res,400,{error:e.message});}
}).listen(port,'127.0.0.1',()=>console.log(`FMT Editor: http://localhost:${port}`));
