import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { idleRemeasurement, acceptRemeasurementResponse, retryRemeasurement, recordFlowRequest, blockConfirmationEnter, createRecordRequestScope } from '../utils/recordRemeasurementState.js';
const page=readFileSync(new URL('../pages/record/index.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const saveSource=page.slice(page.indexOf('  const saveRecord = async'),page.indexOf('// ★ 交換ダイアログ'));
const handlerSource=page.slice(page.indexOf('const handleRemeasureAgain ='),page.indexOf('\n\n\n  if (!staff)'));
const recordSource=page.slice(page.indexOf('const handleRecord ='),page.indexOf('const handleRemeasureAgain ='));
const response=(code,challenge,weightNow=162.8,currentMl=100)=>({code,challenge,previousWeight:250,weightNow,currentMl,personalMedianMl:25,personalRuleEvaluated:true,matchedRules:['A']});
const aResponse=response('WEIGHT_REMEASUREMENT_REQUIRED','dummy-A');
const bResponse=response('WEIGHT_REMEASUREMENT_CONFIRMATION_REQUIRED','dummy-B',154.08,110);
const a=()=>acceptRemeasurementResponse(idleRemeasurement(),aResponse,'normal');
const b=()=>acceptRemeasurementResponse(a(),bResponse,'remeasure');
const jsonReply=(status,body)=>({ok:status===200,status,json:async()=>body});
function client(initial=idleRemeasurement(), replies=[]) {
 const stats={posts:[],writes:[],states:[],messages:[],weights:[],clears:0,confirmCalls:0};
 const stored=new Map([['currentStaff',JSON.stringify({staffId:'0137',lastWeight:250})]]);
 const settings={id:'0137',required:false,network:false,storageFailure:false};
 const scope=createRecordRequestScope();let operations=0;
 const context={
  staff:{staffId:'0137',lastWeight:250,wardId:'6f'},weightNow:String(initial.display?.weightNow??162.8),
  isSubmitting:false,recordLockRef:{current:false},exchangeLockRef:{current:false},readyRef:{current:true},
  remeasurementRef:{current:initial},requestScopeRef:{current:scope},saveUncertainRef:{current:false},cleanupFailedRef:{current:false},
  setReady:v=>{context.readyRef.current=v;},setDraftNotice(){},
  idleRemeasurement,acceptRemeasurementResponse,retryRemeasurement,recordFlowRequest,
  currentRecordStaffId:()=>settings.id, getAppUpdateState:()=>({required:settings.required}),requireAppUpdate:()=>{settings.required=true;},getAppBuildId:()=> 'fixture-build',
  ensureCurrentVersion:async()=>!settings.required,
  beginUpdateOperation:()=>{operations++;let done=false;return()=>{if(!done){operations--;done=true;}};},
  clearMessageTimer(){},messageTimerRef:{current:null},setTimeout:()=>1,
  setMessage:m=>stats.messages.push(m),setMessageType(){},setShowExchangeConfirm:v=>{stats.exchange=v;},
  setWeightNow:v=>{context.weightNow=v;stats.weights.push(v);},setStaff:v=>stats.states.push(v),setIsSubmitting:v=>{context.isSubmitting=v;},
  changeRemeasurement:v=>{context.remeasurementRef.current=v;},resetRemeasurement:()=>{context.remeasurementRef.current=idleRemeasurement();},
  sessionStorage:{},clearRecordDraft:()=>{stats.clears++;},window:{},
  localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>{if(settings.storageFailure)throw Error('storage');stats.writes.push(k);stored.set(k,v);}},
  Timestamp:{fromDate:v=>v},wardNameMap:{'6f':'6階'},normalMessages:['ok'],funMessages:['ok'],mintSpiritMessages:['ok'],legendaryMintMessages:['ok'],
  weightUpdateWarning:'再登録せず、管理者に確認してください。',EMPTY_WEIGHT:45,FULL_WEIGHT:263,ML_PER_GRAM:250/218,
  confirm:()=>{stats.confirmCalls++;return true;},
  fetch:async(_,options)=>{stats.posts.push(JSON.parse(options.body));if(settings.network)throw Error('network');const next=replies.shift();if(!next)throw Error('No fixture response');return typeof next==='function'?next():next;},
 };
 const api=vm.runInNewContext(`${saveSource}\n${recordSource}\n${handlerSource}\n({saveRecord,handleRecord,handleRemeasureAgain,handleRemeasureCancel,handleRemeasureConfirm})`,context);
 return {api,context,stats,settings,scope,stored,get operations(){return operations;}};
}
test('actual saveRecord: initial A clears only re-entry field, no successful local writes or automatic POST',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(422,aResponse)]);assert.equal(await c.api.saveRecord(100,162.8,false),false);
 assert.equal(c.context.remeasurementRef.current.phase,'remeasure_required');assert.equal(c.context.remeasurementRef.current.challengeA,'dummy-A');
 assert.equal(c.context.weightNow,'');assert.equal(c.context.remeasurementRef.current.initialWeightNow,162.8);
 assert.equal(c.stats.posts.length,1);assert.equal(c.stats.posts[0].operation,'normal');assert.deepEqual(c.stats.writes,[]);assert.deepEqual(c.stats.states,[]);assert.equal(c.operations,0);
});
test('actual saveRecord: A is preserved when replaced by B, next explicit confirmation uses exact B weight',async()=>{
 const c=client(a(),[jsonReply(422,bResponse),jsonReply(200,{ok:true,recordId:'new',staffId:'0137',lastWeight:154.08,ml:110})]);
 c.context.weightNow='154.08';await c.api.saveRecord(110,154.08,false);
 assert.equal(c.context.remeasurementRef.current.challengeA,'dummy-A');assert.equal(c.context.remeasurementRef.current.challengeB,'dummy-B');
 assert.equal(c.stats.posts[0].operation,'remeasure');assert.equal(c.stats.posts[0].challenge,'dummy-A');assert.equal(c.stats.posts.length,1);
 await c.api.handleRemeasureConfirm();assert.equal(c.stats.posts.length,2);assert.equal(c.stats.posts[1].operation,'confirm_remeasurement');assert.equal(c.stats.posts[1].challenge,'dummy-B');
 assert.equal(c.stats.posts[1].weightNow,154.08);assert.equal(c.context.remeasurementRef.current.phase,'idle');
 for(const value of c.stored.values())assert.equal(value.includes('dummy-'),false);
 assert.equal(JSON.parse(c.stored.get('currentStaff')).lastWeight,154.08);
});
test('actual record handler: normal keeps generic confirm, remeasure skips it, confirmation stage cannot use normal button',async()=>{
 const normal=client(idleRemeasurement(),[jsonReply(200,{ok:true,staffId:'0137',lastWeight:162.8,ml:100})]);await normal.api.handleRecord();assert.equal(normal.stats.confirmCalls,1);
 const remeasure=client(a(),[jsonReply(200,{ok:true,staffId:'0137',lastWeight:162.8,ml:100})]);await remeasure.api.handleRecord();assert.equal(remeasure.stats.confirmCalls,0);assert.equal(remeasure.stats.posts[0].operation,'remeasure');
 const confirmation=client(b(),[]);await confirmation.api.handleRecord();assert.equal(confirmation.stats.posts.length,0);
});
test('actual retry handler discards B, retains A and clears field without sending; edit also invalidates B',()=>{
 const c=client(b());c.api.handleRemeasureAgain();assert.equal(c.context.remeasurementRef.current.phase,'remeasure_required');assert.equal(c.context.remeasurementRef.current.challengeB,null);assert.equal(c.context.remeasurementRef.current.challengeA,'dummy-A');assert.equal(c.context.weightNow,'');assert.equal(c.stats.posts.length,0);
 const body=page.slice(page.indexOf('  onChange={(e) => {')+'  onChange={(e) => {'.length,page.indexOf('\n  }}\n  placeholder=',page.indexOf('  onChange={(e) => {')));
 const edited=client(b());vm.runInNewContext(`((e)=>{${body}})({target:{value:'１５３'}})`,edited.context);
 assert.equal(edited.context.remeasurementRef.current.phase,'remeasure_required');assert.equal(edited.context.remeasurementRef.current.challengeB,null);assert.equal(edited.context.weightNow,'153');assert.equal(edited.stats.posts.length,0);
});
test('final confirmation has synchronous double-click guard and releases after response',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});const c=client(b(),[()=>pending]);
 const first=c.api.handleRemeasureConfirm(),second=c.api.handleRemeasureConfirm();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(c.stats.posts.length,1);assert.equal(c.context.recordLockRef.current,true);assert.equal(c.context.isSubmitting,true);
 release(jsonReply(200,{ok:true,staffId:'0137',lastWeight:154.08,ml:110}));await Promise.all([first,second]);assert.equal(c.context.recordLockRef.current,false);assert.equal(c.context.isSubmitting,false);assert.equal(c.operations,0);
});
test('Enter default activation is prevented on actual confirmation binding, no autofocus or form approval',()=>{
 let prevented=0;blockConfirmationEnter({key:'Enter',preventDefault:()=>prevented++});assert.equal(prevented,1);
 assert.match(page,/type="button" disabled=\{isSubmitting \|\| !ready\} onKeyDown=\{blockConfirmationEnter\} onClick=\{handleRemeasureConfirm\}/);
 assert.doesNotMatch(page,/autoFocus|onSubmit=\{handleRemeasureConfirm\}/);
});
for(const [label,change] of [['staff switch',c=>{c.settings.id='other';c.scope.invalidate();}],['logout/route',c=>c.scope.invalidate()],['unmount',c=>c.scope.dispose()]])test(`late A/B response cannot overwrite after ${label}`,async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});const c=client(idleRemeasurement(),[()=>pending]);const run=c.api.saveRecord(100,162.8,false);await new Promise(resolve=>setImmediate(resolve));
 change(c);release(jsonReply(422,aResponse));await run;assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.equal(c.stats.posts.length,1);assert.deepEqual(c.stats.writes,[]);assert.deepEqual(c.stats.states,[]);
});
test('reload/restart initializes idle; app update ignores a late challenge and never automatically sends',async()=>{
 const fresh=client();assert.equal(fresh.context.remeasurementRef.current.phase,'idle');assert.equal(fresh.stats.posts.length,0);
 const c=client(idleRemeasurement(),[()=>{c.settings.required=true;return jsonReply(422,aResponse);}]);await c.api.saveRecord(100,162.8,false);
 assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.equal(c.stats.posts.length,1);
 assert.match(page,/subscribeAppUpdate\([\s\S]*?required\) resetRemeasurement/);
 assert.match(page,/routeChangeStart/);assert.match(page,/requestScopeRef\.current\.dispose\(\)/);
});
test('426 keeps weight and discards challenges; expiration returns to idle without losing entered weight',async()=>{
 for(const [status,code] of [[426,'APP_UPDATE_REQUIRED'],[422,'WEIGHT_CHALLENGE_EXPIRED']]){
  const c=client(a(),[jsonReply(status,{code,error:'最初から入力し直してください。'})]);const before=c.context.weightNow;await c.api.saveRecord(100,162.8,false);
  assert.equal(c.context.weightNow,before);assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.equal(c.stats.posts.length,1);assert.deepEqual(c.stats.writes,[]);
 }
});
for(const phase of ['remeasure','confirm'])test(`unknown ${phase} save result: no automatic retry or reusable approval`,async()=>{
 const c=client(phase==='remeasure'?a():b());c.settings.network=true;
 await c.api.saveRecord(100,phase==='confirm'?154.08:162.8,false);assert.equal(c.stats.posts.length,1);assert.equal(c.context.readyRef.current,false);assert.equal(c.context.saveUncertainRef.current,true);assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.deepEqual(c.stats.writes,[]);
});
test('malformed successful response and post-success storage failure never automatically resend',async()=>{
 const malformed=client(b(),[jsonReply(200,{ok:true,staffId:'other',lastWeight:154.08,ml:110})]);await malformed.api.handleRemeasureConfirm();assert.equal(malformed.context.saveUncertainRef.current,true);assert.deepEqual(malformed.stats.writes,[]);assert.equal(malformed.stats.posts.length,1);
 const c=client(b(),[jsonReply(200,{ok:true,staffId:'0137',lastWeight:154.08,ml:110})]);c.settings.storageFailure=true;await c.api.handleRemeasureConfirm();assert.equal(c.stats.posts.length,1);assert.equal(c.context.readyRef.current,false);assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.ok(c.stats.messages.some(m=>m.includes('記録は保存されました')));
});
test('challenge-stage weight increase never opens exchange confirmation; ordinary exchange still opens it',async()=>{
 const c=client(a());c.context.weightNow='255';await c.api.handleRecord();assert.equal(c.stats.exchange,undefined);assert.equal(c.stats.posts.length,0);assert.ok(c.stats.messages.some(m=>m.includes('交換扱いにできません')));
 const normal=client();normal.context.weightNow='255';await normal.api.handleRecord();assert.equal(normal.stats.exchange,true);assert.equal(normal.stats.posts.length,0);
});
test('response validator rejects incomplete challenge responses; no unknown personal fields copied',()=>{
 for(const change of [{challenge:null},{currentMl:NaN},{weightNow:45},{personalRuleEvaluated:'true'}])assert.throws(()=>acceptRemeasurementResponse(idleRemeasurement(),{...aResponse,...change},'normal'));
 const state=acceptRemeasurementResponse(idleRemeasurement(),{...aResponse,name:'PRIVATE',extra:'PRIVATE'},'normal');assert.equal(JSON.stringify(state).includes('PRIVATE'),false);
 assert.throws(()=>recordFlowRequest(b(),150,false));assert.throws(()=>recordFlowRequest(a(),150,true));
});
test('no server crypto imports in browser, no additional persistent fields or token logging',()=>{
 assert.doesNotMatch(page,/utils\/server|console\.(?:log|error)|sessionStorage\.setItem|challenge.*localStorage\.setItem/);
 const state=readFileSync(new URL('../utils/recordRemeasurementState.js',import.meta.url),'utf8');assert.doesNotMatch(state,/firebase|node:crypto|sessionStorage|localStorage|console\./);
 const draft=readFileSync(new URL('../utils/recordUpdateDraft.js',import.meta.url),'utf8');assert.match(draft,/JSON\.stringify\(\{ staffId: id, weightNow, savedAt: now \}\)/);
});

