import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { lookupRecordOperationResult } from '../utils/server/lookupRecordOperationResult.js';
import { prepareRecordOperation, createRecordOperationReceipt, isValidRecordOperationReceipt } from '../utils/server/recordOperationReceipt.js';

const operationId='01234567-89ab-4cde-8fab-0123456789ab';
const otherId='01234567-89ab-4cde-9fab-0123456789ab';
const query={operationId,staffId:'0137'};
const body={staffId:'0137',weightPrev:200,weightNow:190,isBottleExchange:false,name:'PRIVATE-NAME'};
const receipt=()=>createRecordOperationReceipt(prepareRecordOperation(operationId,body),{
 recordId:'record-fixture',ml:11.47,committedAt:new Date('2026-10-21T00:00:00Z'),
});
const source=readFileSync(new URL('../pages/api/records/operation-result.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const stripped=source.replace(/^import .*;\n/gm,'').replace('export default ','');
assert.doesNotMatch(stripped,/^\s*import\b/m);
async function call({method='GET',input=query,headers={},staff={},saved=receipt(),staffError=false,receiptError=false}={}) {
 const reads=[],docs=new Map([['staff/0137',staff],['recordOperations/'+operationId,saved]]);
 const before=JSON.stringify([...docs]);
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(status){this.statusCode=status;return this;},json(value){this.body=JSON.parse(JSON.stringify(value));return this;}};
 await vm.runInNewContext(stripped+'\nhandler(req,res)',{
  req:{method,query:input,headers},res,db:{},
  lookupRecordOperationResult:args=>lookupRecordOperationResult(args,{
   readStaffStatus:async({staffId})=>{reads.push('staff/'+staffId);if(staffError)throw Error('PRIVATE read');return staff;},
   readOperationReceipt:async({operationId:id})=>{reads.push('recordOperations/'+id);if(receiptError)throw Error('PRIVATE read');return id===operationId?saved:null;},
  }),
 });
 assert.equal(JSON.stringify([...docs]),before,'read-only API cannot mutate fixture data');
 assert.equal(res.headers['Cache-Control'],'no-store');
 return {res,reads};
}

test('GET returns only the minimal historical success fields',async()=>{
 const {res,reads}=await call();assert.equal(res.statusCode,200);
 assert.deepEqual(res.body,{ok:true,status:'succeeded',operationId,recordId:'record-fixture',staffId:'0137',lastWeight:190,ml:11.47});
 assert.deepEqual(reads,['staff/0137','recordOperations/'+operationId]);
 for(const word of ['requestDigest','committedAt','challenge','secret','PRIVATE','recordOperations/','schemaVersion'])assert.equal(JSON.stringify(res.body).includes(word),false);
});
for(const [label,saved] of [['missing',null],['other staff',{...receipt(),staffId:'9815',result:{...receipt().result,staffId:'9815'}}],
 ['damaged other staff',{staffId:'9815',recordId:'PRIVATE',result:{ml:999}}]])test(`${label}: indistinguishable unknown with no result details`,async()=>{
 const {res}=await call({saved});const missing=await call({saved:null});
 assert.equal(res.statusCode,200);assert.deepEqual(res.body,missing.res.body);assert.equal(res.body.status,'unknown');assert.equal(res.body.ok,false);
 for(const key of ['recordId','lastWeight','ml','staffId','requestDigest'])assert.equal(key in res.body,false);
 assert.match(res.body.message,/再登録せず、管理者に確認/);
 assert.doesNotMatch(res.body.message,/保存されていません|未保存|失敗しました|再登録できます/);
});
for(const value of [undefined,null,'',[],[operationId],{},123,operationId.toUpperCase(),operationId.replace('-4cde-','-1cde-'),operationId.slice(0,19)+'7'+operationId.slice(20),'bad']) {
 test(`invalid operation query ID ${String(value)}`,async()=>{
  const {res,reads}=await call({input:{...query,operationId:value}});assert.equal(res.statusCode,400);assert.deepEqual(reads,[]);
 });
}
for(const value of [undefined,null,'',' ',[],['0137'],{},137,'a/b','.','..','a\u0000b','x'.repeat(1501)]) {
 test(`invalid staff query ${String(value).slice(0,25)}`,async()=>{
  const {res,reads}=await call({input:{...query,staffId:value}});assert.equal(res.statusCode,400);assert.deepEqual(reads,[]);
 });
}
test('canonicalizes full-width staff digits, trims and preserves leading zero',async()=>{
 const {res,reads}=await call({input:{...query,staffId:' ０１３７ '}});assert.equal(res.statusCode,200);
 assert.equal(res.body.staffId,'0137');assert.equal(reads[0],'staff/0137');
 const wrong=await call({input:{...query,staffId:'137'}});assert.equal(wrong.res.body.status,'unknown');
});
for(const changes of [{schemaVersion:2},{resultVersion:2},{result:undefined},{result:null},{requestDigest:'bad'},
 {requestDigest:'a'.repeat(64)+'\n'},{recordId:''},{recordId:'a/b'},{committedAt:null},{staffId:123},
 {result:{...receipt().result,recordId:'different'}},{result:{...receipt().result,staffId:'9815'}},
 ...[NaN,Infinity,-Infinity,45,264,'190',null].map(lastWeight=>({result:{...receipt().result,lastWeight}})),
 ...[NaN,Infinity,-Infinity,-1,'11.47',null].map(ml=>({result:{...receipt().result,ml}})),
 {result:{...receipt().result,ok:false}},{extra:'PRIVATE'},
])test(`damaged receipt rejects ${Object.keys(changes)[0]} ${String(changes.result?.lastWeight??'')}`,async()=>{
 const saved={...receipt(),...changes};assert.equal(isValidRecordOperationReceipt(saved),false);
 const {res}=await call({saved});assert.equal(res.statusCode,503);assert.equal(res.body.code,'OPERATION_RESULT_UNAVAILABLE');
 assert.equal('status'in res.body,false);assert.equal(JSON.stringify(res.body).includes('PRIVATE'),false);
});
for(const saved of [{},[],123,'bad'])test(`invalid receipt container ${String(saved)}`,async()=>{
 const {res}=await call({saved});assert.equal(res.statusCode,503);
});
for(const phase of ['staff','receipt'])test(`read failure at ${phase} is 500, never unknown or a data-bearing error`,async()=>{
 const {res,reads}=await call({staffError:phase==='staff',receiptError:phase==='receipt'});
 assert.equal(res.statusCode,500);assert.equal(res.body.code,'OPERATION_RESULT_READ_FAILED');assert.equal('status'in res.body,false);
 assert.equal(JSON.stringify(res.body).includes('PRIVATE'),false);assert.equal(reads.length,phase==='staff'?1:2);
});
for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS','HEAD','UNKNOWN'])test(`${method} rejected without reads`,async()=>{
 const {res,reads}=await call({method});assert.equal(res.statusCode,405);assert.equal(res.headers.Allow,'GET');assert.deepEqual(reads,[]);
});
test('old or missing build header still allows historical lookup: this endpoint cannot save',async()=>{
 for(const headers of [{},{'x-app-build-id':'old-build'},{'x-app-build-id':['malformed']}]) {
  const {res}=await call({headers});assert.equal(res.statusCode,200);assert.equal(res.body.status,'succeeded');
 }
 assert.doesNotMatch(source,/getAppBuildId|checkAppVersion|res\.status\(426\)/);
});
for(const [label,staff] of [['retired',{isActive:false}],['missing',null]])test(`${label} staff returns unknown without reading any operation`,async()=>{
 const {res,reads}=await call({staff});const absent=await call({saved:null});assert.deepEqual(res.body,absent.res.body);
 assert.equal(res.statusCode,200);assert.deepEqual(reads,['staff/0137']);
});
for(const active of [true,undefined,null])test(`active compatibility ${active}`,async()=>{
 const staff={isActive:active};Object.defineProperty(staff,'lastWeight',{get(){throw Error('must not use current weight');}});
 const {res}=await call({staff});assert.equal(res.statusCode,200);assert.equal(res.body.lastWeight,190);
});
test('current DB weight does not replace the original committed result',async()=>{
 const {res}=await call({staff:{lastWeight:100,isActive:true}});assert.equal(res.body.lastWeight,190);assert.equal(res.body.ml,11.47);
});
test('unknown may become succeeded later without ever permitting a new save',async()=>{
 const absent=await call({saved:null});assert.equal(absent.res.body.status,'unknown');
 const later=await call();assert.equal(later.res.body.status,'succeeded');
 assert.equal('retryAllowed'in absent.res.body,false);
});
test('server-only dependencies use server reads only and contain no write, challenge, cache or upload path',()=>{
 const helper=readFileSync(new URL('../utils/server/lookupRecordOperationResult.js',import.meta.url),'utf8');
 for(const text of [source,helper])assert.doesNotMatch(text,/addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction|issueWeightChallenge|fetch\s*\(|console\.|process\.env|localStorage|sessionStorage/);
 assert.doesNotMatch(helper,/\bgetDoc\s*\(|\bgetDocs\s*\(|'records'|'staffs'/);
 assert.equal((helper.match(/await getDocFromServer\(/g)||[]).length,2);
 assert.match(helper,/snapshot\.get\('isActive'\)/);assert.doesNotMatch(helper,/staff\.lastWeight|snapshot\.get\('lastWeight'\)/);
 assert.match(helper,/isRecordOperationId\(operationId\)/);assert.match(helper,/isValidRecordOperationReceipt\(receipt\)/);
 assert.doesNotMatch(readFileSync(new URL('../pages/record/index.js',import.meta.url),'utf8'),/lookupRecordOperationResult|operation-result/);
});
