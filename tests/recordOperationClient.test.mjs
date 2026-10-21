import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createRecordOperationLifecycle, PENDING_RECORD_OPERATION_KEY as KEY, RECORD_RESULT_UNKNOWN_MESSAGE,
  readPendingRecordOperation, ensureNoPendingRecordOperation, savePendingRecordOperation,
  clearPendingRecordOperation, isKnownRecordFailure, isValidRecordSuccess,
} from '../utils/recordOperationClient.js';
const id='01234567-89ab-4cde-8fab-0123456789ab', other='01234567-89ab-4cde-9fab-0123456789ab';
const now=Date.now();
const pending=(changes={})=>({staffId:'0137',operationId:id,savedAt:now,...changes});
function storage(raw=null){const data=new Map();if(raw!==null)data.set(KEY,raw);return{data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('lifecycle lazily creates one ID across repeat clicks, weights and workflow stages',()=>{
 let calls=0;const life=createRecordOperationLifecycle(()=>{calls++;return calls===1?id:other;});assert.equal(calls,0);
 for(let stage=0;stage<4;stage++)assert.equal(life.begin('0137'),id);
 life.markSent('0137',id);assert.equal(life.cancelUnsent(),false);assert.equal(life.begin('0137'),id);assert.equal(calls,1);
 life.complete('0137',id);assert.equal(life.current(),null);assert.equal(life.begin('0137'),other);assert.equal(calls,2);
});
test('unsent cancellation may end an ID, sent or unresolved operations cannot be abandoned',()=>{
 let n=0;const life=createRecordOperationLifecycle(()=>++n===1?id:other);
 assert.equal(life.begin('0137'),id);assert.equal(life.cancelUnsent(),true);assert.equal(life.begin('0137'),other);
 life.markSent('0137',other);assert.equal(life.cancelUnsent(),false);life.block();
 assert.throws(()=>life.begin('0137'));assert.throws(()=>life.complete('0137',other));assert.equal(life.cancelUnsent(),false);
 assert.equal(life.current().operationId,other);assert.equal(n,2);
});
test('staff change, malformed IDs and completion before sending fail closed',()=>{
 const life=createRecordOperationLifecycle(()=>id);life.begin('0137');
 assert.throws(()=>life.begin('9815'));assert.throws(()=>life.complete('0137',id));
 assert.throws(()=>life.markSent('9815',id));assert.throws(()=>life.markSent('0137',other));
 assert.throws(()=>createRecordOperationLifecycle(()=> 'bad').begin('0137'));
 assert.throws(()=>life.begin('０１３７'));
});
test('pending contains exactly three fields and never overwrites a draft',()=>{
 const s=storage(),draftKey='mamoru-te:record-update-draft:v1';s.data.set(draftKey,'original-draft');
 savePendingRecordOperation(s,'0137',id,now);
 assert.deepEqual(JSON.parse(s.getItem(KEY)),pending());assert.equal(s.data.get(draftKey),'original-draft');assert.notEqual(KEY,draftKey);
 assert.deepEqual(Object.keys(JSON.parse(s.getItem(KEY))).sort(),['operationId','savedAt','staffId']);
 assert.throws(()=>savePendingRecordOperation(s,'0137',id,now));assert.deepEqual(JSON.parse(s.getItem(KEY)),pending());
});
test('no TTL: old pending survives reload, guard never clears it or authorizes sending',()=>{
 const s=storage(JSON.stringify(pending({savedAt:1})));const before=s.getItem(KEY);
 assert.equal(readPendingRecordOperation(s,now).operationId,id);
 assert.throws(()=>ensureNoPendingRecordOperation(s),e=>e.message===RECORD_RESULT_UNKNOWN_MESSAGE);
 assert.equal(s.getItem(KEY),before);assert.throws(()=>ensureNoPendingRecordOperation(s));assert.equal(s.getItem(KEY),before);
});
for(const raw of ['broken','null','[]',JSON.stringify({...pending(),weightNow:'205'}),JSON.stringify({...pending(),challenge:'PRIVATE'}),
 JSON.stringify(pending({staffId:'9815',operationId:'bad'})),JSON.stringify(pending({savedAt:now+3600000})),
 JSON.stringify(pending({savedAt:NaN})),JSON.stringify(pending({savedAt:0}))])test(`corrupt pending is blocked and retained: ${raw.slice(0,22)}`,()=>{
 const s=storage(raw);assert.throws(()=>readPendingRecordOperation(s,now));assert.throws(()=>ensureNoPendingRecordOperation(s));assert.equal(s.getItem(KEY),raw);
});
test('pending for another staff is not erased or reused',()=>{
 const s=storage(JSON.stringify(pending()));assert.throws(()=>clearPendingRecordOperation(s,'9815',id));
 assert.throws(()=>clearPendingRecordOperation(s,'0137',other));assert.throws(()=>ensureNoPendingRecordOperation(s));assert.notEqual(s.getItem(KEY),null);
});
test('clear only removes the matching pending key, never unrelated storage',()=>{
 const s=storage(JSON.stringify(pending()));s.data.set('unrelated','keep');
 clearPendingRecordOperation(s,'0137',id);assert.equal(s.getItem(KEY),null);assert.equal(s.getItem('unrelated'),'keep');
 ensureNoPendingRecordOperation(s);clearPendingRecordOperation(s,'0137',id);
});
test('storage read/write/remove failures and silent failures cannot pass as success',()=>{
 assert.throws(()=>ensureNoPendingRecordOperation({getItem(){throw Error('PRIVATE');}}),e=>e.message===RECORD_RESULT_UNKNOWN_MESSAGE);
 assert.throws(()=>savePendingRecordOperation({getItem:()=>null,setItem(){throw Error('quota');}},'0137',id,now));
 assert.throws(()=>savePendingRecordOperation({getItem:()=>null,setItem(){}},'0137',id,now));
 const s=storage(JSON.stringify(pending()));s.removeItem=()=>{};assert.throws(()=>clearPendingRecordOperation(s,'0137',id));
});
for(const [status,code] of [[400,undefined],[403,undefined],[404,undefined],[409,undefined],
 [409,'OPERATION_ID_REUSED_WITH_DIFFERENT_REQUEST'],[409,'WEIGHT_CONFIRMATION_CHANGED'],[422,'WEIGHT_CHALLENGE_EXPIRED'],
 [426,'APP_UPDATE_REQUIRED'],[503,'WEIGHT_HISTORY_LIMIT_REACHED'],[503,'WEIGHT_CHALLENGE_UNAVAILABLE']])test(`explicit pre-save ${status} ${code} is known`,()=>{
 assert.equal(isKnownRecordFailure(status,{error:'固定エラー',...(code?{code}:{})}),true);
});
for(const [status,body] of [[500,{error:'unknown'}],[503,{code:'OPERATION_RESULT_UNAVAILABLE',error:'receipt'}],
 [422,{error:'unknown'}],[426,{error:'unknown'}],[409,{error:'bad',code:'UNKNOWN_CODE'}],
 [400,{ok:true,error:'conflict'}],[400,{ok:'true',error:'conflict'}],[400,{status:'succeeded',error:'conflict'}],
 [400,{recordId:'x',error:'conflict'}],[400,{replayed:true,error:'conflict'}],[400,null]])test(`uncertain response ${status} cannot clear pending`,()=>{
 assert.equal(isKnownRecordFailure(status,body),false);
});
test('success schema distinguishes replay and rejects contradictory or incomplete bodies',()=>{
 const result={ok:true,recordId:'record-1',staffId:'0137',lastWeight:190,ml:11.47,replayed:false};
 assert.equal(isValidRecordSuccess(200,result,'0137',190),true);assert.equal(isValidRecordSuccess(200,{...result,replayed:true},'0137',190),true);
 for(const changes of [{replayed:undefined},{recordId:''},{staffId:'9815'},{lastWeight:180},{ml:NaN},{ml:-1},{status:'unknown'},{code:'ERROR'},{challenge:'PRIVATE'}]) {
  assert.equal(isValidRecordSuccess(200,{...result,...changes},'0137',190),false);
 }
 assert.equal(isValidRecordSuccess(409,result,'0137',190),false);
});
test('client helpers have no server imports, credentials, network or localStorage writes',()=>{
 const source=readFileSync(new URL('../utils/recordOperationClient.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/utils\/server|node:crypto|firebase|fetch\s*\(|process\.env|localStorage|console\.|Math\.random\s*\(|\.clear\(/);
 assert.match(source,/generateRecordOperationId/);
});
