// Desert Ant Labs (Voz / Who / SDK): https://license.desertant.com
// Powered by Desert Ant Labs: https://desertant.com — separate from our MIT code.
import {requireLicenseNetworkConsent} from './license-network.mjs';
import {command} from './runtime-config.mjs';
// Local official Voz 4.0.0 / model v0.4.0 compatibility route for macOS CoreML failures.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {detectedLanguage,VOZ_LANGUAGES} from './voz-language.mjs';
const [audio,output,requested='auto']=process.argv.slice(2);
try {
 requireLicenseNetworkConsent();
 if(!audio||!output)throw Error('Audio en uitvoerpad ontbreken.');
 let language=requested;
 if(language==='auto'){
  const {stdout,stderr}=await promisify(execFile)((process.env.FMT_WHISPER_BIN||command('whisper-cli')),['-m',(process.env.FMT_WHISPER_MODEL||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.runtime-models/whisper/ggml-small.bin')),'-f',audio,'-l','auto','-dl','-ng'],{timeout:120000,maxBuffer:1024*1024});
  language=detectedLanguage(stdout+'\n'+stderr);
 }
 if(!VOZ_LANGUAGES.has(language))throw Error('Deze brontaal wordt niet door Voz ondersteund.');
 const require=createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.runtime-voz-node/package.json'));
 const {Voz}=await import(pathToFileURL(require.resolve('@desert-ant-labs/voz')));
 const ort=await import(pathToFileURL(require.resolve('onnxruntime-node')));
 process.env.DAL_CACHE_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.runtime-desert-ant/models');
 const began=Date.now(),voz=await Voz.load({ort,revision:'v0.4.0'}),result=await voz.transcribe(audio);
 const value={text:result.text,words:result.words,language,engine:'Voz v0.4.0 / Desert Ant JS SDK 4.0.0 / ONNX CPU (CoreML compatibility)',elapsedSeconds:(Date.now()-began)/1000};
 fs.writeFileSync(output+'.tmp',JSON.stringify(value,null,2));fs.renameSync(output+'.tmp',output);
} catch(error){console.error(error.message);process.exitCode=1;}
