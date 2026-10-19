import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const versionSource = read('utils/checkAppVersion.js').replace(/^import .*;\n/gm, '').replace(/export /g, '');
function helpers(own = 'build') {
  return vm.runInNewContext(`${versionSource}\n({checkAppVersion, monitorAppVersion})`, {getAppBuildId:()=>own, AbortController, setTimeout, clearTimeout});
}
const json = appBuildId => ({ok:true,json:async()=>({appBuildId})});
for (const [id, expected] of [['build','current'],['other','update-required']]) test(`version ${expected}`, async () => {
  const r = await helpers().checkAppVersion({fetcher:async(url,options)=>{
    assert.equal(url,'/api/app-version'); assert.equal(options.cache,'no-store'); return json(id);
  }});
  assert.equal(r.status,expected);
});
for (const [name, fetcher, reason] of [
  ['503',async()=>({ok:false,status:503}),'server-unavailable'],
  ['http',async()=>({ok:false,status:500}),'http'],
  ['network',async()=>{throw Error();},'network'],
  ['json',async()=>({ok:true,json:async()=>{throw Error();}}),'invalid-json'],
  ['missing',async()=>json(undefined),'missing-id'],
  ['array',async()=>json(['build']),'invalid-id'],
]) test(`version unavailable: ${name}`,async()=>{
  const r=await helpers().checkAppVersion({fetcher}); assert.equal(r.status,'unavailable'); assert.equal(r.reason,reason);
});
for(const phase of ['fetch','body']) test(`timeout covers ${phase}`,async()=>{
  const r=await helpers().checkAppVersion({timeoutMs:5,fetcher:phase==='fetch'?()=>new Promise(()=>{}):async()=>({ok:true,json:()=>new Promise(()=>{})})});
  assert.equal(r.reason,'timeout');
});
test('missing client ID never fetches',async()=>{
  const r=await helpers(null).checkAppVersion({fetcher:()=>assert.fail()}); assert.equal(r.reason,'client-id');
});
function target() {
  const events=new Map(); return {events,addEventListener:(k,v)=>events.set(k,v),removeEventListener:(k,v)=>{assert.equal(events.get(k),v);events.delete(k);}};
}
test('monitor: startup, pageshow, visible, online and five-minute timer without Worker',async()=>{
  const win=target(),doc={...target(),visibilityState:'visible'}; let tick, calls=0, results=0;
  win.setInterval=(fn,ms)=>{assert.equal(ms,300000);tick=fn;return 1;}; win.clearInterval=id=>assert.equal(id,1);
  const stop=helpers().monitorAppVersion({window:win,document:doc,check:async()=>{calls++;return {status:'current'};},onResult:()=>results++});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  await flush(); assert.equal(calls,1);
  for(const event of ['pageshow','online']) {await win.events.get(event)();await flush();}
  doc.events.get('visibilitychange')(); await flush();
  tick(); await flush(); assert.equal(calls,5); assert.equal(results,5);
  doc.visibilityState='hidden';tick();doc.events.get('visibilitychange')();assert.equal(calls,5);
  stop(); assert.equal(win.events.size,0);assert.equal(doc.events.size,0);
});
test('background duplicate checks coalesce and stopped result is ignored',async()=>{
  const win=target(),doc={...target(),visibilityState:'visible'};win.setInterval=()=>1;win.clearInterval=()=>{};
  let finish,calls=0,results=0;
  const stop=helpers().monitorAppVersion({window:win,document:doc,check:()=>{calls++;return new Promise(r=>finish=r);},onResult:()=>results++});
  win.events.get('pageshow')();win.events.get('online')();assert.equal(calls,1);
  stop();finish({status:'update-required'});await Promise.resolve();assert.equal(results,0);
});
function store() {
  const src=read('utils/appUpdateState.js').replace(/export /g,'');
  return vm.runInNewContext(`${src}\n({getAppUpdateState,requireAppUpdate,beginUpdateOperation,reloadUpdatedApp,setUpdateInput})`);
}
test('update is persistent; only explicit update action reloads, operations block it synchronously',()=>{
  const s=store();let reloads=0;
  assert.equal(s.reloadUpdatedApp(()=>reloads++),false);
  const end1=s.beginUpdateOperation(),end2=s.beginUpdateOperation();s.requireAppUpdate();s.setUpdateInput(true);
  assert.equal(s.getAppUpdateState().required,true);assert.equal(reloads,0);
  assert.equal(s.reloadUpdatedApp(()=>reloads++),false);end1();end1();assert.equal(s.getAppUpdateState().operations,1);
  end2();assert.equal(s.getAppUpdateState().operations,0);assert.equal(s.reloadUpdatedApp(()=>reloads++),true);assert.equal(reloads,1);
});
const page=read('pages/record/index.js');
const ensure=page.slice(page.indexOf('  const ensureCurrentVersion ='),page.indexOf('  // ★ 記録保存共通処理'));
for(const status of ['current','update-required','unavailable']) test(`record preflight: ${status}`,async()=>{
  let required=false,checks=0;const messages=[];
  const allowed=await vm.runInNewContext(`${ensure}\nensureCurrentVersion()`,{
    getAppUpdateState:()=>({required}),checkAppVersion:async()=>{checks++;return {status};},
    requireAppUpdate:()=>{required=true;},setMessage:v=>messages.push(v),setMessageType() {},
  });
  assert.equal(allowed,status==='current');assert.equal(checks,1);assert.equal(required,status==='update-required');
  if(status==='unavailable')assert.match(messages[0],/最新版を確認できません/);
});
test('known update blocks preflight without overwriting build ID',async()=>{
  const allowed=await vm.runInNewContext(`${ensure}\nensureCurrentVersion()`,{getAppUpdateState:()=>({required:true}),checkAppVersion:()=>assert.fail()});
  assert.equal(allowed,false);
});
for(const status of ['update-required','unavailable']) test(`record start ${status} does not calculate or save`,async()=>{
  const start=page.slice(page.indexOf('const handleRecord ='),page.indexOf('  if (!staff) {',page.indexOf('const handleRecord =')));
  let unlocked=0;
  await vm.runInNewContext(`${start}\nhandleRecord()`,{
    staff:{lastWeight:200},recordLockRef:{current:false},isSubmitting:false,setIsSubmitting(){},
    beginUpdateOperation:()=>()=>{unlocked++;},ensureCurrentVersion:async()=>false,clearMessageTimer(){},
    confirm:()=>assert.fail('must not reach confirmation'),saveRecord:()=>assert.fail('must not POST'),
  });assert.equal(unlocked,1);
});
test('UI updates only on click, no expiry; controllerchange only notifies',()=>{
  const app=read('pages/_app.js'),notice=read('components/AppUpdateNotice.js');
  assert.doesNotMatch(app,/location\.reload|refreshing/);assert.match(app,/handleControllerChange = \(\) => requireAppUpdate/);
  assert.match(notice,/onClick=\{\(\) => reloadUpdatedApp/);assert.match(notice,/disabled=\{state.operations > 0\}/);
  assert.doesNotMatch(notice,/setTimeout|sessionStorage/);assert.match(notice,/入力した重量を確認してから/);
  assert.match(page,/if \(!await ensureCurrentVersion\(\) \|\| getAppUpdateState\(\).required\) return false/);
  assert.match(page,/response.status === 426 && body\?\.code === "APP_UPDATE_REQUIRED"/);
});
for(const action of ['handleRecord','handleExchangeYes']) test(`version change before final POST blocks actual ${action} path`,async()=>{
  const block=page.slice(page.indexOf('  const saveRecord = async'),page.indexOf('  if (!staff) {',page.indexOf('const handleRecord =')));
  let checks=0, operations=0;
  const context={
    staff:{lastWeight:action==='handleRecord'?200:100},weightNow:'190',
    isSubmitting:action==='handleExchangeYes',recordLockRef:{current:false},exchangeLockRef:{current:false},
    EMPTY_WEIGHT:45,FULL_WEIGHT:263,ML_PER_GRAM:250/218,
    beginUpdateOperation:()=>{operations++;return ()=>operations--;},
    ensureCurrentVersion:async()=>{checks++;return action==='handleRecord'&&checks===1;},
    clearMessageTimer(){},setMessage(){},setMessageType(){},setIsSubmitting(){},setIsExchangeProcessing(){},setShowExchangeConfirm(){},
    confirm:()=>true,fetch:()=>assert.fail('no POST'),setWeightNow:()=>assert.fail('input must remain'),
    weightUpdateWarning:'warning',
  };
  await vm.runInNewContext(`${block}\n${action}()`,context);
  assert.equal(checks,action==='handleRecord'?2:1);assert.equal(operations,0);
});
