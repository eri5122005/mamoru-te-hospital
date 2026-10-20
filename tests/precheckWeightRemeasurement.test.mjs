import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { precheckWeightRemeasurement, WeightPrecheckReadError } from '../utils/precheckWeightRemeasurement.js';
import { calculateWeightUsage } from '../utils/calculateWeightUsage.js';
const evaluatedAt='2026-10-21T00:00:00Z';
const history=(ml=25,n=3)=>Array.from({length:n},(_,i)=>({date:`2026-10-${10+i}T00:00:00Z`,unit:'weight',isBottleExchange:false,weightPrev:250,weightNow:250-ml*218/250,ml}));
function setup(ml=50,staff={isActive:true,lastWeight:250},result={status:'complete',history:history()}) {
 const calls=[];
 const args={db:{},staffId:'0137',requestWeightPrev:250,weightNow:250-ml*218/250,isBottleExchange:false,evaluatedAt};
 const deps={readStaff:async a=>{calls.push(['staff',a]);return staff;},readHistory:async a=>{calls.push(['history',a]);return result;}};
 return {args,deps,calls,run:()=>precheckWeightRemeasurement(args,deps)};
}
for(const [label,staff,status] of [
 ['missing',null,'staff_not_found'],['retired',{isActive:false,lastWeight:250},'staff_inactive'],
 ['invalid DB',{lastWeight:NaN},'invalid_db_weight'],['missing DB',{},'invalid_db_weight'],
 ['DB null',{lastWeight:null},'invalid_db_weight'],['DB array',{lastWeight:[250]},'invalid_db_weight'],
 ['mismatch',{lastWeight:249},'previous_weight_mismatch'],
])test(`${label}: no history read`,async()=>{const s=setup(50,staff);assert.equal((await s.run()).status,status);assert.equal(s.calls.length,1);});
for(const active of [true,undefined,null])test(`legacy active ${String(active)} allowed`,async()=>{const s=setup(30,{isActive:active,lastWeight:'250'});assert.equal((await s.run()).status,'ok');assert.equal(s.calls.length,2);});
for(const [ml,median,matched] of [[49.99,20,[]],[50,25,['A']],[50,25.01,[]],[60,30,['A']],[149.99,100,[]],[150,25,['B']],[160,25,['B']]]) {
 test(`rounded ${ml}mL, median ${median}`,async()=>{
  const s=setup(ml,undefined,{status:'complete',history:history(median)});const r=await s.run();
  assert.equal(r.currentMl,ml);assert.deepEqual(r.matchedRules,matched);
  assert.equal(r.status,matched.length?'remeasurement_required':'ok');
  assert.equal(s.calls.length,ml>=150?1:2);
  if(ml>=150){assert.equal(r.personalRuleEvaluated,false);assert.equal(r.personalMedianMl,null);assert.equal(r.historyStatus,'not_read');}
 });
}
for(const n of [0,1,2])test(`real insufficient ${n} preserved`,async()=>{
 const s=setup(100,undefined,{status:'insufficient',history:history(10,n)});const r=await s.run();
 assert.equal(r.status,'ok');assert.equal(r.baselineCount,n);assert.equal(r.personalRuleEvaluated,false);assert.equal(r.personalMedianMl,null);assert.equal(r.historyStatus,'insufficient');
});
test('B is decided even if history would fail; no read performed',async()=>{
 const s=setup(150);s.deps.readHistory=async()=>{throw new Error('must not read');};assert.deepEqual((await s.run()).matchedRules,['B']);
});
test('exchange uses existing formula and skips A/B and history',async()=>{
 const s=setup();s.args.weightNow=190;s.args.isBottleExchange=true;
 const r=await s.run();assert.equal(r.currentMl,calculateWeightUsage(250,190,true));assert.equal(r.status,'ok');assert.deepEqual(r.matchedRules,[]);assert.equal(r.personalRuleEvaluated,false);assert.equal(s.calls.length,1);
});
test('verified DB weight, not untrusted weight or ml, is the calculation basis',async()=>{
 const s=setup();s.args.requestWeightPrev='250';s.args.ml=999;const r=await s.run();assert.equal(r.previousWeight,250);assert.equal(r.currentMl,50);
 s.args.requestWeightPrev=263;assert.equal((await s.run()).status,'previous_weight_mismatch');
});
test('limit is safe stop, not ok or insufficient',async()=>{
 const s=setup(50,undefined,{status:'limit_reached',history:null});assert.equal((await s.run()).status,'history_limit_reached');
});
for(const phase of ['staff','history'])test(`${phase} errors retain phase/cause, never insufficient`,async()=>{
 const s=setup();const cause=new Error('private SDK details');s.deps[phase==='staff'?'readStaff':'readHistory']=async()=>{throw cause;};
 await assert.rejects(s.run(),e=>e instanceof WeightPrecheckReadError && e.phase===phase && e.cause===cause && !e.message.includes('private'));
 if(phase==='staff')assert.equal(s.calls.length,0);
});
for(const changes of [{staffId:''},{staffId:[]},{staffId:'０１３７'},{staffId:'a/b'},{weightNow:NaN},{weightNow:Infinity},{weightNow:null},{weightNow:45},{requestWeightPrev:[]},{requestWeightPrev:undefined},{isBottleExchange:'false'}])test(`invalid input ${JSON.stringify(changes)} has zero reads`,async()=>{
 const s=setup();Object.assign(s.args,changes);assert.equal((await s.run()).status,'invalid_request');assert.equal(s.calls.length,0);
});
test('invalid and internally inconsistent read results fail closed',async()=>{
 for(const result of [undefined,{status:'unknown'}, {status:'complete',history:[]},{status:'complete',history:history(0)}, {status:'insufficient',history:history()}]){
  const s=setup(50,undefined,result); // explicit undefined below avoids setup's default parameter
  s.deps.readHistory=async()=>result;await assert.rejects(s.run(),TypeError);
 }
});
test('zero and small increase preserve zero ml; computation threshold is rounded ml',async()=>{
 for(const weightNow of [250,252]){const s=setup();s.args.weightNow=weightNow;const r=await s.run();assert.equal(r.currentMl,0);assert.equal(r.status,'ok');}
 const s=setup(49.999);assert.equal((await s.run()).currentMl,50);assert.deepEqual((await s.run()).matchedRules,['A']);
});
test('default staff adapter mocked without importing Firebase: server-only, explicit fields, missing',async()=>{
 const source=readFileSync(new URL('../utils/precheckWeightRemeasurement.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('async function readServerStaff('),source.indexOf('\nfunction numericWeight(')).replace("await import('firebase/firestore')",'sdk');
 let exists=true,calls=0;
 const sdk={doc:(db,col,id)=>{assert.equal(col,'staff');assert.equal(id,'0137');return {};},getDocFromServer:async()=>{calls++;return {exists:()=>exists,get:k=>{assert.ok(['isActive','lastWeight'].includes(k));return k==='isActive'?true:250;}};}};
 const fn=vm.runInNewContext(body+';readServerStaff',{sdk});assert.equal((await fn({db:{},staffId:'0137'})).lastWeight,250);exists=false;assert.equal(await fn({db:{},staffId:'0137'}),null);assert.equal(calls,2);
});
test('static safety and reuse: no writes, initialization or API/UI integration',()=>{
 const source=readFileSync(new URL('../utils/precheckWeightRemeasurement.js',import.meta.url),'utf8');
 for(const word of ['addDoc','setDoc','updateDoc','deleteDoc','writeBatch','runTransaction','initializeApp','firebaseConfig'])assert.equal(source.includes(word),false);
 assert.match(source,/calculateWeightUsage\(dbWeight, current, isBottleExchange\)/);
 assert.match(source,/readHistory = fetchRecentNormalWeightHistory/);assert.match(source,/evaluateWeightRemeasurement\(/);assert.match(source,/isActiveStaff\(staff\)/);
 for(const file of ['pages/api/records.js','pages/record/index.js'])assert.equal(readFileSync(new URL(`../${file}`,import.meta.url),'utf8').includes('precheckWeightRemeasurement'),false);
});
