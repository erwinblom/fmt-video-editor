import {mayProposeQuote,mayProposeTeaser} from './speakers.mjs';
import {resolveQuote} from './model.mjs';
const fps=25;
export function proposalDuration(montage,catalog){
 const state={mode:'proposal',modes:{proposal:montage}};
 const frames=(id,block)=>{const q=resolveQuote(state,catalog,id,block);return Math.max(1,Math.round((q.end-q.start)*fps));};
 return (300+montage.teaser.reduce((n,id)=>n+frames(id,'teaser'),0)+montage.blocks.reduce((n,b)=>n+75+b.clipIds.reduce((k,id)=>k+frames(id,b.id),0),0))/fps;
}
// This first local selector searches prepared passages; it does not call an LLM.
const stopWords=new Set('alleen uitsluitend enkel only de het een en of van voor op in met om aan bij naar over als dat die dit ik jij je mij we wil graag maak selectie minuten minuut focus vooral invalshoek interview beste belangrijkste vertellen laat zien kan kun zou moeten hoe wat welke the a an and or of for on in with about to'.split(' '));
const terms=text=>String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
const related=[['start','begin','beginnen','begint','onboarding'],['europa','europees','europese','europe','european','soevereiniteit'],['praktijk','praktisch','praktische','voorbeeld','voorbeelden','praktijkvoorbeeld','praktijkvoorbeelden'],['controle','regie','control','volgen'],['team','teams','samenwerken','samenwerking'],['kwaliteit','quality'],['integratie','integraties','integration','integrations'],['oprichting','ontstaan','begindagen','ontstaansgeschiedenis','founding','founded']];
export function angleRanking(units,angle,catalog){
 const ignored=new Set([...stopWords,...terms(catalog.title)]),keys=[...new Set(terms(angle).filter(t=>t.length>2&&!ignored.has(t)))];
 if(!keys.length)throw Error('Noem een concreet onderwerp in je redactie-aanwijzing, of laat het veld leeg voor een brede selectie.');
 const expanded=keys.map(k=>new Set(related.find(group=>group.includes(k))||[k]));
 const scored=units.map(u=>{const title=terms(catalog.catalog.quoteverhaal.find(b=>b.id===u.blockId)?.title||''),body=terms(u.clips.map(c=>c.nl).join(' '));const matches=expanded.filter(group=>body.some(t=>group.has(t))||title.some(t=>group.has(t)));return {...u,angleScore:matches.length/expanded.length};});
 // Require at least half of the meaningful request terms, so a shared company name cannot carry a match.
 return scored.filter(u=>u.angleScore>=.5).sort((a,b)=>b.angleScore-a.angleScore||b.priority-a.priority);
}
export function buildProposal(state,catalog,bank,target,angle=''){
 if(bank?.kind==='thematic')return buildThematicProposal(state,catalog,bank,target,angle);
 if(!Number.isFinite(target)||target<30||target>7200)throw Error('Kies een tijdlimiet tussen een halve minuut en twee uur.');
 if(bank.sourceTitle!==catalog.title)throw Error('Dit selectievoorstel hoort bij een ander interview.');
 if(typeof angle!=='string'||angle.length>1000)throw Error('Gebruik maximaal 1000 tekens voor de redactie-aanwijzing.');
 angle=angle.trim();
 if(/\b(geen|zonder|niet|verwijder|schrap|weglaten|weggooien|chronologisch|opbouw|toon|spannend|rustig|korter|langer)\b/i.test(angle))throw Error('Je redactie-aanwijzing is bewaard, maar deze proef kan haar nog niet automatisch uitvoeren. Onderwerpkeuze werkt al met bijvoorbeeld ‘Focus op …’ of ‘Alleen …’. Je huidige montage blijft behouden.');
 const strict=!!angle&&/\b(alleen|uitsluitend|enkel|only)\b/i.test(angle);
 const matches=angle?angleRanking(bank.units,angle,catalog):bank.units;
 const ranked=angle&&!strict?[...matches,...bank.units.filter(u=>!matches.some(m=>m.id===u.id))]:matches;
 if(!matches.length)throw Error('Geen voldoende passende voorbereide passages gevonden. Je montage blijft behouden. Probeer een andere invalshoek; analyse van het volledige interview op vrije opdrachten volgt nog.');
 const matchingTeasers=strict?bank.teaser.filter(t=>ranked.some(u=>u.clips.some(c=>t.start>=c.start&&t.end<=c.end))):bank.teaser;
 const mode=state.mode,maxFrames=Math.floor(target*fps),teaser=matchingTeasers.map(c=>c.id),edits={};
 function edit(c){if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end>catalog.duration||c.end-c.start<.04||!c.nl?.trim())throw Error('Ongeldig bronfragment in het voorstel.');return {start:c.start,end:c.end,nl:c.nl,translationReviewed:false};}
 for(const c of matchingTeasers){if(!catalog.quotes[c.id]||catalog.quotes[c.id].speaker!=='Gast')throw Error('Ongeldige teaser in het voorstel.');edits[`teaser:${c.id}`]=edit(c);}
 const units=ranked.map(unit=>({...unit,clips:unit.clips.flatMap(c=>{const id=mode==='gespreksmontage'?c.conversationId:c.quoteId;if(!id)return [];if(!catalog.quotes[id]||mode==='quoteverhaal'&&catalog.quotes[id].speaker!=='Gast')throw Error('Onbekende bronquote in het voorstel.');return [{id,...edit(c)}];})})).filter(u=>u.clips.length).sort((a,b)=>(b.angleScore||0)-(a.angleScore||0)||b.priority-a.priority);
 let used=300+matchingTeasers.reduce((n,c)=>n+Math.round((c.end-c.start)*fps),0);const chosen=[];let focusFrames=0,contextFrames=0;
 for(const u of units){const cost=75+u.clips.reduce((n,c)=>n+Math.round((c.end-c.start)*fps),0);if(chosen.length===0&&used+cost>maxFrames)throw Error(`Voor de opening en een complete passende passage is minimaal ${Math.ceil((used+cost)/fps)} seconden nodig.`);const focused=!!u.angleScore;
  // Supporting material may complement a focus, but must not outweigh it.
  if(angle&&!strict&&!focused&&contextFrames+cost>focusFrames)continue;
  if(used+cost<=maxFrames){chosen.push(u);used+=cost;if(focused)focusFrames+=cost;else contextFrames+=cost;}}
 if(angle&&!chosen.some(u=>matches.some(m=>m.id===u.id)))throw Error('Er past geen complete passage over je invalshoek binnen deze tijdlimiet. Kies meer tijd.');
 if(!chosen.length)throw Error('Er past geen complete passage in deze tijdlimiet.');
 const blocks=chosen.sort((a,b)=>a.order-b.order).map(u=>{const base=catalog.catalog[mode].find(b=>b.id===u.blockId);if(!base)throw Error('Onderwerp ontbreekt in de bron.');for(const c of u.clips)edits[`${u.blockId}:${c.id}`]={start:c.start,end:c.end,nl:c.nl,translationReviewed:false};return {...structuredClone(base),clipIds:u.clips.map(c=>c.id),reason:u.reason};});
 const montage={blocks,teaser,edits,proposal:{source:bank.id,target,angle,strict,warning:angle?`Dit voorstel zoekt op onderwerp in de voorbereide passages, niet in het volledige transcript. ${teaser.length<3?`Er ${teaser.length===1?"is":"zijn"} ${teaser.length} passende korte teaserquote${teaser.length===1?"":"s"} beschikbaar. Minder dan drie teasers is toegestaan.`:""}`:"",initialDuration:used/fps,summary:angle?`Redactie-aanwijzing: ${angle}. ${strict?"Alleen passende passages; geen aanvulling met andere onderwerpen.":"Passende passages vormen de hoofdmoot; ander materiaal mag het verhaal aanvullen."}`:bank.summary,method:bank.method,selectedUnits:chosen.map(u=>u.id),omittedUnits:units.filter(u=>!chosen.includes(u)).map(u=>u.id)}};
 if(proposalDuration(montage,catalog)>target+.00001)throw Error('Het voorstel overschrijdt de tijdlimiet.');
 return montage;
}


