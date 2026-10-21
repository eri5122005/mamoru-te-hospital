import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pendingRecordOperationKey as key,PENDING_RECORD_OPERATION_KEY as V1,migratePendingRecordOperation as migrate,readPendingRecordOperation as read,savePendingRecordOperation as save,clearPendingRecordOperation as clear,ensureNoPendingRecordOperation as guard} from '../utils/recordOperationClient.js';
import {createPendingRecordRecovery} from '../utils/recoverPendingRecordOperation.js';
import {clearLoginIdentity} from '../utils/clearLoginIdentity.js';
import {normalizeStaffId} from '../utils/normalizeStaffId.js';
import {isActiveStaff} from '../utils/isActiveStaff.js';
const id='01234567-89ab-4cde-8fab-0123456789ab', other='01234567-89ab-4cde-9fab-0123456789ab';
const p=(staffId='0137',operationId=id)=>({staffId,operationId,savedAt:1});
const raw=x=>JSON.stringify(x);
function storage(entries={}){const data=new Map(Object.entries(entries)),events=[];return{data,events,getItem(k){events.push(['get',k]);return data.get(k)??null;},setItem(k,v){events.push(['set',k]);data.set(k,v);},removeItem(k){events.push(['remove',k]);data.delete(k);}};}
test('v2 key normalizes full-width, trims, keeps zeros and encodes reserved characters',()=>{
 assert.equal(key(' ０１３７ '),'mamoru-te:pending-record-operation:v2:0137');assert.notEqual(key('0137'),key('0245'));
 assert.equal(key('test:a?b#c'),'mamoru-te:pending-record-operation:v2:test%3Aa%3Fb%23c');
 for(const bad of ['',null,123,{},'a/b','..','\u0000'])assert.throws(()=>key(bad));
});
test('A save/read/clear never touches B v2; values contain only three fields',()=>{
 const s=storage({[key('0245')]:raw(p('0245',other)),draft:'unchanged'}),before=s.getItem(key('0245'));s.events.length=0;
 save(s,'0137',id,1);assert.deepEqual(Object.keys(JSON.parse(s.getItem(key('0137')))).sort(),['operationId','savedAt','staffId']);
 assert.deepEqual(read(s,'０１３７'),p());clear(s,'0137',id);assert.equal(s.getItem('draft'),'unchanged');
 assert.equal(s.data.get(key('0245')),before);assert.equal(s.events.some(e=>e[1]===key('0245')),false);
});
for(const operationId of [id,other])test(`existing own pending cannot be overwritten ${operationId===id?'same':'different'} ID`,()=>{
 const s=storage({[key('0137')]:raw(p())});assert.throws(()=>save(s,'0137',operationId));assert.deepEqual(read(s,'0137'),p());assert.throws(()=>guard(s,'0137'));
});
test('other staff pending does not block current staff',()=>{const s=storage({[key('0137')]:raw(p())});guard(s,'0245');assert.equal(read(s,'0245'),null);assert.deepEqual(read(s,'0137'),p());});
test('v1 migration saves then verifies v2, rereads v1 then removes and verifies v1',()=>{
 const s=storage({[V1]:raw(p())});migrate(s);assert.equal(s.data.has(V1),false);assert.equal(s.data.get(key('0137')),raw(p()));
 assert.deepEqual(s.events,[['get',V1],['get',key('0137')],['set',key('0137')],['get',key('0137')],['get',V1],['remove',V1],['get',V1]]);
});
test('B migration stores A evidence without querying A result',async()=>{
 const s=storage({[V1]:raw(p())});const r=await createPendingRecordRecovery()({storage:s,staffId:'0245',fetchImpl:()=>assert.fail('must not query A')});assert.equal(r.status,'none');assert.deepEqual(read(s,'0137'),p());
});
test('crash after v2 write leaves evidence; identical v1/v2 safely resume',()=>{
 const s=storage({[V1]:raw(p())});const get=s.getItem.bind(s);let crashed=false;s.getItem=k=>{if(k===key('0137')&&s.data.has(k)&&!crashed){crashed=true;throw Error('crash');}return get(k);};
 assert.throws(()=>migrate(s));assert.equal(s.data.get(V1),raw(p()));assert.equal(s.data.get(key('0137')),raw(p()));migrate(s);assert.equal(s.data.has(V1),false);assert.deepEqual(read(s,'0137'),p());
});
for(const change of [{operationId:other},{savedAt:2},{staffId:'0245'}])test(`migration conflict preserves both ${Object.keys(change)[0]}`,()=>{
 const old=raw(p()),dest=raw({...p(),...change}),s=storage({[V1]:old,[key('0137')]:dest});assert.throws(()=>migrate(s));assert.equal(s.data.get(V1),old);assert.equal(s.data.get(key('0137')),dest);assert.throws(()=>guard(s,'0245'));
});
for(const invalid of ['broken','null','[]',raw({...p(),staffId:'０１３７'}),raw({...p(),operationId:'bad'}),raw({...p(),savedAt:0}),raw({...p(),challenge:'x'})])test(`malformed v1 is globally retained and never sent: ${invalid.slice(0,20)}`,async()=>{
 const s=storage({[V1]:invalid});assert.throws(()=>migrate(s));assert.throws(()=>guard(s,'0245'));assert.equal((await createPendingRecordRecovery()({storage:s,staffId:'0245',fetchImpl:()=>assert.fail()})).status,'malformed');assert.deepEqual([...s.data],[[V1,invalid]]);
});
for(const mode of ['write-throw','write-silent','readback','legacy-change','remove-throw','remove-silent'])test(`migration ${mode} fails closed and retains at least original evidence`,()=>{
 const s=storage({[V1]:raw(p())});const get=s.getItem.bind(s);let v1Reads=0;
 if(mode.startsWith('write'))s.setItem=()=>{if(mode==='write-throw')throw Error('quota');};
 if(mode==='readback')s.getItem=k=>k===key('0137')&&s.data.has(k)?null:get(k);
 if(mode==='legacy-change')s.getItem=k=>{if(k===V1&&++v1Reads===2)s.data.set(V1,raw(p('0245',other)));return get(k);};
 if(mode.startsWith('remove'))s.removeItem=()=>{if(mode==='remove-throw')throw Error('remove');};
 assert.throws(()=>migrate(s));assert.equal(s.data.has(V1),true);
});
for(const status of ['succeeded','unknown','failed'])test(`own recovery ${status} never clears another staff`,async()=>{
 const s=storage({[key('0137')]:raw(p()),[key('0245')]:raw(p('0245',other)),draft:'keep'});let calls=0;
 const r=await createPendingRecordRecovery()({storage:s,staffId:'0245',fetchImpl:async(url,opts)=>{
  calls++;assert.equal(opts.method,'GET');const q=new URL(url,'https://fixture').searchParams;assert.equal(q.get('staffId'),'0245');assert.equal(q.get('operationId'),other);
  if(status==='failed')throw Error('network');return{ok:true,status:200,json:async()=>status==='unknown'?{ok:false,status:'unknown',message:'unknown'}:{ok:true,status:'succeeded',operationId:other,staffId:'0245',recordId:'r',lastWeight:190,ml:11.47}};
 }});assert.equal(r.status,status);assert.equal(calls,1);assert.equal(s.data.get(key('0137')),raw(p()));assert.equal(s.data.has(key('0245')),status!=='succeeded');assert.equal(s.data.get('draft'),'keep');assert.equal('lastWeight' in r,false);
});
test('v2 key/value owner mismatch is retained and never queried',async()=>{const s=storage({[key('0245')]:raw(p())});assert.equal((await createPendingRecordRecovery()({storage:s,staffId:'0245',fetchImpl:()=>assert.fail()})).status,'malformed');assert.equal(s.data.get(key('0245')),raw(p()));});
const page=readFileSync(new URL('../pages/login/index.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const handler=page.slice(page.indexOf('  const handleLogin = async () => {'),page.indexOf('\n  return ('));
const arrival=page.slice(page.indexOf('  useEffect(() => {'),page.indexOf('  // ★ ログイン画面を開いた瞬間'));
const logout=readFileSync(new URL('../components/LogoutButton.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const click=logout.slice(logout.indexOf('onClick={() => {')+'onClick={() => {'.length,logout.indexOf('\n      }}'));
function loginContext(local,session,data={mode:'weight',lastWeight:200,emptyWeight:45}){
 const routes=[],errors=[];return{routes,errors,context:{localStorage:local,sessionStorage:session,clearLoginIdentity,
 clearRecordDraft:s=>s.removeItem('draft'),setLoginError:m=>errors.push(m),loginActiveRef:{current:true},loginBusyRef:{current:false},
 normalizeStaffId,isActiveStaff,staffId:'0245',db:{},doc:()=> 'staff-fixture',getDoc:async()=>({exists:()=>data!==null,data:()=>data}),
 router:{replace:p=>routes.push(p),push:p=>routes.push(p)},alert:m=>errors.push(m),console:{error(){}},
 }};
}
for(const trainingMode of ['on','off',undefined])test(`/login arrival clears identity independent of trainingMode ${trainingMode} and preserves all pending`,()=>{
 const local=storage({currentStaff:raw({staffId:'0137'}),loginUser:'old',...(trainingMode?{trainingMode}:{})});
 const session=storage({[V1]:raw(p()),[key('0245')]:raw(p('0245',other)),draft:'old'});const before=[...session.data].filter(([k])=>k!=='draft');const c=loginContext(local,session);let cleanup;
 vm.runInNewContext(arrival,{...c.context,useEffect:cb=>cleanup=cb()});assert.equal(local.data.has('currentStaff'),false);assert.equal(local.data.has('loginUser'),false);assert.equal(local.data.get('trainingMode'),trainingMode);assert.deepEqual([...session.data],before);cleanup();assert.equal(c.context.loginActiveRef.current,false);
});
test('actual explicit logout clears only identity/draft without network or migration',()=>{
 const local=storage({currentStaff:'A',loginUser:'old',unrelated:'keep'}),session=storage({[V1]:raw(p()),[key('0137')]:raw(p()),[key('0245')]:raw(p('0245',other)),draft:'old'});const c=loginContext(local,session);vm.runInNewContext('(()=>{'+click+'\n})()',c.context);
 assert.equal(local.data.has('currentStaff'),false);assert.equal(local.data.has('loginUser'),false);assert.equal(local.data.get('unrelated'),'keep');assert.equal(session.data.size,3);assert.deepEqual(c.routes,['/login']);
});
for(const failure of ['invalid','missing','retired','network'])test(`failed login ${failure} never revives prior staff`,async()=>{
 const local=storage({currentStaff:raw({staffId:'0137'}),loginUser:'A'}),session=storage({[key('0137')]:raw(p())});const c=loginContext(local,session,failure==='missing'?null:failure==='retired'?{isActive:false}:{});
 if(failure==='invalid')c.context.staffId='   ';if(failure==='network')c.context.getDoc=async()=>{throw Error('offline');};
 await vm.runInNewContext(handler+'\nhandleLogin()',c.context);assert.equal(local.data.has('currentStaff'),false);assert.equal(local.data.has('loginUser'),false);assert.equal(session.data.get(key('0137')),raw(p()));
});
test('A logout -> B login/record readiness -> B logout -> A login/recovery preserves ownership',async()=>{
 const local=storage({currentStaff:raw({staffId:'0137'})}),session=storage({[key('0137')]:raw(p())});
 let c=loginContext(local,session);vm.runInNewContext('(()=>{'+click+'\n})()',c.context);await vm.runInNewContext(handler+'\nhandleLogin()',c.context);assert.equal(JSON.parse(local.data.get('currentStaff')).staffId,'0245');
 guard(session,'0245');save(session,'0245',other,1);clear(session,'0245',other);assert.equal(session.data.get(key('0137')),raw(p()));vm.runInNewContext('(()=>{'+click+'\n})()',c.context);
 c=loginContext(local,session);c.context.staffId='０１３７';await vm.runInNewContext(handler+'\nhandleLogin()',c.context);assert.equal(JSON.parse(local.data.get('currentStaff')).staffId,'0137');
 const r=await createPendingRecordRecovery()({storage:session,staffId:'0137',fetchImpl:async(url)=>{assert.match(url,/staffId=0137/);return{ok:true,status:200,json:async()=>({ok:false,status:'unknown',message:'unknown'})};}});assert.equal(r.status,'unknown');assert.equal(session.data.get(key('0137')),raw(p()));guard(session,'0245');
});
for(const mode of ['throw','silent'])test(`identity cleanup ${mode} failure is not successful logout/login`,async()=>{
 const local=storage({currentStaff:'A',loginUser:'A'});local.removeItem=k=>{if(k==='currentStaff'){if(mode==='throw')throw Error('storage');return;}local.data.delete(k);};
 assert.throws(()=>clearLoginIdentity(local));assert.equal(local.data.has('loginUser'),false);
 const c=loginContext(local,storage());vm.runInNewContext('(()=>{'+click+'\n})()',c.context);assert.deepEqual(c.routes,[]);await vm.runInNewContext(handler+'\nhandleLogin()',c.context);assert.deepEqual(c.routes,[]);assert.ok(c.errors.length);
});
test('late login result after leaving cannot overwrite next staff identity',async()=>{
 const local=storage({currentStaff:'old'}),c=loginContext(local,storage());let release;const gate=new Promise(r=>release=r);c.context.getDoc=()=>gate;
 const request=vm.runInNewContext(handler+'\nhandleLogin()',c.context);c.context.loginActiveRef.current=false;local.data.set('currentStaff',raw({staffId:'next'}));release({exists:()=>true,data:()=>({})});await request;assert.equal(JSON.parse(local.data.get('currentStaff')).staffId,'next');assert.deepEqual(c.routes,[]);
});
test('login synchronous lock prevents competing attempts before await',async()=>{
 const c=loginContext(storage(),storage());let release,calls=0;const gate=new Promise(r=>release=r);c.context.getDoc=()=>{calls++;return gate;};const context=vm.createContext(c.context);vm.runInContext(handler,context);
 const a=vm.runInContext('handleLogin()',context),b=vm.runInContext('handleLogin()',context);assert.equal(calls,1);release({exists:()=>true,data:()=>({mode:'weight',lastWeight:200,emptyWeight:45})});await Promise.all([a,b]);assert.equal(c.routes.length,1);
});
