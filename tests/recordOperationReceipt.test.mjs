import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareRecordOperation, createRecordOperationReceipt, resolveRecordOperationReceipt } from '../utils/server/recordOperationReceipt.js';

const operationId='01234567-89ab-4cde-8fab-0123456789ab';
const body={staffId:'0137',weightPrev:200,weightNow:190,isBottleExchange:false,name:'Fixture name',wardId:'6f'};
const context=()=>prepareRecordOperation(operationId,body);
const receipt=()=>createRecordOperationReceipt(context(),{recordId:'record-1',ml:11.47,committedAt:new Date('2026-10-21T00:00:00Z')});
test('prepares immutable operation context with Stage 1 normalization and SHA-256',()=>{
 const c=prepareRecordOperation(operationId,{...body,staffId:' ０１３７ ',weightPrev:'200.00'});
 assert.equal(c.canonicalRequest.staffId,'0137');assert.equal(c.canonicalRequest.previousWeight,200);
 assert.match(c.requestDigest,/^[0-9a-f]{64}$/);assert.equal(c.requestDigest,context().requestDigest);assert.equal(Object.isFrozen(c),true);
});
test('rejects invalid operation IDs and canonical request fields',()=>{
 for(const id of ['',null,123,[],operationId.toUpperCase(),operationId.replace('-4cde-','-1cde-')])assert.throws(()=>prepareRecordOperation(id,body),TypeError);
 assert.throws(()=>prepareRecordOperation(operationId,{...body,weightNow:NaN}),TypeError);
});
test('creates only explicitly selected minimal fields and replays original result',()=>{
 const saved=receipt();assert.equal(saved.schemaVersion,1);assert.equal(saved.resultVersion,1);
 assert.equal(saved.staffId,'0137');assert.equal(saved.recordId,saved.result.recordId);
 assert.deepEqual(saved.result,{ok:true,recordId:'record-1',staffId:'0137',lastWeight:190,ml:11.47});
 assert.equal(JSON.stringify(saved).includes(body.name),false);assert.equal(JSON.stringify(saved).includes('weightPrev'),false);
 const result=resolveRecordOperationReceipt(context(),saved);assert.equal(result.status,200);
 assert.deepEqual(result.success,{...saved.result,replayed:true});
});
test('conflicting saved request is a dedicated 409, never a new-save permission',()=>{
 const changed=prepareRecordOperation(operationId,{...body,weightNow:180});
 const result=resolveRecordOperationReceipt(changed,receipt());
 assert.equal(result.status,409);assert.equal(result.code,'OPERATION_ID_REUSED_WITH_DIFFERENT_REQUEST');
});
for(const changes of [{schemaVersion:2},{resultVersion:2},{staffId:123},{recordId:''},{requestDigest:'bad'},
 {committedAt:null},{extra:'PRIVATE'},{result:{ok:true,secret:'PRIVATE'}},
 {result:{ok:true,recordId:'record-1',staffId:'0137',lastWeight:NaN,ml:11.47}},
 {result:{ok:true,recordId:'record-1',staffId:'0137',lastWeight:190,ml:Infinity}},
 {result:{ok:true,recordId:'record-1',staffId:'0137',lastWeight:190,ml:99}}]) {
 test(`malformed receipt fails closed: ${Object.keys(changes)[0]}`,()=>{
  const result=resolveRecordOperationReceipt(context(),{...receipt(),...changes});
  assert.equal(result.status,503);assert.equal(result.code,'OPERATION_RESULT_UNAVAILABLE');assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
 });
}
test('missing receipt fields and invalid record results never grant success',()=>{
 for(const value of [null,[],{},'bad'])assert.equal(resolveRecordOperationReceipt(context(),value).status,503);
 const missing=receipt();delete missing.committedAt;assert.equal(resolveRecordOperationReceipt(context(),missing).status,503);
 for(const changes of [{recordId:''},{recordId:'x/y'},{ml:10},{committedAt:null}]) {
  assert.throws(()=>createRecordOperationReceipt(context(),{recordId:'record-1',ml:11.47,committedAt:1,...changes}),TypeError);
 }
});
test('pure receipt helpers have no SDK, credential, storage, logging or network access',()=>{
 const source=readFileSync(new URL('../utils/server/recordOperationReceipt.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/firebase|process\.env|console\.|fetch\s*\(|sessionStorage|localStorage|addDoc|setDoc|updateDoc|runTransaction|writeBatch/);
 assert.match(source,/recordRequestDigest\.js/);assert.match(source,/isSameRecordOperation\(/);
});