// Select complete source passages; never let generated prose or a target length set a cut.
export function buildThematicProposal(state,catalog,bank,target,angle=''){
 if(!Number.isFinite(target)||target<30||target>7200)throw Error('Kies een tijdlimiet tussen een halve minuut en twee uur.');
 if(bank.sourceTitle!==catalog.title||catalog.analysis?.id!==bank.id)throw Error('Analyse en interview komen niet overeen. Herlaad de editor.');
 if(angle.trim()&&(bank.direction||'')!==angle.trim())throw Error('Laat eerst je redactie-aanwijzing analyseren.');
 if(state.mode==='quoteverhaal'&&catalog.imported&&(!catalog.speakers?.voices?.some(v=>v.role==='guest')))throw Error('Koppel eerst bij Sprekers een stem aan Geïnterviewde. Je montage blijft behouden.');
 const pool=state.mode==='quoteverhaal'&&bank.quoteUnits?bank.quoteUnits.map(u=>{const parent=bank.units.find(p=>p.id===u.parentId);return {...u,eligible:u.eligible!==false&&parent?.eligible!==false,priority:bank.direction?Math.min(u.priority,parent?.priority||0):u.priority};}):bank.units;
 const allowed=pool.filter(u=>u.eligible!==false&&u.priority>=50&&(state.mode!=='quoteverhaal'||u.standalone&&mayProposeQuote(catalog,catalog.quotes[u.id])));
 if(!allowed.length)throw Error('Geen bruikbare bronpassages gevonden voor deze aanwijzing en montagevorm. Je montage blijft behouden.');
 const length=u=>Math.round((u.clips[0].end-u.clips[0].start)*fps),max=Math.floor(target*fps);
 const ranked=[...allowed].sort((a,b)=>b.priority-a.priority||a.sourceOrder-b.sourceOrder);
 const teaserSource=bank.teaserUnits?bank.teaserUnits.filter(t=>bank.units.some(u=>u.id===t.parentId&&u.eligible!==false&&u.priority>=50)):ranked;
 const teaserUnits=teaserSource.filter(u=>u.standalone&&(!catalog.imported||mayProposeTeaser(catalog,catalog.quotes[u.id]))&&length(u)<=15*fps).sort((a,b)=>Number(b.teaser)-Number(a.teaser)||b.priority-a.priority).slice(0,3);
 let used=300+teaserUnits.reduce((n,u)=>n+length(u),0);const chosen=[],themes=new Set(),remaining=[...ranked];
 while(remaining.length){remaining.sort((a,b)=>(b.priority+(themes.has(b.blockId)?10:0))-(a.priority+(themes.has(a.blockId)?10:0))||a.sourceOrder-b.sourceOrder);const u=remaining.shift();if(state.mode==='quoteverhaal'&&bank.quoteUnits&&chosen.some(c=>c.clips[0].start<u.clips[0].end&&u.clips[0].start<c.clips[0].end))continue;const cost=length(u)+(themes.has(u.blockId)?0:75);if(used+cost>max)continue;chosen.push(u);themes.add(u.blockId);used+=cost;}
 if(!chosen.length)throw Error('Geen complete passage past naast de opening en kaarten. Kies een langere tijdlimiet. Je montage blijft behouden.');
 const edits={},addEdit=(u,block)=>{const c=u.clips[0],q=catalog.quotes[u.id];if(!q||q.start!==c.start||q.end!==c.end||q.text!==c.text)throw Error('Bronpassage wijkt af van de analyse.');edits[`${block}:${u.id}`]={start:q.start,end:q.end,nl:q.nl||'',translationReviewed:false};};
 const blocks=catalog.catalog[state.mode].filter(b=>themes.has(b.id)).map(b=>({...structuredClone(b),clipIds:chosen.filter(u=>u.blockId===b.id).sort((a,b)=>a.clips[0].start-b.clips[0].start).map(u=>{addEdit(u,b.id);return u.id;})}));
 teaserUnits.forEach(u=>addEdit(u,'teaser'));
 const warning=[teaserUnits.length<3?`${teaserUnits.length===1?"Er is 1 korte zelfstandige teaserpassage gevonden":"Er zijn "+teaserUnits.length+" korte zelfstandige teaserpassages gevonden"}; minder dan drie teasers is toegestaan.`:'','Automatisch transcript en AI-voorstel: controleer sprekers, zinsgrenzen en betekenis tegen de bron.'].filter(Boolean).join(' ');
 const montage={blocks,teaser:teaserUnits.map(u=>u.id),edits,selectionAngle:angle,proposal:{source:bank.id,target,angle,strict:/\b(alleen|uitsluitend|enkel|only)\b/i.test(angle),initialDuration:used/fps,summary:bank.summary,warning,method:bank.method,thematic:true,selectedUnits:chosen.map(u=>u.id),omittedUnits:bank.units.filter(u=>!chosen.some(c=>c.id===u.id||c.parentId===u.id)).map(u=>u.id)}};
 if(proposalDuration(montage,catalog)>target+.00001)throw Error('Voorstel is langer dan je tijdlimiet. Je montage blijft behouden.');return montage;
}