test('actual route handler discards tokens on login/logout navigation, but current tab re-selection stays usable',()=>{
 const source=page.slice(page.indexOf('  const leave = url => {'),page.indexOf('  router.events.on("routeChangeStart", leave)'));
 const scope=createRecordRequestScope(),ticket=scope.begin('0137');let state=b(),ready=true;
 const leave=vm.runInNewContext(`${source}\nleave`,{requestScopeRef:{current:scope},resetRemeasurement:()=>{state=idleRemeasurement();},readyRef:{current:true},setReady:v=>{ready=v;},setMessage(){},router:{pathname:'/record'}});
 leave('/record');assert.equal(state.phase,'confirmation_required');assert.equal(ready,true);assert.equal(scope.valid(ticket,'0137'),true);
 leave('/login');assert.equal(state.phase,'idle');assert.equal(ready,false);assert.equal(scope.valid(ticket,'0137'),false);
});
test('mismatched challenge response stops safely rather than displaying or confirming the wrong weight',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(422,{...aResponse,weightNow:123})]);
 await c.api.saveRecord(100,162.8,false);assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.equal(c.context.readyRef.current,false);assert.equal(c.stats.posts.length,1);assert.deepEqual(c.stats.writes,[]);
});
test('staff change during JSON parsing alone prevents challenge adoption, without relying on storage event',async()=>{
 let release;const body=new Promise(resolve=>{release=resolve;});const c=client(idleRemeasurement(),[{ok:false,status:422,json:()=>body}]);
 const run=c.api.saveRecord(100,162.8,false);await new Promise(resolve=>setImmediate(resolve));
 c.settings.id='other';release(aResponse);await run;
 assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.equal(c.stats.posts.length,1);assert.deepEqual(c.stats.writes,[]);
});
for(const initial of [idleRemeasurement(),a()])test(`synchronous record click lock in ${initial.phase}`,async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});const c=client(initial,[()=>pending]);
 const first=c.api.handleRecord(),second=c.api.handleRecord();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(c.stats.posts.length,1);assert.equal(c.context.recordLockRef.current,true);
 release(jsonReply(200,{ok:true,staffId:'0137',lastWeight:162.8,ml:100}));await Promise.all([first,second]);
 assert.equal(c.stats.posts.length,1);assert.equal(c.context.recordLockRef.current,false);assert.equal(c.operations,0);
});
