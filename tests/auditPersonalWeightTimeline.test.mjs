import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { analyseTimeline, candidateRules } from '../scripts/lib/analyse-weight-timeline.mjs';
import { calculateWeightUsage } from '../utils/calculateWeightUsage.js';
const source=readFileSync(new URL('../scripts/audit-personal-weight-timeline.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const rules=[{id:'r',ratio:2},{id:'d',difference:75},{id:'a',absolute:150},{id:'rd',ratio:2,difference:75},{id:'ra',ratio:2,absolute:150},{id:'interval',ratio:2,maxHours:36}];
function record(i,ml=20,extra={}) {const prev=250,now=prev-ml*218/250;return {id:String(i),staffId:'0137',wardId:'78f',date:new Date(Date.UTC(2026,9,1+i)).toISOString(),unit:'weight',weightPrev:prev,weightNow:now,isBottleExchange:false,ml:calculateWeightUsage(prev,now),...extra};}
const rows=r=>r.review.evaluations;
test('strict past-only chronology, 3/5/7 exact medians and insufficient counts',()=>{
 const data=Array.from({length:8},(_,i)=>record(i,(i+1)*10));
 const result=analyseTimeline(data.toReversed(),rules);
 const final=rows(result).filter(r=>r.documentId==='7');
 assert.deepEqual(final.map(r=>[r.N,r.pastMedianMl]),[[3,60],[5,50],[7,40]]);
 assert.equal(result.summary.baselineCounts[7].insufficient,7);
 assert.equal(result.summary.baselineCounts[3].evaluable,5);
 for(const r of rows(result)) for(const id of r.baselineDocumentIds)assert.ok(Number(id)<Number(r.documentId));
 assert.equal(final[0].baselineSpanHours,48);
});
test('same timestamp records never reference each other and are excluded from later baselines',()=>{
 const data=[record(0),record(1),record(2),record(3),record(4,180,{date:record(3).date}),record(5)];
 const r=analyseTimeline(data,rules);
 assert.deepEqual(rows(r).find(x=>x.documentId==='5'&&x.N===3).baselineDocumentIds,['0','1','2']);
 assert.ok(rows(r).filter(x=>['3','4'].includes(x.documentId)).every(x=>!x.baselineDocumentIds.includes('3')&&!x.baselineDocumentIds.includes('4')));
});
for(const [label,extra,reason] of [
 ['zero',{weightNow:250,ml:0},'nonpositive_normal_ml'],
 ['exchange',{isBottleExchange:true},'exchange'],
 ['mismatch',{ml:999},'ml_mismatch'],
 ['legacy',{unit:undefined},'not_explicit_weight_unit'],
 ['missing',{weightNow:undefined},'invalid_or_missing_weight'],
 ['flag',{isBottleExchange:undefined},'missing_or_invalid_exchange_flag'],
 ['date',{date:'invalid'},'invalid_date'],
 ['nonfinite',{weightNow:Infinity},'invalid_or_missing_weight'],
])test(`exclusion ${label}`,()=>{const r=analyseTimeline([record(0,20,extra)],rules);assert.equal(r.summary.counts.eligible,0);assert.equal(r.summary.excludedReasons[reason],1);});
test('high baseline avoids relative warning; low baseline to over 150 flagged and ward metrics retained',()=>{
 const high=Array.from({length:6},(_,i)=>record(i,130,{staffId:'high'}));
 const low=Array.from({length:6},(_,i)=>record(i,i===5?160:20,{staffId:'low'}));
 const r=analyseTimeline([...high,...low],rules);
 assert.equal(rows(r).find(x=>x.staffId==='high'&&x.N===5).matchedRuleIds.includes('r'),false);
 const x=rows(r).find(x=>x.staffId==='low'&&x.N===5);assert.equal(x.typicalLowToOver150,true);assert.ok(x.matchedRuleIds.includes('rd'));
 assert.equal(r.summary.comparisons.find(x=>x.N===5&&x.ruleId==='r').wards['78f'].warnings,1);
});
test('continuous interval and auxiliary rate, chain mismatch and zero 11249 case remain separate',()=>{
 const a=record(0,10,{staffId:'11249',weightNow:252,weightPrev:260,ml:calculateWeightUsage(260,252)});
 const b=record(1,0,{staffId:'11249',weightPrev:205,weightNow:205,ml:0});
 const r=analyseTimeline([a,b],rules),x=r.knownCase.records[1];
 assert.equal(x.chainMismatch,true);assert.equal(x.chainDifferenceG,-47);assert.equal(x.elapsedHours,24);
 assert.equal(x.continuousWeightElapsedHours,null);assert.equal(r.summary.chainMismatchCount,1);assert.equal(rows(r).length,0);
 const data=[record(0),record(1,20,{weightPrev:record(0).weightNow,weightNow:record(0).weightNow-17.44})];
 const c=analyseTimeline(data.map(r=>({...r,staffId:'11249'})),rules).knownCase.records[1];
 assert.equal(c.chainMismatch,false);assert.equal(c.continuousWeightElapsedHours,24);
});
test('interval rule uses continuous chain, separates long gaps and short-rate reliability',()=>{
 const data=[];let prev=263;
 for(let i=0;i<4;i++){const ml=i===3?100:10;const now=prev-ml*218/250;data.push(record(i,ml,{staffId:'11249',weightPrev:prev,weightNow:now,ml}));prev=now;}
 let r=analyseTimeline(data,rules);assert.ok(rows(r)[0].matchedRuleIds.includes('interval'));
 data[3].date=new Date(Date.parse(data[2].date)+72*3600000).toISOString();
 r=analyseTimeline(data,rules);assert.equal(rows(r)[0].matchedRuleIds.includes('interval'),false);
 data[3].date=new Date(Date.parse(data[2].date)+1000).toISOString();
 r=analyseTimeline(data,rules);assert.equal(r.knownCase.records.at(-1).elapsed24HourEquivalentMl,null);
 assert.equal(r.summary.comparisons.find(x=>x.N===3&&x.ruleId==='interval').evaluable,0);
});
test('no bridging other modes; numeric/string and fullwidth IDs stay separate; name never accessed',()=>{
 const data=[record(0),record(1,20,{unit:'count'}),record(2)];
 for(const r of data) {r.staffId='11249';Object.defineProperty(r,'name',{get(){throw new Error('personal data accessed');}});}
 const result=analyseTimeline(data,rules);assert.equal(result.knownCase.records[2].continuousWeightElapsedHours,null);
 assert.equal(JSON.stringify(result).includes('"name"'),false);
 const ids=analyseTimeline([record(0),record(1,20,{staffId:'０１３７'}),record(2,20,{staffId:137}),record(3)],rules);
 assert.equal(rows(ids).length,0);
});
test('invalid rule configurations rejected; inputs not mutated',()=>{
 assert.throws(()=>analyseTimeline([],[{id:'bad',ratio:NaN}]));
 assert.throws(()=>analyseTimeline([],[{id:'bad',ratio:2,unknown:true}]));
 const data=[record(0),record(1),record(2),record(3)],before=JSON.stringify(data);analyseTimeline(data);assert.equal(JSON.stringify(data),before);
});
test('runner static safety; confirmation stops before Firebase init; no executable audit import',()=>{
 for(const word of ['firebase-admin','applicationDefault','child_process','addDoc','setDoc','updateDoc','deleteDoc','runTransaction','writeBatch','exec(','spawn('])assert.equal(source.includes(word),false,word);
 assert.doesNotMatch(source,/\.name\b|\.data\s*\(|fetch\s*\(/);
 assert.equal((source.match(/collection\(db, 'records'\)/g)||[]).length,1);
 assert.ok(source.indexOf('confirmReadOnly();')<source.indexOf('initializeApp(config'));
 const def=source.slice(source.indexOf('function confirmReadOnly()'),source.indexOf('async function loadFirebaseConfig()'));
 for(const argv of [[],['--confirm-records-read-only']])assert.throws(()=>vm.runInNewContext(def+';confirmReadOnly();',{process:{argv:['node','audit',...argv]}}),/confirmation/);
 vm.runInNewContext(def+';confirmReadOnly();',{process:{argv:['node','audit','--confirm-personal-weight-timeline-records-read-only']}});
 assert.match(source,/await getDocsFromServer\(request\)/);assert.match(source,/await assertOutsideGit\(tempRoot\)/);
 assert.match(source,/\['known-case', report.knownCase\]/);
});

function finalEvaluation(baseline, current, n=7, extra={}) {
  const data=Array.from({length:n+1},(_,i)=>record(i,i===n?current:baseline,extra));
  return analyseTimeline(data);
}
test('complete candidate matrix preserves old rules and has exactly 30 N/absolute/ratio comparisons',()=>{
  const candidates=candidateRules();
  assert.equal(new Set(candidates.map(r=>r.id)).size,candidates.length);
  for(const id of ['ratio-2','difference-75','absolute-150','ratio-3-difference-75-within-36h'])assert.ok(candidates.some(r=>r.id===id));
  const result=analyseTimeline([]);
  const matrix=result.summary.comparisons.filter(r=>/^ratio-[23]-absolute-(50|75|100|125|150)$/.test(r.ruleId));
  assert.equal(matrix.length,30);
  assert.match(result.summary.notice,/比較候補.*未決定/);
});
for(const minimum of [50,75,100,125,150])for(const multiplier of [2,3]) {
  test(`inclusive AND boundary ${minimum}mL, ${multiplier}x`,()=>{
    const id=`ratio-${multiplier}-absolute-${minimum}`;
    // Integer medians make the ratio boundary exact after the existing 2-decimal calculation.
    const baseline=Math.ceil(minimum/multiplier), boundary=baseline*multiplier;
    const equal=rows(finalEvaluation(baseline,boundary)).find(r=>r.documentId==='7'&&r.N===7);
    assert.ok(equal.matchedRuleIds.includes(id));
    const below=rows(finalEvaluation(baseline,boundary-.01)).find(r=>r.documentId==='7'&&r.N===7);
    assert.equal(below.matchedRuleIds.includes(id),false);
    const absoluteEqual=rows(finalEvaluation(1,minimum)).find(r=>r.documentId==='7'&&r.N===7);
    assert.ok(absoluteEqual.matchedRuleIds.includes(id));
    const absoluteBelow=rows(finalEvaluation(1,minimum-.01)).find(r=>r.documentId==='7'&&r.N===7);
    assert.equal(absoluteBelow.matchedRuleIds.includes(id),false);
    const detail=equal.matchedRuleConditions.find(r=>r.ruleId===id);
    assert.equal(detail.minimumMl,minimum);assert.equal(detail.medianMultiplier,multiplier);
  });
}
test('small absolute use excluded even with large ratios; habitual high use not inherently warned',()=>{
  for(const [usual,current] of [[2.29,4.59],[3.44,14.91],[9.17,22.94],[20.64,47.02],[2,30]]) {
    const r=rows(finalEvaluation(usual,current)).find(r=>r.documentId==='7'&&r.N===7);
    assert.ok(r.matchedRuleIds.includes('ratio-2'));
    assert.equal(r.matchedRuleIds.some(id=>/^ratio-[23]-absolute-/.test(id)),false);
  }
  const high=rows(finalEvaluation(130,160)).find(r=>r.documentId==='7'&&r.N===7);
  assert.equal(high.matchedRuleIds.some(id=>/^ratio-[23]-absolute-/.test(id)),false);
});
test('low/middle baseline to large use: N denominators, ward rates, staff counts and privacy',()=>{
  const data=[];
  for(const [id,ward,base,current] of [['low','4f',20,150],['high','78f',130,160]]) {
    for(let i=0;i<8;i++){
      const r=record(i,i===7?current:base,{id:`${id}-${i}`,staffId:id,wardId:ward});
      Object.defineProperty(r,'name',{get(){throw new Error('name accessed');}});data.push(r);
    }
  }
  const result=analyseTimeline(data);
  for(const n of [3,5,7]) {
    const summary=result.summary.comparisons.find(r=>r.N===n&&r.ruleId==='ratio-3-absolute-150');
    assert.equal(summary.evaluable,(8-n)*2);assert.equal(summary.warnings,1);assert.equal(summary.staffCount,1);
    assert.equal(summary.wards['4f'].evaluable,8-n);assert.equal(summary.wards['4f'].warnings,1);
    assert.equal(summary.wards['4f'].warningPercent,100/(8-n));
    assert.equal(summary.wards['78f'].warnings,0);assert.equal(summary.wards['78f'].warningPercent,0);
  }
  assert.equal(JSON.stringify(result).includes('"name"'),false);
});
