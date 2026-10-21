import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPendingRecordRecovery,RECOVERY_MESSAGES} from '../utils/recoverPendingRecordOperation.js';
import {PENDING_RECORD_OPERATION_KEY as KEY,createRecordOperationLifecycle} from '../utils/recordOperationClient.js';
const id='01234567-89ab-4cde-8fab-0123456789ab';
const pending={staffId:'0137',operationId:id,savedAt:1};
const success={ok:true,status:'succeeded',operationId:id,staffId:'0137',recordId:'record-1',lastWeight:190,ml:11.47};
function fixture(raw=JSON.stringify(pending)) {
 const data=new Map([['draft','unchanged']]);if(raw!==null)data.set(KEY,raw);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 let calls=0;const requests=[];
 const args={storage,staffId:'0137',fetchImpl:async(url,options)=>{calls++;requests.push({url,options});return{ok:true,status:200,json:async()=>success};}};
 return {data,storage,args,requests,calls:()=>calls};
}
test('no pending requires neither network nor ID generation',async()=>{const f=fixture(null);assert.deepEqual(await createPendingRecordRecovery()(f.args),{status:'none'});assert.equal(f.calls(),0);});
test('valid old pending GET is no-store, resolves only after verified removal, touches no draft',async()=>{
 const f=fixture();const r=await createPendingRecordRecovery()(f.args);assert.equal(r.status,'succeeded');assert.equal(f.data.has(KEY),false);assert.equal(f.data.get('draft'),'unchanged');
 const {url,options}=f.requests[0];assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');const q=new URL(url,'https://local').searchParams;assert.equal(q.get('operationId'),id);assert.equal(q.get('staffId'),'0137');assert.match(r.message,/保存済み/);assert.equal('lastWeight' in r,false);
});
test('other staff never queries or clears',async()=>{const f=fixture();f.args.staffId='9999';assert.equal((await createPendingRecordRecovery()(f.args)).status,'mismatch');assert.equal(f.calls(),0);assert.equal(f.data.has(KEY),true);});
for(const raw of ['broken','null','[]',JSON.stringify({...pending,operationId:'bad'}),JSON.stringify({...pending,staffId:'０１３７'}),JSON.stringify({...pending,savedAt:0}),JSON.stringify({...pending,savedAt:Date.now()+100000}),JSON.stringify({...pending,challenge:'forbidden'}),JSON.stringify({staffId:'0137'})])test(`malformed evidence retained: ${raw.slice(0,30)}`,async()=>{
 const f=fixture(raw);assert.equal((await createPendingRecordRecovery()(f.args)).status,'malformed');assert.equal(f.calls(),0);assert.equal(f.data.get(KEY),raw);
});
for(const [label,fetchImpl,expected] of [
 ['unknown',async()=>({ok:true,status:200,json:async()=>({ok:false,status:'unknown',message:'unknown'})}),'unknown'],
 ['network',async()=>{throw Error('offline');},'failed'],
 ...[400,403,404,426,500,503,201].map(status=>[String(status),async()=>({ok:status===201,status,json:async()=>success}),'failed']),
 ['JSON',async()=>({ok:true,status:200,json:async()=>{throw Error('json');}}),'failed'],
 ...[{...success,operationId:'bad'},{...success,staffId:'other'},{...success,status:'other'},{...success,ml:NaN},{...success,lastWeight:Infinity},{...success,challenge:'x'},null].map((body,i)=>['schema'+i,async()=>({ok:true,status:200,json:async()=>body}),'failed']),
])test(`${label} preserves evidence and denies new recording`,async()=>{
 const f=fixture();f.args.fetchImpl=fetchImpl;const raw=f.data.get(KEY);const r=await createPendingRecordRecovery()(f.args);assert.equal(r.status,expected);assert.match(r.message,/再登録せず、管理者/);assert.equal(f.data.get(KEY),raw);assert.equal(f.data.get('draft'),'unchanged');
});
test('timeout stops even when fetch ignores abort',async()=>{const f=fixture();f.args.fetchImpl=()=>new Promise(()=>{});f.args.timeoutMs=5;assert.equal((await createPendingRecordRecovery()(f.args)).status,'failed');assert.equal(f.data.has(KEY),true);});
for(const mode of ['throws','silent'])test(`clear ${mode} failure remains blocked`,async()=>{const f=fixture();f.storage.removeItem=()=>{if(mode==='throws')throw Error('storage');};assert.equal((await createPendingRecordRecovery()(f.args)).status,'failed');assert.equal(f.data.has(KEY),true);});
test('storage read failure never contacts API',async()=>{const f=fixture();f.storage.getItem=()=>{throw Error('storage');};assert.equal((await createPendingRecordRecovery()(f.args)).status,'malformed');assert.equal(f.calls(),0);});
test('changed pending is never cleared by a stale result',async()=>{const f=fixture();f.args.fetchImpl=async()=>{f.data.set(KEY,JSON.stringify({...pending,operationId:'01234567-89ab-4cde-9fab-0123456789ab'}));return{ok:true,status:200,json:async()=>success};};assert.equal((await createPendingRecordRecovery()(f.args)).status,'failed');assert.equal(f.data.has(KEY),true);});
test('effect cancellation and re-entry share GET, only current consumer clears',async()=>{
 const f=fixture();let release;const gate=new Promise(r=>release=r);f.args.fetchImpl=async()=>{f.requests.push('GET');await gate;return{ok:true,status:200,json:async()=>success};};
 const recover=createPendingRecordRecovery();let current=true;const a=recover({...f.args,isCurrent:()=>current});current=false;const b=recover(f.args);assert.equal(f.requests.length,1);release();assert.equal((await a).status,'cancelled');assert.equal((await b).status,'succeeded');assert.equal(f.data.has(KEY),false);
});
const page=readFileSync(new URL('../pages/record/index.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const startup=page.slice(page.indexOf(' useEffect(() => {\n  let cancelled'),page.indexOf('  useEffect(() => registerUpdatePreparation'));
for(const status of ['succeeded','unknown','failed','malformed','mismatch','cancelled'])test(`real startup ${status} never starts recording, writes weights/history, consumes draft or restores challenge`,async()=>{
 let finish,cleanup;const done=new Promise(r=>finish=r);const messages=[];const life=createRecordOperationLifecycle(()=>assert.fail('no new ID'));const ready={current:false};
 vm.runInNewContext(startup,{useEffect:cb=>cleanup=cb(),AbortController,setTimeout,clearTimeout,
 beginUpdateOperation:()=>finish,fetch:()=>assert.fail('no POST'),currentRecordStaffId:()=> '0137',localStorage:{},sessionStorage:{},
 pendingRecoveryRef:{current:async()=>({status,message:RECOVERY_MESSAGES[status]})},operationLifecycleRef:{current:life},saveUncertainRef:{current:false},
 setMessage:m=>messages.push(m),readyRef:ready,loadRecordContext:()=>assert.fail('no DB/draft/POST'),
 });await done;assert.equal(ready.current,false);assert.equal(life.isBlocked(),true);assert.equal(life.current(),null);assert.equal(messages.length,1);cleanup();
});
test('recovery has no POST, storage writes, tokens, replay success effects or server dependency',()=>{const source=readFileSync(new URL('../utils/recoverPendingRecordOperation.js',import.meta.url),'utf8');assert.doesNotMatch(source,/method:\s*['"]POST|setItem|localStorage|firebase|generateRecordOperationId|process\.env|console\./);assert.match(page,/const pendingRecoveryRef = useRef\(createPendingRecordRecovery\(\)\)/);assert.match(startup,/recovery.status !== "none"/);});
test('while lookup is unresolved, evidence remains and no completion is returned',async()=>{
 const f=fixture();let release;const gate=new Promise(r=>release=r);let resolved=false;
 f.args.fetchImpl=async()=>{await gate;return{ok:true,status:200,json:async()=>success};};
 const result=createPendingRecordRecovery()(f.args).then(r=>{resolved=true;return r;});
 await Promise.resolve();assert.equal(resolved,false);assert.equal(f.data.has(KEY),true);
 release();assert.equal((await result).status,'succeeded');
});
test('staff switch while GET is in flight does not clear evidence',async()=>{
 const f=fixture();let active='0137';f.args.isCurrent=()=>active==='0137';
 f.args.fetchImpl=async()=>{active='9999';return{ok:true,status:200,json:async()=>success};};
 assert.equal((await createPendingRecordRecovery()(f.args)).status,'cancelled');assert.equal(f.data.has(KEY),true);
});
test('successful recovery requires a fresh checker/reload for normal initialization, with no old ID reuse',async()=>{
 const f=fixture();assert.equal((await createPendingRecordRecovery()(f.args)).status,'succeeded');
 assert.deepEqual(await createPendingRecordRecovery()(f.args),{status:'none'});assert.equal(f.calls(),1);
});
