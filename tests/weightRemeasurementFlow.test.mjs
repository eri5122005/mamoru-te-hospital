import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateWeightRemeasurementFlow as flow, WEIGHT_REMEASUREMENT_RULE_VERSION as ruleVersion } from '../utils/server/weightRemeasurementFlow.js';
import { issueWeightChallenge, verifyWeightChallenge } from '../utils/server/weightRemeasurementChallenge.js';
import { precheckWeightRemeasurement } from '../utils/precheckWeightRemeasurement.js';
import { calculateWeightUsage } from '../utils/calculateWeightUsage.js';
const secret='fixture-flow-secret-at-least-32-bytes';
const start=Date.UTC(2026,9,21),appBuildId='fixture-build';
const request=(ml=100)=>({db:{},staffId:'0137',requestWeightPrev:250,weightNow:250-ml*218/250,isBottleExchange:false});
const history=()=>Array.from({length:3},(_,i)=>({date:`2026-09-${10+i}T00:00:00Z`,unit:'weight',isBottleExchange:false,weightPrev:250,weightNow:228.2,ml:25}));
function setup() {
 const state={staff:{isActive:true,lastWeight:250},clock:start,historyResult:{status:'complete',history:history()},staffError:null,historyError:null};
 const reads=[];
 const deps={secret,appBuildId,now:()=>state.clock,precheck:args=>precheckWeightRemeasurement(args,{
  readStaff:async()=>{reads.push('staff');if(state.staffError)throw new Error('PRIVATE staff');return state.staff;},
  readHistory:async()=>{reads.push('history');if(state.historyError)throw new Error('PRIVATE history');return state.historyResult;},
 })};
 return {state,reads,deps,run:r=>flow(r,deps)};
}
const decode=(token,stage='remeasure',nowMs=start)=>verifyWeightChallenge(token,{secret,nowMs,expectedStage:stage});
const signed=(stage='remeasure',changes={})=>issueWeightChallenge({stage,staffId:'0137',previousWeight:250,weightNow:162.8,currentMl:100,appBuildId,ruleVersion,
 matchedRules:['A'],personalMedianMl:25,baselineCount:3,personalRuleEvaluated:true,...changes},{secret,nowMs:start});
const staged=(operation,token,ml=100)=>({...request(ml),operation,challenge:token});

