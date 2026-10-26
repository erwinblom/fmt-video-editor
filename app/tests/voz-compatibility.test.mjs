import test from 'node:test';
import assert from 'node:assert/strict';
import {isVozCoreMLCompatibilityError} from '../desert-ant.mjs';
import {detectedLanguage} from '../voz-language.mjs';
test('only known CoreML decoder errors qualify for Voz compatibility route',()=>{
 for(const message of ["This MLModel doesn't support the multi-function description sytnax.","This MLModel doesn't support the multi-function description syntax.","`MLModelConfiguration`'s `.functionName` property must be `nil` unless the model type is ML Program."])assert.equal(isVozCoreMLCompatibilityError(Error(message)),true);
 for(const message of ['ENOENT','Invalid audio','Out of memory'])assert.equal(isVozCoreMLCompatibilityError(Error(message)),false);
});
test('automatic source language requires a supported language and sufficient confidence',()=>{
 assert.equal(detectedLanguage('auto-detected language: en (p = 0.954474)'),'en');
 for(const log of ['','auto-detected language: en (p = 0.2)','auto-detected language: xx (p = 0.99)'])assert.throws(()=>detectedLanguage(log),/Kies de brontaal/);
});
