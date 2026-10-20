import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWeightRemeasurement, eligibleNormalUsage, WEIGHT_REMEASUREMENT_RULES } from '../utils/weightRemeasurement.js';
import { calculateWeightUsage } from '../utils/calculateWeightUsage.js';
import { analyseTimeline } from '../scripts/lib/analyse-weight-timeline.mjs';
const evaluatedAt = '2026-10-20T00:00:00Z';
const record = (ml=25, i=0, changes={}) => ({unit:'weight',isBottleExchange:false,weightPrev:250,
  weightNow:250-ml*218/250,ml,date:new Date(Date.UTC(2026,9,10+i)).toISOString(),...changes});
const history = (ml=25,n=3) => Array.from({length:n},(_,i)=>record(ml,i));
const evaluate = (ml, records=history(), exchange=false) => evaluateWeightRemeasurement({currentMl:ml,history:records,isBottleExchange:exchange,evaluatedAt});
for(const [label,ml,base,expected] of [
 ['below A',49.99,20,[]],['inclusive A',50,25,['A']],['just below ratio',50,25.01,[]],
 ['exact double',60,30,['A']],['below B',149.99,100,[]],['inclusive B',150,100,['B']],
 ['A only',100,25,['A']],['B only',160,100,['B']],['both',150,25,['A','B']],['zero',0,25,[]],
])test(label,()=>{const r=evaluate(ml,history(base));assert.deepEqual(r.matchedRules,expected);assert.equal(r.requiresRemeasurement,!!expected.length);});
for(const n of [0,1,2])test(`insufficient history ${n}: no A, B still applies`,()=>{
 const r=evaluate(100,history(10,n));assert.equal(r.personalMedianMl,null);assert.equal(r.personalRuleEvaluated,false);assert.equal(r.baselineCount,n);assert.equal(r.baselineAvailable,false);assert.deepEqual(r.matchedRules,[]);
 assert.deepEqual(evaluate(150,history(10,n)).matchedRules,['B']);
});
test('median is latest eligible THREE, unordered inputs, not mean; future and current timestamp excluded',()=>{
 const records=[record(200,0),record(10,1),record(30,2),record(20,3),record(1,15),record(1,16,{date:evaluatedAt})];
 const r=evaluate(50,records.toReversed());assert.equal(r.personalMedianMl,20);assert.equal(r.baselineCount,3);
});
for(const [label,changes] of [
 ['zero',{weightNow:250,ml:0}],['exchange',{isBottleExchange:true}],['missing flag',{isBottleExchange:undefined}],
 ['ml mismatch',{ml:999}],['array weight',{weightNow:[200]}],['null weight',{weightNow:null}],
 ['blank weight',{weightNow:' '}],['NaN weight',{weightNow:NaN}],['Infinity weight',{weightNow:Infinity}],
 ['missing weight',{weightNow:undefined}],['low weight',{weightNow:45}],['high weight',{weightPrev:264}],
 ['invalid date',{date:'bad'}],['local date',{date:'2026-10-12T00:00:00'}],['legacy unit',{unit:undefined}],
 ['bad ml',{ml:NaN}],['infinite ml',{ml:Infinity}],['missing ml',{ml:undefined}],
])test(`exclude ${label}`,()=>{
 const invalid=record(25,4,changes);assert.equal(eligibleNormalUsage(invalid),null);
 const r=evaluate(50,[...history(25,2),invalid]);assert.equal(r.baselineCount,2);assert.equal(r.personalMedianMl,null);assert.deepEqual(r.matchedRules,[]);
});
test('exchange current never applies A/B, even with high calculated usage',()=>{
 const r=evaluate(250,history(20),true);assert.equal(r.requiresRemeasurement,false);assert.deepEqual(r.matchedRules,[]);assert.equal(r.personalRuleEvaluated,false);
});
for(const value of [NaN,Infinity,-Infinity,undefined,null,'150',[],{},-1])test(`invalid current usage ${String(value)} throws, never safe decision`,()=>assert.throws(()=>evaluate(value),TypeError));
test('missing/failed history or exchange flag is NOT insufficient history',()=>{
 for(const value of [null,{},new Error('fetch failed')])assert.throws(()=>evaluate(100,value),TypeError);
 // Default arguments above deliberately supply history for undefined: exercise omission explicitly.
 assert.throws(()=>evaluateWeightRemeasurement({currentMl:100,isBottleExchange:false,evaluatedAt}),TypeError);
 for(const flag of [undefined,null,'false',0])assert.throws(()=>evaluateWeightRemeasurement({currentMl:100,history:[],isBottleExchange:flag,evaluatedAt}),TypeError);
 assert.throws(()=>evaluateWeightRemeasurement({currentMl:100,history:[],isBottleExchange:false}),TypeError);
});
test('timestamp, Date and audit timestamp wrapper accepted; no timezone dependent text',()=>{
 assert.equal(eligibleNormalUsage(record(25,0,{date:new Date('2026-10-10T00:00:00Z')})),25);
 assert.equal(eligibleNormalUsage(record(25,0,{date:{toDate:()=>new Date('2026-10-10T00:00:00Z')}})),25);
 assert.equal(eligibleNormalUsage(record(25,0,{date:{timestamp:'2026-10-10T00:00:00Z'}})),25);
 assert.equal(eligibleNormalUsage(record(25,0,{date:{toDate:()=>{throw new Error();}}})),null);
});
test('numeric strings preserve audit compatibility, malformed types never coerce; tolerance inclusive',()=>{
 const r=record();r.weightPrev=String(r.weightPrev);r.weightNow=String(r.weightNow);r.ml='25';assert.equal(eligibleNormalUsage(r),25);
 assert.equal(eligibleNormalUsage(record(25,0,{ml:25.01})),25);assert.equal(eligibleNormalUsage(record(25,0,{ml:25.02})),null);
 assert.equal(eligibleNormalUsage(record(25,0,{weightPrev:true})),null);
});
test('timestamp ties excluded and audit eligibility parity across fixture categories',()=>{
 const tied=[...history(25),record(10,4),record(20,4)];assert.equal(evaluate(50,tied).personalMedianMl,25);
 const candidates=[record(),record(0,0,{weightNow:250}),record(25,0,{isBottleExchange:true}),record(25,0,{unit:undefined}),record(25,0,{ml:NaN}),record(25,0,{ml:25.01}),record(25,0,{weightNow:[]})];
 for(const r of candidates){const audit=analyseTimeline([{...r,id:'x',staffId:'fixture',wardId:'4f'}]);assert.equal(eligibleNormalUsage(r)!==null,audit.summary.counts.eligible===1);}
});
test('no identifiers needed; no names accessed; inputs immutable; thresholds frozen',()=>{
 const records=history();const before=JSON.stringify(records);
 for(const r of records)Object.defineProperty(r,'name',{get(){throw new Error('name accessed');}});
 evaluate(50,records);assert.equal(JSON.stringify(records),before);assert.equal(Object.isFrozen(WEIGHT_REMEASUREMENT_RULES),true);
 assert.equal(calculateWeightUsage(252,205),53.9);assert.equal(calculateWeightUsage(205,205),0);
});
