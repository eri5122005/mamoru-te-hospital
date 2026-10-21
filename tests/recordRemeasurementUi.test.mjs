import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { idleRemeasurement, acceptRemeasurementResponse, retryRemeasurement, recordFlowRequest, blockConfirmationEnter, createRecordRequestScope } from '../utils/recordRemeasurementState.js';
import { createRecordOperationLifecycle, savePendingRecordOperation, clearPendingRecordOperation, isKnownRecordFailure, isValidRecordSuccess, RECORD_RESULT_UNKNOWN_MESSAGE, PENDING_RECORD_OPERATION_KEY } from '../utils/recordOperationClient.js';
const page=readFileSync(new URL('../pages/record/index.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const saveSource=page.slice(page.indexOf('  const saveRecord = async'),page.indexOf('// ★ 交換ダイアログ'));
const handlerSource=page.slice(page.indexOf('const handleRemeasureAgain ='),page.indexOf('\n\n\n  if (!staff)'));
const recordSource=page.slice(page.indexOf('const handleRecord ='),page.indexOf('const handleRemeasureAgain ='));
const exchangeSource=page.slice(page.indexOf('const handleExchangeYes ='),page.indexOf('  // ★ 記録処理（重さ方式）'));
const response=(code,challenge,weightNow=162.8,currentMl=100)=>({code,challenge,previousWeight:250,weightNow,currentMl,personalMedianMl:25,personalRuleEvaluated:true,matchedRules:['A']});
const aResponse=response('WEIGHT_REMEASUREMENT_REQUIRED','dummy-A');
const bResponse=response('WEIGHT_REMEASUREMENT_CONFIRMATION_REQUIRED','dummy-B',154.08,110);
const a=()=>acceptRemeasurementResponse(idleRemeasurement(),aResponse,'normal');
const b=()=>acceptRemeasurementResponse(a(),bResponse,'remeasure');
const jsonReply=(status,body)=>({ok:status===200,status,json:async()=>body});
function client(initial=idleRemeasurement(), replies=[]) {
 const stats={posts:[],writes:[],states:[],messages:[],weights:[],clears:0,confirmCalls:0,ids:0};
 const stored=new Map([['currentStaff',JSON.stringify({staffId:'0137',lastWeight:250})]]);
 const settings={id:'0137',required:false,network:false,storageFailure:false,pendingFailure:false,clearPendingFailure:false};
 const session=new Map();
 const lifecycle=createRecordOperationLifecycle(()=>`00000000-0000-4000-8000-${(++stats.ids).toString(16).padStart(12,'0')}`);
 if(initial.phase!=='idle')lifecycle.begin('0137');
 const scope=createRecordRequestScope();let operations=0;
 const context={
  staff:{staffId:'0137',lastWeight:250,wardId:'6f'},weightNow:String(initial.display?.weightNow??162.8),
  isSubmitting:false,recordLockRef:{current:false},exchangeLockRef:{current:false},readyRef:{current:true},
  remeasurementRef:{current:initial},requestScopeRef:{current:scope},saveUncertainRef:{current:false},cleanupFailedRef:{current:false},
  operationLifecycleRef:{current:lifecycle},savePendingRecordOperation,clearPendingRecordOperation,isKnownRecordFailure,isValidRecordSuccess,RECORD_RESULT_UNKNOWN_MESSAGE,
  setReady:v=>{context.readyRef.current=v;},setDraftNotice(){},
  idleRemeasurement,acceptRemeasurementResponse,retryRemeasurement,recordFlowRequest,
  currentRecordStaffId:()=>settings.id, getAppUpdateState:()=>({required:settings.required}),requireAppUpdate:()=>{settings.required=true;},getAppBuildId:()=> 'fixture-build',
  ensureCurrentVersion:async()=>!settings.required,
  beginUpdateOperation:()=>{operations++;let done=false;return()=>{if(!done){operations--;done=true;}};},
  clearMessageTimer(){},messageTimerRef:{current:null},setTimeout:()=>1,
  setMessage:m=>stats.messages.push(m),setMessageType(){},setShowExchangeConfirm:v=>{stats.exchange=v;},
  setIsExchangeProcessing:v=>{stats.exchangeProcessing=v;},
  setWeightNow:v=>{context.weightNow=v;stats.weights.push(v);},setStaff:v=>{context.staff=v;stats.states.push(v);},setIsSubmitting:v=>{context.isSubmitting=v;},
  changeRemeasurement:v=>{context.remeasurementRef.current=v;},resetRemeasurement:()=>{context.remeasurementRef.current=idleRemeasurement();},
  sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>{if(settings.pendingFailure)throw Error('quota');session.set(k,v);},removeItem:k=>{if(settings.clearPendingFailure)throw Error('storage');session.delete(k);}},clearRecordDraft:()=>{stats.clears++;},window:{},
  localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>{if(settings.storageFailure)throw Error('storage');stats.writes.push(k);stored.set(k,v);}},
  Timestamp:{fromDate:v=>v},wardNameMap:{'6f':'6階'},normalMessages:['ok'],funMessages:['ok'],mintSpiritMessages:['ok'],legendaryMintMessages:['ok'],
  weightUpdateWarning:'再登録せず、管理者に確認してください。',EMPTY_WEIGHT:45,FULL_WEIGHT:263,ML_PER_GRAM:250/218,
  confirm:()=>{stats.confirmCalls++;return true;},
  fetch:async(_,options)=>{stats.posts.push(JSON.parse(options.body));if(settings.network)throw Error('network');const next=replies.shift();if(!next)throw Error('No fixture response');return typeof next==='function'?next():next;},
 };
 const api=vm.runInNewContext(`${saveSource}\n${recordSource}\n${exchangeSource}\n${handlerSource}\n({saveRecord,handleRecord,handleExchangeYes,handleExchangeNo,handleRemeasureAgain,handleRemeasureCancel,handleRemeasureConfirm})`,context);
 return {api,context,stats,settings,scope,stored,session,lifecycle,get operations(){return operations;}};
}
test('actual saveRecord: initial A clears only re-entry field, no successful local writes or automatic POST',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(422,aResponse)]);assert.equal(await c.api.saveRecord(100,162.8,false),false);
 assert.equal(c.context.remeasurementRef.current.phase,'remeasure_required');assert.equal(c.context.remeasurementRef.current.challengeA,'dummy-A');
 assert.equal(c.context.weightNow,'');assert.equal(c.context.remeasurementRef.current.initialWeightNow,162.8);
 assert.equal(c.stats.posts.length,1);assert.equal(c.stats.posts[0].operation,'normal');assert.deepEqual(c.stats.writes,[]);assert.deepEqual(c.stats.states,[]);assert.equal(c.operations,0);
});
test('actual saveRecord: A is preserved when replaced by B, next explicit confirmation uses exact B weight',async()=>{
 const c=client(a(),[jsonReply(422,bResponse),jsonReply(200,{ok:true,replayed:false,recordId:'new',staffId:'0137',lastWeight:154.08,ml:110})]);
 c.context.weightNow='154.08';await c.api.saveRecord(110,154.08,false);
 assert.equal(c.context.remeasurementRef.current.challengeA,'dummy-A');assert.equal(c.context.remeasurementRef.current.challengeB,'dummy-B');
 assert.equal(c.stats.posts[0].operation,'remeasure');assert.equal(c.stats.posts[0].challenge,'dummy-A');assert.equal(c.stats.posts.length,1);
 await c.api.handleRemeasureConfirm();assert.equal(c.stats.posts.length,2);assert.equal(c.stats.posts[1].operation,'confirm_remeasurement');assert.equal(c.stats.posts[1].challenge,'dummy-B');
 assert.equal(c.stats.posts[1].weightNow,154.08);assert.equal(c.context.remeasurementRef.current.phase,'idle');
 for(const value of c.stored.values())assert.equal(value.includes('dummy-'),false);
 assert.equal(JSON.parse(c.stored.get('currentStaff')).lastWeight,154.08);
});
test('actual record handler: normal keeps generic confirm, remeasure skips it, confirmation stage cannot use normal button',async()=>{
 const normal=client(idleRemeasurement(),[jsonReply(200,{ok:true,replayed:false,recordId:'new',staffId:'0137',lastWeight:162.8,ml:100})]);await normal.api.handleRecord();assert.equal(normal.stats.confirmCalls,1);
 const remeasure=client(a(),[jsonReply(200,{ok:true,replayed:false,recordId:'new',staffId:'0137',lastWeight:162.8,ml:100})]);await remeasure.api.handleRecord();assert.equal(remeasure.stats.confirmCalls,0);assert.equal(remeasure.stats.posts[0].operation,'remeasure');
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
 release(jsonReply(200,{ok:true,replayed:false,recordId:'new',staffId:'0137',lastWeight:154.08,ml:110}));await Promise.all([first,second]);assert.equal(c.context.recordLockRef.current,false);assert.equal(c.context.isSubmitting,false);assert.equal(c.operations,0);
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
 const malformed=client(b(),[jsonReply(200,{ok:true,replayed:false,recordId:'new',staffId:'other',lastWeight:154.08,ml:110})]);await malformed.api.handleRemeasureConfirm();assert.equal(malformed.context.saveUncertainRef.current,true);assert.deepEqual(malformed.stats.writes,[]);assert.equal(malformed.stats.posts.length,1);
 const c=client(b(),[jsonReply(200,{ok:true,replayed:false,recordId:'new',staffId:'0137',lastWeight:154.08,ml:110})]);c.settings.storageFailure=true;await c.api.handleRemeasureConfirm();assert.equal(c.stats.posts.length,1);assert.equal(c.context.readyRef.current,false);assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.ok(c.stats.messages.some(m=>m.includes('記録は保存されました')));
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
 release(jsonReply(200,{ok:true,replayed:false,recordId:'new',staffId:'0137',lastWeight:162.8,ml:100}));await Promise.all([first,second]);
 assert.equal(c.stats.posts.length,1);assert.equal(c.context.recordLockRef.current,false);assert.equal(c.operations,0);
});

