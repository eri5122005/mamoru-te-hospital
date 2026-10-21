import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';
import { isActiveStaff } from '../utils/isActiveStaff.js';
import { ensureNoPendingRecordOperation, PENDING_RECORD_OPERATION_KEY } from '../utils/recordOperationClient.js';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;\n/gm,'').replace(/export /g,'');
const src=strip(read('utils/recordUpdateDraft.js'))+'\n'+strip(read('utils/loadRecordContext.js'));
const helpers=(clock)=>vm.runInNewContext(`${src}\n({readRecordDraft,saveRecordDraft,clearRecordDraft,currentRecordStaffId,loadRecordContext,RECORD_DRAFT_KEY,RECORD_DRAFT_TTL})`,{normalizeStaffId,isActiveStaff,...(clock?{Date:{now:clock}}:{})});
const h=helpers();const now=Date.now();
const draft=(changes={})=>({staffId:'0137',weightNow:'205',savedAt:now,...changes});
function storage(value=null){let raw=value;return {getItem:k=>{assert.equal(k,h.RECORD_DRAFT_KEY);return raw;},setItem:(k,v)=>{assert.equal(k,h.RECORD_DRAFT_KEY);raw=v;},removeItem:k=>{assert.equal(k,h.RECORD_DRAFT_KEY);raw=null;},raw:()=>raw};}
test('draft serializes exactly three fields, preserves ID zeros and only current weight',()=>{
 const s=storage();h.saveRecordDraft(s,' ０１３７ ','205',now);
 assert.deepEqual(JSON.parse(s.raw()),draft());assert.deepEqual(Object.keys(JSON.parse(s.raw())).sort(),['savedAt','staffId','weightNow']);
 assert.equal(h.readRecordDraft(s,'0137',now).weightNow,'205');
});
for(const age of [0,1,30*60*1000])test(`valid TTL age=${age}`,()=>{const s=storage(JSON.stringify(draft({savedAt:now-age})));assert.equal(h.readRecordDraft(s,'0137',now).weightNow,'205');});
const bad=[
 ['expired',draft({savedAt:now-30*60*1000-1})],['future',draft({savedAt:now+1})],['string time',draft({savedAt:String(now)})],
 ['NaN time',draft({savedAt:NaN})],['Infinity time',draft({savedAt:Infinity})],['zero time',draft({savedAt:0})],
 ['different staff',draft({staffId:'other'})],['array',[]],['null',null],['extra lastWeight',draft({lastWeight:252})],
 ...['',' ','NaN','Infinity','-Infinity','45','264','-1','20日'].map(v=>[`weight ${v}`,draft({weightNow:v})]),
 ...[null,205,[],[205],{}].map(v=>[`type ${JSON.stringify(v)}`,draft({weightNow:v})]),
];
for(const [name,value]of bad)test(`reject and remove ${name}`,()=>{const s=storage(JSON.stringify(value));assert.equal(h.readRecordDraft(s,'0137',now),null);assert.equal(s.raw(),null);});
test('broken JSON removed',()=>{const s=storage('{');assert.equal(h.readRecordDraft(s,'0137',now),null);assert.equal(s.raw(),null);});
for(const w of ['45.5','205.25','263'])test(`decimal/range compatibility ${w}`,()=>{const s=storage();h.saveRecordDraft(s,'0137',w,now);assert.equal(h.readRecordDraft(s,'0137',now).weightNow,w);});
test('invalid/empty current input removes old draft instead of preserving it',()=>{const s=storage(JSON.stringify(draft()));assert.equal(h.saveRecordDraft(s,'0137','',now),false);assert.equal(s.raw(),null);});
test('delete only matching staff or explicitly clear draft key, never all session data',()=>{const s=storage(JSON.stringify(draft()));h.clearRecordDraft(s,'9999');assert.notEqual(s.raw(),null);h.clearRecordDraft(s,'０１３７');assert.equal(s.raw(),null);});
function setup(options={}){
 const s=storage(JSON.stringify(draft()));let id='0137',fetches=0;
 const args={readCurrentId:()=>id,storage:s,checkVersion:async()=>({status:'current'}),fetchStaff:async()=>{fetches++;return {staffId:'0137',mode:'weight',lastWeight:252,isActive:true};},...options};
 return {s,args,setId:v=>{id=v;},fetches:()=>fetches};
}
test('restore 205 only, latest DB replaces cached previous weight; consumes draft without POST',async()=>{
 const x=setup();const result=await h.loadRecordContext(x.args);
 assert.equal(result.staff.lastWeight,252);assert.equal(result.weightNow,'205');assert.equal(x.s.raw(),null);assert.equal(x.fetches(),1);
 const local={getItem:k=>{assert.equal(k,'currentStaff');return JSON.stringify({staffId:'０１３７',lastWeight:10});}};
 assert.equal(h.currentRecordStaffId(local),'0137');
});
test('changed DB baseline is used instead of cached/draft weight',async()=>{
 const x=setup({fetchStaff:async()=>({staffId:'0137',mode:'weight',lastWeight:'240'})});const r=await h.loadRecordContext(x.args);assert.equal(r.staff.lastWeight,240);assert.equal(r.weightNow,'205');
});
test('DB failure has no local fallback and leaves draft unconsumed',async()=>{const x=setup({fetchStaff:async()=>{throw Error('offline');}});await assert.rejects(h.loadRecordContext(x.args),/offline/);assert.notEqual(x.s.raw(),null);});
for(const status of ['update-required','unavailable'])test(`startup ${status} blocks DB read/readiness`,async()=>{const x=setup({checkVersion:async()=>({status})});await assert.rejects(h.loadRecordContext(x.args));assert.equal(x.fetches(),0);});
for(const latest of [null,{staffId:'other',mode:'weight',lastWeight:252},{staffId:'0137',isActive:false,mode:'weight',lastWeight:252},{staffId:'0137',mode:'cm',lastWeight:252},...[null,[],[252],NaN,Infinity,44,264,'bad'].map(lastWeight=>({staffId:'0137',mode:'weight',lastWeight}))])test(`invalid latest staff ${JSON.stringify(latest)}`,async()=>{const x=setup({fetchStaff:async()=>latest});await assert.rejects(h.loadRecordContext(x.args));});
for(const active of [true,undefined,null])test(`latest active ${active} allowed`,async()=>{const x=setup({fetchStaff:async()=>({staffId:'0137',mode:'weight',lastWeight:252,isActive:active})});assert.equal((await h.loadRecordContext(x.args)).staff.lastWeight,252);});
test('identity changes while reading DB prevent restore',async()=>{const x=setup();x.args.fetchStaff=async()=>{x.setId('9999');return {staffId:'0137',mode:'weight',lastWeight:252};};await assert.rejects(h.loadRecordContext(x.args),/職員が変わりました/);});
test('unmounted startup cannot consume draft',async()=>{const x=setup({isCurrent:()=>false});await assert.rejects(h.loadRecordContext(x.args));assert.notEqual(x.s.raw(),null);});
for(const failure of ['get','remove'])test(`session ${failure} failure fails closed`,async()=>{const x=setup();x.args.storage={getItem:()=>{if(failure==='get')throw Error('storage');return JSON.stringify(draft());},removeItem:()=>{throw Error('storage');}};await assert.rejects(h.loadRecordContext(x.args),/一時入力/);});
test('update preparation saves before reload, never reloads on quota failure, blocks during operation',()=>{
 const state=strip(read('utils/appUpdateState.js'));
 const m=vm.runInNewContext(`${state}\n({requireAppUpdate,registerUpdatePreparation,reloadUpdatedApp,beginUpdateOperation})`);
 let reloads=0,saved=0;m.requireAppUpdate();m.registerUpdatePreparation(()=>{saved++;throw Error('quota');});
 assert.throws(()=>m.reloadUpdatedApp(()=>reloads++),/quota/);assert.equal(reloads,0);
 const end=m.beginUpdateOperation();assert.equal(m.reloadUpdatedApp(()=>reloads++),false);assert.equal(saved,1);end();
 const s=storage();m.registerUpdatePreparation(()=>h.saveRecordDraft(s,'0137','205',now));
 assert.equal(m.reloadUpdatedApp(()=>{assert.equal(JSON.parse(s.raw()).weightNow,'205');reloads++;}),true);assert.equal(reloads,1);
});
const page=read('pages/record/index.js');
test('record startup never sets cached staff and restored input never invokes record/exchange/POST',()=>{
 const start=page.slice(page.indexOf(' useEffect(() => {'),page.indexOf('  useEffect(() => registerUpdatePreparation'));
 assert.doesNotMatch(start,/setStaff\(local\)|local\.lastWeight|handleRecord\(|handleExchangeYes\(|setShowExchangeConfirm\(true\)|method: "POST"/);
 assert.match(start,/setStaff\(result.staff\)/);assert.match(start,/setWeightNow\(result.weightNow\)/);assert.match(start,/setReady\(true\)/);
 assert.match(page,/disabled=\{isSubmitting \|\| !ready\}/);assert.match(page,/if \(!staff \|\| !readyRef.current\) return/);
});
test('login arrival, login attempt and explicit logout clear only draft via helper',()=>{
 assert.match(read('pages/login/index.js'),/useEffect\(\(\) => \{\s*try \{ clearRecordDraft\(sessionStorage\)/);
 assert.match(read('components/LogoutButton.js'),/clearRecordDraft\(sessionStorage\)/);
 assert.doesNotMatch(read('utils/recordUpdateDraft.js'),/\.clear\(/);
});
const startup=page.slice(page.indexOf(' useEffect(() => {\n  let cancelled'),page.indexOf('  useEffect(() => registerUpdatePreparation'));
for(const fail of [false,true])test(`real screen startup waits for server, no cached baseline/no automatic POST, failure=${fail}`,async()=>{
 const s=storage(JSON.stringify(draft()));let complete,finish,cleanup;
 const done=new Promise(r=>finish=r);const remote=new Promise((r,j)=>{complete=fail?()=>j(Error('offline')):()=>r({staffId:'0137',mode:'weight',lastWeight:240});});
 const readyRef={current:false},idRef={current:''},states=[],weights=[],messages=[];let operations=0;
 const local={getItem:()=>JSON.stringify({staffId:'０１３７',lastWeight:252})};
 vm.runInNewContext(startup,{
   useEffect:cb=>{cleanup=cb();},AbortController,setTimeout,clearTimeout,
   beginUpdateOperation:()=>{operations++;let ended=false;return()=>{if(!ended){ended=true;operations--;finish();}};},
   currentRecordStaffId:h.currentRecordStaffId,loadRecordContext:h.loadRecordContext,localStorage:local,
   ensureNoPendingRecordOperation, pendingRecoveryRef:{current:async()=>({status:"none"})},
   sessionStorage:{getItem:k=>k===PENDING_RECORD_OPERATION_KEY||k.startsWith('mamoru-te:pending-record-operation:v2:')?null:s.getItem(k),setItem:(k,v)=>s.setItem(k,v),removeItem:k=>s.removeItem(k)},
   checkAppVersion:async()=>({status:'current'}),requestStaffWeightSettings:(url,opts)=>{assert.match(url,/staffId=0137/);assert.equal(opts.cache,'no-store');assert.equal(opts.method,undefined);return remote;},
   getAppUpdateState:()=>({required:false}),requireAppUpdate:()=>assert.fail(),
   currentIdRef:idRef,readyRef,setStaff:v=>states.push(v),setWeightNow:v=>weights.push(v),setDraftNotice:()=>{},setReady:v=>{readyRef.current=v;},setMessage:v=>messages.push(v),
   fetch:()=>assert.fail('no POST'),setShowExchangeConfirm:()=>assert.fail('no exchange confirmation'),
 });
 await new Promise(r=>setImmediate(r));assert.equal(readyRef.current,false);assert.equal(states.length,0);assert.equal(operations,1);
 complete();await done;
 assert.equal(readyRef.current,!fail);assert.equal(operations,0);
 if(fail){assert.equal(states.length,0);assert.equal(weights.length,0);assert.match(messages[0],/offline/);}
 else{assert.equal(states[0].lastWeight,240);assert.equal(weights[0],'205');assert.equal(s.raw(),null);}
 cleanup();
});
test('record and exchange handlers cannot start before initialization is ready',async()=>{
 const start=page.slice(page.indexOf('const handleRecord ='),page.indexOf('  if (!staff) {',page.indexOf('const handleRecord =')));
 await vm.runInNewContext(`${start}\nhandleRecord()`,{staff:{lastWeight:252},readyRef:{current:false}});
 const yes=page.slice(page.indexOf('const handleExchangeYes ='),page.indexOf('// ★ ボトル交換 NO'));
 await vm.runInNewContext(`${yes}\nhandleExchangeYes()`,{exchangeLockRef:{current:false},isSubmitting:true,readyRef:{current:false}});
});
test('update preparation refuses uncertain result and never persists it',()=>{
 const start=page.indexOf('  useEffect(() => registerUpdatePreparation');
 const end=page.indexOf('\n\n  useEffect(() => {',start);
 let prepare;
 vm.runInNewContext(page.slice(start,end),{
   useEffect:cb=>cb(),registerUpdatePreparation:fn=>{prepare=fn;},weightNow:'205',
   saveUncertainRef:{current:true},cleanupFailedRef:{current:false},
   saveRecordDraft:()=>assert.fail('must not persist uncertain input'),
 });
 assert.throws(()=>prepare(),/再登録・更新せず/);
});

for(const ageAtRestore of [30*60*1000,30*60*1000+1])test(`recheck after DB read: age ${ageAtRestore}ms at restore`,async()=>{
 let clock=now;const timed=helpers(()=>clock);
 const s=storage(JSON.stringify(draft({savedAt:now-(30*60*1000-1)})));
 let reads=0;const original=s.getItem;s.getItem=k=>{reads++;return original(k);};
 const r=await timed.loadRecordContext({readCurrentId:()=> '0137',storage:s,checkVersion:async()=>({status:'current'}),fetchStaff:async()=>{
  clock=now+ageAtRestore-(30*60*1000-1);return {staffId:'0137',mode:'weight',lastWeight:240};
 }});
 assert.equal(r.staff.lastWeight,240);assert.equal(r.weightNow,ageAtRestore===30*60*1000?'205':'');
 assert.ok(reads>=2);assert.equal(s.raw(),null);
});
test('draft changed to invalid during DB read is removed rather than restored',async()=>{
 const x=setup();x.args.fetchStaff=async()=>{x.s.setItem(h.RECORD_DRAFT_KEY,JSON.stringify(draft({weightNow:'Infinity'})));return {staffId:'0137',mode:'weight',lastWeight:252};};
 const r=await h.loadRecordContext(x.args);assert.equal(r.weightNow,'');assert.equal(x.s.raw(),null);
});
test('update double-click saves and reloads once; preparation failure can be retried',()=>{
 const source=strip(read('utils/appUpdateState.js'));
 const m=vm.runInNewContext(`${source}\n({getAppUpdateState,requireAppUpdate,registerUpdatePreparation,reloadUpdatedApp})`);
 let saves=0,reloads=0,fail=true;m.requireAppUpdate();
 m.registerUpdatePreparation(()=>{saves++;if(fail)throw Error('quota');});
 assert.throws(()=>m.reloadUpdatedApp(()=>reloads++),/quota/);assert.equal(reloads,0);assert.equal(m.getAppUpdateState().reloading,false);
 fail=false;saves=0;
 assert.equal(m.reloadUpdatedApp(()=>reloads++),true);
 assert.equal(m.reloadUpdatedApp(()=>reloads++),false);
 assert.equal(m.reloadUpdatedApp(()=>reloads++),false);
 assert.equal(saves,1);assert.equal(reloads,1);assert.equal(m.getAppUpdateState().reloading,true);
});
test('initialization error offers only login recovery, never cached-weight continuation',()=>{
 const fallback=page.slice(page.indexOf('  if (!staff) {'),page.indexOf('  return (',page.indexOf('  if (!staff) {')+30));
 assert.match(page,/message && <button type="button" onClick=\{\(\) => router.push\("\/login"\)\}>ログイン画面へ戻る/);
 assert.doesNotMatch(fallback,/setStaff|handleRecord|saveRecord/);
});
test('staff ID is checked again immediately before final draft validation',async()=>{
 const x=setup({isCurrent:()=>{x.setId('9999');return true;}});
 await assert.rejects(h.loadRecordContext(x.args),/職員が変わりました/);
 assert.notEqual(x.s.raw(),null);
});
