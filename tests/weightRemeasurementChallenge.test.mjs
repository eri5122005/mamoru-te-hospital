import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { issueWeightChallenge, verifyWeightChallenge, WeightChallengeError, WEIGHT_CHALLENGE_POLICY as POLICY } from '../utils/server/weightRemeasurementChallenge.js';
// Dummy test key only, never a deployment credential.
const secret='fixture-only-signing-key-32-bytes-or-more';
const nowMs=Date.UTC(2026,9,21,0,0,0);
const claims=(stage='remeasure')=>({stage,staffId:'0137',previousWeight:250,weightNow:119.2,currentMl:150,appBuildId:'test-build',ruleVersion:'weight_v1',
 matchedRules:['B'],personalMedianMl:null,baselineCount:0,personalRuleEvaluated:false});
const issue=(c=claims(),options={})=>issueWeightChallenge(c,{secret,nowMs,...options});
const verify=(token,options={})=>verifyWeightChallenge(token,{secret,nowMs,expectedStage:'remeasure',...options});
const invalid=fn=>assert.throws(fn,e=>e instanceof WeightChallengeError&&e.code==='WEIGHT_CHALLENGE_INVALID');
function signedRaw(text,key=secret) {const encoded=Buffer.from(text).toString('base64url');return `${encoded}.${createHmac('sha256',key).update(encoded,'utf8').digest('base64url')}`;}
function payload(stage='remeasure'){return JSON.parse(Buffer.from(issue(claims(stage)).split('.')[0],'base64url').toString('utf8'));}
for(const stage of ['remeasure','confirm'])test(`${stage} issuance/verification succeeds with ms TTL`,()=>{
 const token=issue(claims(stage));const p=verify(token,{expectedStage:stage});assert.equal(p.version,1);assert.equal(p.issuedAt,nowMs);
 assert.equal(p.expiresAt-nowMs,stage==='remeasure'?600000:300000);assert.equal(p.weightNow,119.2);assert.equal(p.staffId,'0137');
});
for(const [stage,expectedStage] of [['remeasure','confirm'],['confirm','remeasure']])test(`${stage} cannot verify as ${expectedStage}`,()=>{
 assert.throws(()=>verify(issue(claims(stage)),{expectedStage}),e=>e.code==='WEIGHT_CHALLENGE_WRONG_STAGE');
});
test('payload/signature/one-character tampering rejected',()=>{
 const token=issue(),[p,s]=token.split('.');
 const changed=Buffer.from(JSON.stringify({...payload(),staffId:'9999'})).toString('base64url');invalid(()=>verify(`${changed}.${s}`));
 invalid(()=>verify(`${p}.${s[0]==='A'?'B':'A'}${s.slice(1)}`));
 invalid(()=>verify(`${p[0]==='A'?'B':'A'}${token.slice(1)}`));
});
for(const token of [undefined,null,123,[],{},'', 'a','a.b.c','!.abc','abc.===','a.a','AA.AA','x'.repeat(POLICY.maxTokenLength+1)])test(`invalid token shape ${typeof token}/${String(token).slice(0,12)}`,()=>invalid(()=>verify(token)));
test('noncanonical base64url, invalid JSON and invalid UTF8 rejected after signature',()=>{
 const token=issue();invalid(()=>verify(token.replace('.', '=.')));
 invalid(()=>verify(signedRaw('{broken')));invalid(()=>verify(signedRaw('null')));invalid(()=>verify(signedRaw('[]')));
 const p=Buffer.from([0xff]).toString('base64url'),s=createHmac('sha256',secret).update(p).digest('base64url');invalid(()=>verify(`${p}.${s}`));
});
for(const [key,value] of [
 ['version',2],['version','1'],['stage','unknown'],['stage',[]],
 ['staffId',''],['staffId','０１３７'],['staffId',' 0137 '],['staffId',137],['staffId',[]],['staffId','a/b'],['staffId','..'],
 ['previousWeight',44.99],['previousWeight',263.01],['previousWeight',null],['previousWeight',[]],['previousWeight','250'],
 ['weightNow',45],['weightNow',263.01],['weightNow',{}],
 ['currentMl',-1],['currentMl',250.01],['currentMl',null],['currentMl','Infinity'],
 ['appBuildId',''],['appBuildId',{}],['appBuildId','a b'],['appBuildId','x'.repeat(129)],
 ['ruleVersion',''],['ruleVersion',1],['ruleVersion','x'.repeat(65)],
 ['issuedAt',0],['issuedAt',1.5],['issuedAt','123'],['expiresAt',0],['expiresAt',null],
 ['expiresAt',nowMs],['expiresAt',nowMs-1],['expiresAt',nowMs+600001],
 ['flowExpiresAt',nowMs],['flowExpiresAt',nowMs+1],['flowExpiresAt','future'],
 ['matchedRules',['C']],['matchedRules',['A','A']],['matchedRules',[]],['matchedRules','A'],
 ['personalMedianMl',-1],['personalMedianMl','25'],['baselineCount',4],['baselineCount',2.5],
 ['personalRuleEvaluated','false'],['baselineDigest','not-a-digest'],['name','PRIVATE'],['department','PRIVATE'],['alg','none'],
])test(`signed invalid schema ${key}/${JSON.stringify(value).slice(0,16)}`,()=>invalid(()=>verify(signedRaw(JSON.stringify({...payload(),[key]:value})))));
test('missing required fields rejected even with valid signature',()=>{
 for(const key of ['version','stage','staffId','previousWeight','weightNow','currentMl','appBuildId','ruleVersion','issuedAt','expiresAt']){
  const p=payload();delete p[key];invalid(()=>verify(signedRaw(JSON.stringify(p))));
 }
});
test('NaN/Infinity and malformed issuance never silently serialize as acceptable data',()=>{
 for(const key of ['previousWeight','weightNow','currentMl','personalMedianMl'])for(const value of [NaN,Infinity,-Infinity])invalid(()=>issue({...claims(),[key]:value}));
 for(const value of [null,[],{},'x'])invalid(()=>issue(value));
 invalid(()=>issue({...claims(),version:99}));invalid(()=>issue({...claims(),name:'PRIVATE'}));
});
test('expiration exact boundary; no expiry grace',()=>{
 const token=issue(),expiresAt=nowMs+600000;
 assert.equal(verify(token,{nowMs:expiresAt-1}).expiresAt,expiresAt);
 for(const t of [expiresAt,expiresAt+1])assert.throws(()=>verify(token,{nowMs:t}),e=>e.code==='WEIGHT_CHALLENGE_EXPIRED');
});
test('future issuedAt tolerance inclusive 30s; beyond it invalid',()=>{
 const token=issue();assert.equal(verify(token,{nowMs:nowMs-30000}).issuedAt,nowMs);invalid(()=>verify(token,{nowMs:nowMs-30001}));
 for(const t of [NaN,Infinity,undefined]){if(t!==undefined)invalid(()=>verify(token,{nowMs:t}));}
});
test('flow deadline caps confirm TTL; cannot issue after flow expiration',()=>{
 const deadline=nowMs+120000;
 const token=issue({...claims('confirm'),flowExpiresAt:deadline});assert.equal(verify(token,{expectedStage:'confirm'}).expiresAt,deadline);
 invalid(()=>issue({...claims('confirm'),flowExpiresAt:nowMs}));
});
test('missing/weak secret fails closed only at call time, no values in errors',()=>{
 const token=issue();
 for(const key of [undefined,null,'','   ','short',{},'x'.repeat(4097)]) {
  // Undefined uses the environmental default; test that path separately with no real value output.
  if(key===undefined)continue;
  for(const fn of [()=>issue(claims(),{secret:key}),()=>verify(token,{secret:key})])assert.throws(fn,e=>e.code==='WEIGHT_CHALLENGE_UNAVAILABLE'&&e.message==='WEIGHT_CHALLENGE_UNAVAILABLE');
 }
 const original=process.env.WEIGHT_REMEASUREMENT_SIGNING_SECRET;
 try {
  delete process.env.WEIGHT_REMEASUREMENT_SIGNING_SECRET;
  assert.throws(()=>issueWeightChallenge(claims(),{nowMs}),e=>e.code==='WEIGHT_CHALLENGE_UNAVAILABLE');
  assert.throws(()=>verifyWeightChallenge(token,{nowMs,expectedStage:'remeasure'}),e=>e.code==='WEIGHT_CHALLENGE_UNAVAILABLE');
 } finally {
  if(original===undefined)delete process.env.WEIGHT_REMEASUREMENT_SIGNING_SECRET;else process.env.WEIGHT_REMEASUREMENT_SIGNING_SECRET=original;
 }
});
test('secret absent from claims; no personal information; deterministic tokens and different keys rejected',()=>{
 const token=issue();assert.equal(token,issue());const p=verify(token);
 assert.equal(JSON.stringify(p).includes(secret),false);assert.equal(token.includes(secret),false);
 invalid(()=>verify(token,{secret:'a-different-fixture-key-at-least-32-bytes'}));
 assert.equal(Object.keys(p).some(k=>['name','department','secret'].includes(k)),false);
});
test('A does not require future weight equality; B preserves measured value exactly for caller binding',()=>{
 const a=verify(issue());const futureInput=122.3;assert.notEqual(a.weightNow,futureInput);
 // Caller supplies new weight separately; verification A itself has no equality constraint.
 assert.equal(verify(issue()).stage,'remeasure');
 const b=verify(issue({...claims('confirm'),weightNow:122.3}),{expectedStage:'confirm'});assert.equal(b.weightNow,122.3);
});
test('optional complete baseline schema and invalid cross-field combinations',()=>{
 const c={...claims(),matchedRules:['A','B'],personalMedianMl:25,baselineCount:3,personalRuleEvaluated:true,baselineDigest:'a'.repeat(64)};
 assert.equal(verify(issue(c)).personalMedianMl,25);
 invalid(()=>issue({...c,baselineCount:2}));invalid(()=>issue({...c,personalMedianMl:null}));invalid(()=>issue({...c,personalRuleEvaluated:false}));
});
test('stateless replay is accepted, not consumed',()=>{const token=issue();assert.deepEqual(verify(token),verify(token));});
test('server-only isolation and no logging, state or network references',()=>{
 const source=readFileSync(new URL('../utils/server/weightRemeasurementChallenge.js',import.meta.url),'utf8');
 assert.match(source,/from 'node:crypto'/);assert.match(source,/createHmac\('sha256',secret\)\.update\(encodedPayload,'utf8'\)/);
 assert.ok(source.indexOf('signature.length!==32')<source.indexOf('timingSafeEqual(signature'));
 for(const word of ['firebase','Firestore','sessionStorage','localStorage','console.','NEXT_PUBLIC_','fetch(','pages/','setDoc','addDoc','runTransaction'])assert.equal(source.includes(word),false,word);
 for(const path of ['pages/api/records.js','pages/record/index.js'])assert.equal(readFileSync(new URL(`../${path}`,import.meta.url),'utf8').includes('weightRemeasurementChallenge'),false);
});
test('short and long signature buffers rejected before timingSafeEqual',()=>{
 const [p]=issue().split('.');
 for(const length of [1,31,33,64])invalid(()=>verify(`${p}.${Buffer.alloc(length).toString('base64url')}`));
});