test('normal record generates once, persists pending before POST, clears it and retires ID on success',async()=>{
 const c=client(idleRemeasurement(),[()=>{
  const pending=JSON.parse(c.session.get(PENDING_RECORD_OPERATION_KEY));
  assert.deepEqual(Object.keys(pending).sort(),['operationId','savedAt','staffId']);
  assert.equal(pending.operationId,c.stats.posts[0].operationId);
  return jsonReply(200,{ok:true,replayed:false,recordId:'first',staffId:'0137',lastWeight:162.8,ml:100});
 }]);
 assert.equal(c.stats.ids,0);await c.api.handleRecord();assert.equal(c.stats.ids,1);
 assert.equal(c.stats.posts.length,1);assert.equal(c.lifecycle.current(),null);assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);
 assert.equal(JSON.parse(c.stored.get('history'))[0].recordId,'first');
});
test('two separate successful zero-usage operations have different IDs and both stay in history',async()=>{
 const c=client(idleRemeasurement(),[
  jsonReply(200,{ok:true,replayed:false,recordId:'zero-1',staffId:'0137',lastWeight:250,ml:0}),
  jsonReply(200,{ok:true,replayed:false,recordId:'zero-2',staffId:'0137',lastWeight:250,ml:0}),
 ]);c.context.weightNow='250';await c.api.handleRecord();c.context.weightNow='250';await c.api.handleRecord();
 assert.equal(c.stats.ids,2);assert.notEqual(c.stats.posts[0].operationId,c.stats.posts[1].operationId);
 assert.equal(c.stats.posts[0].weightPrev,250);assert.equal(c.stats.posts[1].weightPrev,250);
 assert.equal(JSON.parse(c.stored.get('history')).length,2);assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);
});
test('A, changed remeasurement, B, retry to A and final confirm all share the initial ID',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(422,aResponse),jsonReply(422,bResponse),jsonReply(422,bResponse),
  jsonReply(200,{ok:true,replayed:false,recordId:'confirmed',staffId:'0137',lastWeight:154.08,ml:110})]);
 await c.api.handleRecord();const id=c.stats.posts[0].operationId;assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);
 c.context.weightNow='154.08';await c.api.handleRecord();assert.equal(c.context.remeasurementRef.current.phase,'confirmation_required');
 assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);c.api.handleRemeasureAgain();c.context.weightNow='154.08';
 await c.api.handleRecord();await c.api.handleRemeasureConfirm();
 assert.equal(c.stats.ids,1);assert.deepEqual(c.stats.posts.map(p=>p.operationId),[id,id,id,id]);
 assert.deepEqual(c.stats.posts.map(p=>p.operation),['normal','remeasure','remeasure','confirm_remeasurement']);
 assert.equal(c.lifecycle.current(),null);assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);
});
test('A followed by normal remeasurement saves with the original ID',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(422,aResponse),jsonReply(200,{ok:true,replayed:false,recordId:'normal-remeasure',staffId:'0137',lastWeight:230,ml:22.94})]);
 await c.api.handleRecord();c.context.weightNow='230';await c.api.handleRecord();
 assert.equal(c.stats.posts[0].operationId,c.stats.posts[1].operationId);assert.equal(c.stats.ids,1);assert.equal(c.lifecycle.current(),null);
});
test('ending remeasurement after an API response does not abandon the sent operation ID',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(422,aResponse),jsonReply(422,aResponse)]);
 await c.api.handleRecord();const id=c.lifecycle.current().operationId;c.api.handleRemeasureCancel();
 c.context.weightNow='162.8';await c.api.handleRecord();assert.equal(c.stats.posts[1].operationId,id);assert.equal(c.stats.ids,1);
});
test('exchange yes/no and re-render-equivalent state changes never regenerate ID',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(200,{ok:true,replayed:false,recordId:'exchange',staffId:'0137',lastWeight:255,ml:244.27})]);
 c.context.weightNow='255';await c.api.handleRecord();const id=c.lifecycle.current().operationId;
 assert.equal(c.stats.posts.length,0);assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);
 c.api.handleExchangeNo();assert.equal(c.lifecycle.current().operationId,id);
 await c.api.handleRecord();await c.api.handleExchangeYes();assert.equal(c.stats.ids,1);
 assert.equal(c.stats.posts[0].operationId,id);assert.equal(c.stats.posts[0].isBottleExchange,true);assert.equal(c.lifecycle.current(),null);
});
for(const failure of ['network','json','500','503-receipt','contradictory-success','contradictory-error'])test(`uncertain ${failure} retains only pending identifiers and forbids all further posts/IDs`,async()=>{
 const reply=failure==='json'?{ok:false,status:400,json:async()=>{throw Error('broken JSON');}}
  :failure==='500'?jsonReply(500,{error:'unknown'})
  :failure==='503-receipt'?jsonReply(503,{code:'OPERATION_RESULT_UNAVAILABLE',error:'unknown'})
  :failure==='contradictory-success'?jsonReply(200,{ok:true,replayed:false,recordId:'x',staffId:'0137',lastWeight:162.8,ml:100,status:'unknown'})
  :failure==='contradictory-error'?jsonReply(409,{ok:true,error:'conflict'})
  :jsonReply(200,{ok:true,replayed:false,recordId:'unused',staffId:'0137',lastWeight:162.8,ml:100});
 const c=client(idleRemeasurement(),[reply]);if(failure==='network')c.settings.network=true;
 await c.api.handleRecord();assert.equal(c.context.readyRef.current,false);assert.equal(c.lifecycle.isBlocked(),true);
 const pending=JSON.parse(c.session.get(PENDING_RECORD_OPERATION_KEY));
 assert.deepEqual(Object.keys(pending).sort(),['operationId','savedAt','staffId']);assert.equal(pending.operationId,c.stats.posts[0].operationId);
 assert.equal(c.context.weightNow,'162.8');assert.ok(c.stats.messages.includes(RECORD_RESULT_UNKNOWN_MESSAGE));
 assert.equal(c.stats.messages.some(m=>m.includes('再登録してください')),false);
 await c.api.handleRecord();await c.api.handleRemeasureConfirm();await c.api.saveRecord(100,162.8);
 assert.equal(c.stats.posts.length,1);assert.equal(c.stats.ids,1);
 for(const raw of c.session.values())for(const field of ['weightNow','weightPrev','lastWeight','challenge','secret','requestDigest','name','department'])assert.equal(raw.includes('"'+field+'"'),false);
});
for(const [status,body] of [[400,{error:'入力不正'}],[403,{error:'利用停止'}],[404,{error:'職員なし'}],
 [409,{error:'重量不一致'}],[409,{code:'OPERATION_ID_REUSED_WITH_DIFFERENT_REQUEST',error:'操作不一致'}],
 [422,{code:'WEIGHT_CHALLENGE_EXPIRED',error:'期限切れ'}],[426,{code:'APP_UPDATE_REQUIRED',error:'更新'}],
 [503,{code:'WEIGHT_HISTORY_LIMIT_REACHED',error:'履歴上限'}]])test(`explicit pre-save ${status} clears pending but does not generate a replacement ID`,async()=>{
 const c=client(idleRemeasurement(),[jsonReply(status,body)]);await c.api.handleRecord();
 assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);assert.equal(c.lifecycle.current().operationId,c.stats.posts[0].operationId);assert.equal(c.stats.ids,1);
 if(status===409){await c.api.handleRecord();assert.equal(c.stats.posts.length,1);}
});
test('pending write failure sends nothing and stops safely',async()=>{
 const c=client();c.settings.pendingFailure=true;await c.api.handleRecord();
 assert.equal(c.stats.posts.length,0);assert.equal(c.context.readyRef.current,false);assert.equal(c.lifecycle.isBlocked(),true);
 assert.ok(c.stats.messages.some(m=>m.includes('記録は送信していません')));
});
test('successful POST with pending cleanup failure is never resent or marked unsaved',async()=>{
 const c=client(idleRemeasurement(),[()=>{c.settings.clearPendingFailure=true;return jsonReply(200,{ok:true,replayed:false,recordId:'saved',staffId:'0137',lastWeight:162.8,ml:100});}]);
 await c.api.handleRecord();assert.equal(c.stats.posts.length,1);assert.equal(c.context.readyRef.current,false);
 assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),true);assert.ok(c.stats.messages.some(m=>m.includes('記録は保存されました')));
 await c.api.handleRecord();assert.equal(c.stats.posts.length,1);
});
test('replayed success clears pending without history duplication, weight rollback or a second celebration',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(200,{ok:true,replayed:true,recordId:'existing',staffId:'0137',lastWeight:162.8,ml:100})]);
 c.stored.set('history',JSON.stringify([{recordId:'existing',ml:100}]));const oldCurrent=c.stored.get('currentStaff');
 await c.api.handleRecord();assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);assert.equal(c.lifecycle.current(),null);
 assert.equal(c.stored.get('currentStaff'),oldCurrent);assert.equal(JSON.parse(c.stored.get('history')).length,1);assert.equal(c.stats.states.length,0);
 assert.equal(c.context.readyRef.current,false);assert.ok(c.stats.messages.some(m=>m.includes('既に記録されています')));assert.equal(c.stats.messages.some(m=>m.includes('記録しました：')),false);
});
test('recordId rather than matching weights prevents duplicate local history entries',async()=>{
 const c=client(idleRemeasurement(),[jsonReply(200,{ok:true,replayed:false,recordId:'existing',staffId:'0137',lastWeight:162.8,ml:100})]);
 c.stored.set('history',JSON.stringify([{recordId:'existing',ml:100}]));await c.api.handleRecord();assert.equal(JSON.parse(c.stored.get('history')).length,1);
});
test('app update during B parsing clears pending but never restores approval or resends',async()=>{
 const c=client(a(),[()=>{c.settings.required=true;c.context.resetRemeasurement();return jsonReply(422,bResponse);}]);
 c.context.weightNow='154.08';await c.api.handleRecord();assert.equal(c.session.has(PENDING_RECORD_OPERATION_KEY),false);
 assert.equal(c.context.remeasurementRef.current.phase,'idle');assert.equal(c.stats.posts.length,1);assert.equal(c.stats.ids,1);
});
test('actual startup blocks a reload with pending and never invokes draft consumption, lookup API or POST',async()=>{
 const startup=page.slice(page.indexOf(' useEffect(() => {\n  let cancelled'),page.indexOf('  useEffect(() => registerUpdatePreparation'));
 let cleanup,finish;const done=new Promise(r=>finish=r);const pending={staffId:'0137',operationId:'01234567-89ab-4cde-8fab-0123456789ab',savedAt:Date.now()};
 const raw=JSON.stringify(pending);const lifecycle=createRecordOperationLifecycle(()=>{throw Error('must not generate');});
 const messages=[],readyRef={current:false},uncertain={current:false};
 const {ensureNoPendingRecordOperation}=await import('../utils/recordOperationClient.js');
 vm.runInNewContext(startup,{
  useEffect:cb=>{cleanup=cb();},AbortController,setTimeout,clearTimeout,
  beginUpdateOperation:()=>finish,ensureNoPendingRecordOperation,operationLifecycleRef:{current:lifecycle},saveUncertainRef:uncertain,
  sessionStorage:{getItem:k=>{assert.equal(k,PENDING_RECORD_OPERATION_KEY);return raw;},removeItem:()=>assert.fail('cannot clear pending')},
  loadRecordContext:()=>assert.fail('must not consume draft or fetch staff'),setMessage:m=>messages.push(m),readyRef,
 });
 await done;assert.equal(readyRef.current,false);assert.equal(uncertain.current,true);assert.equal(lifecycle.isBlocked(),true);
 assert.equal(messages[0],RECORD_RESULT_UNKNOWN_MESSAGE);cleanup();
});
