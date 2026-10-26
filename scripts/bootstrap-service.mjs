import {setTimeout as wait} from 'node:timers/promises';
export async function bootstrapService(run,domain,destination,{pause=wait,attempts=4}={}){
 let result;
 for(let attempt=0;attempt<attempts;attempt++){
  result=run('/bin/launchctl',['bootstrap',domain,destination]);
  if(result.status===0)return;
  if(attempt<attempts-1)await pause(500*(attempt+1));
 }
 throw Error(result?.stderr||'Automatisch starten kon niet worden ingesteld.');
}