test('Stage 1 normal allows save and unknown secret is not consulted',async()=>{
 const s=setup();s.deps.secret=null;const r=await s.run(request(30));assert.equal(r.status,'save_allowed');assert.equal(r.currentMl,30);assert.equal('challenge'in r,false);
});
test('Stage 1 abnormal issues A and is never save-allowed',async()=>{
 const s=setup(),r=await s.run(request());assert.equal(r.status,'remeasurement_required');const p=decode(r.challenge);
 assert.equal(p.stage,'remeasure');assert.equal(p.ruleVersion,ruleVersion);assert.equal(p.flowExpiresAt,start+600000);assert.equal(r.currentMl,100);
});
test('Stage 1 secret unavailable stops abnormal decision',async()=>{const s=setup();s.deps.secret=null;assert.equal((await s.run(request())).status,'challenge_unavailable');});
test('Stage 2 A permits a different normal remeasurement weight',async()=>{
 const s=setup(),a=await s.run(request());s.reads.length=0;
 const r=await s.run(staged('remeasure',a.challenge,30));assert.equal(r.status,'save_allowed');assert.equal(r.currentMl,30);
 assert.notEqual(r.weightNow,decode(a.challenge).weightNow);assert.deepEqual(s.reads,['staff','history']);
});
test('Stage 2 abnormal issues B bound to new weight and caps remaining flow to two minutes',async()=>{
 const s=setup(),a=await s.run(request());s.state.clock+=8*60000;
 const r=await s.run(staged('remeasure',a.challenge,110));assert.equal(r.status,'confirmation_required');
 const b=decode(r.challenge,'confirm',s.state.clock);assert.equal(b.weightNow,request(110).weightNow);assert.equal(b.currentMl,110);
 assert.equal(b.expiresAt,start+600000);assert.equal(b.flowExpiresAt,start+600000);assert.equal(b.expiresAt-b.issuedAt,120000);
});
for(const [label,req,expected] of [
 ['tampered',staged('remeasure',signed()+'x'),'challenge_invalid'],
 ['wrong stage',staged('remeasure',signed('confirm')),'challenge_wrong_stage'],
 ['staff binding',{...staged('remeasure',signed()),staffId:'other'},'challenge_staff_mismatch'],
 ['previous binding',{...staged('remeasure',signed()),requestWeightPrev:249},'challenge_previous_weight_mismatch'],
 ['app binding',staged('remeasure',signed('remeasure',{appBuildId:'old'})),'challenge_app_version_mismatch'],
 ['rule binding',staged('remeasure',signed('remeasure',{ruleVersion:'old'})),'challenge_rule_version_mismatch'],
 ['exchange switch',{...staged('remeasure',signed()),isBottleExchange:true},'invalid_request'],
 ['missing token',staged('remeasure',undefined),'challenge_invalid'],
])test(`Stage 2 ${label} rejected before reads`,async()=>{const s=setup();assert.equal((await s.run(req)).status,expected);assert.deepEqual(s.reads,[]);});
for(const operation of ['remeasure','confirm_remeasurement'])test(`${operation} expired token rejected before reads`,async()=>{
 const s=setup();s.state.clock=start+600000;const token=signed(operation==='remeasure'?'remeasure':'confirm');
 assert.equal((await s.run(staged(operation,token))).status,'challenge_expired');assert.deepEqual(s.reads,[]);
});
for(const operation of ['remeasure','confirm_remeasurement'])for(const [label,staff,expected] of [
 ['missing',null,'staff_not_found'],['retired',{lastWeight:250,isActive:false},'staff_inactive'],
 ['changed weight',{lastWeight:249},'challenge_previous_weight_mismatch'],['invalid weight',{lastWeight:null},'invalid_db_weight'],
])test(`${operation}: latest staff ${label} stops before history`,async()=>{
 const s=setup();s.state.staff=staff;const token=signed(operation==='remeasure'?'remeasure':'confirm');
 assert.equal((await s.run(staged(operation,token))).status,expected);assert.deepEqual(s.reads,['staff']);
});
for(const [state,expected] of [
 [{historyResult:{status:'limit_reached',history:null}},'history_limit_reached'],
 [{historyError:true},'history_unavailable'],[{staffError:true},'staff_weight_unavailable'],
])test(`Stage 2 ${expected} safely stops`,async()=>{
 const s=setup();Object.assign(s.state,state);const r=await s.run(staged('remeasure',signed()));assert.equal(r.status,expected);assert.equal(JSON.stringify(r).includes('PRIVATE'),false);
});
test('invalid requests read nothing',async()=>{
 for(const changes of [{operation:'bad'},{staffId:[]},{staffId:'０１３７'},{requestWeightPrev:NaN},{weightNow:Infinity},{weightNow:45},{isBottleExchange:'false'},{challenge:signed()}]){
  const s=setup();assert.equal((await s.run({...request(),...changes})).status,'invalid_request');assert.deepEqual(s.reads,[]);
 }
});
test('Stage 3 matching B yields decision only, no actual save',async()=>{
 const s=setup(),r=await s.run(staged('confirm_remeasurement',signed('confirm')));
 assert.equal(r.status,'save_allowed_after_confirmation');assert.equal(r.currentMl,100);assert.deepEqual(s.reads,['staff','history']);assert.equal('challenge'in r,false);
});
for(const [label,changes,expected] of [
 ['weight',{weightNow:160},'challenge_weight_mismatch'],['staff',{staffId:'test-4f'},'challenge_staff_mismatch'],
 ['previous',{requestWeightPrev:249},'challenge_previous_weight_mismatch'],['exchange',{isBottleExchange:true},'invalid_request'],
])test(`Stage 3 ${label} replacement fails before reads`,async()=>{
 const s=setup();assert.equal((await s.run({...staged('confirm_remeasurement',signed('confirm')),...changes})).status,expected);assert.deepEqual(s.reads,[]);
});
for(const [label,token,status] of [
 ['app',signed('confirm',{appBuildId:'different'}),'challenge_app_version_mismatch'],
 ['rule',signed('confirm',{ruleVersion:'different'}),'challenge_rule_version_mismatch'],
 ['stage',signed('remeasure'),'challenge_wrong_stage'],
 ['tamper',signed('confirm')+'x','challenge_invalid'],
])test(`Stage 3 ${label} invalid token stops`,async()=>{const s=setup();assert.equal((await s.run(staged('confirm_remeasurement',token))).status,status);assert.deepEqual(s.reads,[]);});
test('validly signed payload calculation metadata is not final calculation authority',async()=>{
 const s=setup();const token=signed('confirm',{currentMl:1,personalMedianMl:1,matchedRules:['B']});
 const r=await s.run(staged('confirm_remeasurement',token));assert.equal(r.status,'save_allowed_after_confirmation');
 assert.equal(r.currentMl,calculateWeightUsage(250,request().weightNow,false));assert.equal(r.currentMl,100);assert.equal(r.personalMedianMl,25);assert.deepEqual(r.matchedRules,['A']);
});
test('even a malicious token with modified ml fails its old signature',async()=>{
 const token=signed('confirm'),[encoded,signature]=token.split('.');const p=JSON.parse(Buffer.from(encoded,'base64url').toString());p.currentMl=1;
 const bad=Buffer.from(JSON.stringify(p)).toString('base64url')+'.'+signature;const s=setup();
 assert.equal((await s.run(staged('confirm_remeasurement',bad))).status,'challenge_invalid');assert.deepEqual(s.reads,[]);
});
test('challenge expiry is rechecked after async reads, including normal Stage 2 result',async()=>{
 for(const operation of ['remeasure','confirm_remeasurement']){
  const s=setup();const token=signed(operation==='remeasure'?'remeasure':'confirm');
  const original=s.deps.precheck;s.deps.precheck=async args=>{const r=await original(args);s.state.clock=start+600000;return r;};
  const req=staged(operation,token,operation==='remeasure'?30:100);
  assert.equal((await s.run(req)).status,'challenge_expired');
 }
});
test('challenge-less exchange remains exempt, but no stage token is issued',async()=>{
 const s=setup();const r=await s.run({...request(100),isBottleExchange:true});assert.equal(r.status,'save_allowed');assert.equal('challenge'in r,false);assert.deepEqual(s.reads,['staff']);
});
test('B skip and real insufficient behavior remain unchanged',async()=>{
 const s=setup(),r=await s.run(request(150));assert.equal(r.status,'remeasurement_required');assert.deepEqual(r.matchedRules,['B']);assert.equal(r.personalRuleEvaluated,false);assert.deepEqual(s.reads,['staff']);
 const t=setup();t.state.historyResult={status:'insufficient',history:[]};assert.equal((await t.run(request(100))).status,'save_allowed');
});
test('stateless replay remains possible before DB weight changes',async()=>{
 const s=setup(),req=staged('confirm_remeasurement',signed('confirm'));assert.equal((await s.run(req)).status,'save_allowed_after_confirmation');assert.equal((await s.run(req)).status,'save_allowed_after_confirmation');
 s.state.staff.lastWeight=240;assert.equal((await s.run(req)).status,'challenge_previous_weight_mismatch');
});
test('no identifiers beyond staffId or personal data is consumed or returned',async()=>{
 const s=setup(),req=request();Object.defineProperty(req,'name',{get(){throw new Error('personal access');}});
 const r=await s.run(req);assert.equal(JSON.stringify(r).includes('"name"'),false);assert.equal(JSON.stringify(decode(r.challenge)).includes('"name"'),false);
});
test('secret missing rejects challenge stages before reads, normal initial still works',async()=>{
 const s=setup();s.deps.secret=null;assert.equal((await s.run(staged('remeasure',signed()))).status,'challenge_unavailable');assert.deepEqual(s.reads,[]);
});
test('static isolation: no writes, direct SDK, network, storage, logging or browser import',()=>{
 const source=readFileSync(new URL('../utils/server/weightRemeasurementFlow.js',import.meta.url),'utf8');
 for(const word of ['firebase','addDoc','setDoc','updateDoc','deleteDoc','runTransaction','writeBatch','sessionStorage','localStorage','console.','fetch('])assert.equal(source.includes(word),false,word);
 for(const path of ['pages/record/index.js'])assert.equal(readFileSync(new URL(`../${path}`,import.meta.url),'utf8').includes('weightRemeasurementFlow'),false);
});

for(const [state,expected] of [
 [{historyResult:{status:'limit_reached',history:null}},'history_limit_reached'],
 [{historyError:true},'history_unavailable'],[{staffError:true},'staff_weight_unavailable'],
])test(`Stage 3 confirmation cannot bypass ${expected}`,async()=>{
 const s=setup();Object.assign(s.state,state);const r=await s.run(staged('confirm_remeasurement',signed('confirm')));
 assert.equal(r.status,expected);assert.equal(JSON.stringify(r).includes('PRIVATE'),false);
});
test('unknown dependency failures reject rather than granting save permission',async()=>{
 const s=setup();s.deps.precheck=async()=>{throw new TypeError('contract error');};await assert.rejects(s.run(request()),TypeError);
});
