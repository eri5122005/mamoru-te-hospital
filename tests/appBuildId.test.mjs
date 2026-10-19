import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { getAppBuildId } from '../utils/getAppBuildId.js';
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = s => s.replace(/import[\s\S]*?from\s+["'][^"']+["'];\s*/g, '').replace('export default ', '');
const api = strip(read('pages/api/records.js'));
const version = strip(read('pages/api/app-version.js'));
const response = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(c) { this.code=c; return this; }, json(b) { this.body=b; return this; } });
for (const value of [undefined, '', 'other', [], ['build'], {}, 'build ', 123]) {
  test(`reject invalid or missing client version: ${JSON.stringify(value)}`, async () => {
    const res = response(); let touches=0;
    await vm.runInNewContext(`${api}\nhandler(req,res)`, {
      req: { method:'POST', headers:{'x-app-build-id':value}, body:{} }, res,
      getAppBuildId: () => 'build', normalizeStaffId() { touches++; },
      runTransaction() { touches++; }, doc() { touches++; },
    });
    assert.equal(res.code,426); assert.equal(res.body.code,'APP_UPDATE_REQUIRED'); assert.equal(touches,0);
  });
}
test('matching version reaches existing request validation', async () => {
  const res=response();
  await vm.runInNewContext(`${api}\nhandler(req,res)`, {req:{method:'POST',headers:{'x-app-build-id':'build'},body:{}},res,getAppBuildId:()=> 'build'});
  assert.equal(res.code,400); assert.match(res.body.error,/職員番号/);
});
test('unavailable server version fails closed before Firestore', async () => {
  const res=response();
  await vm.runInNewContext(`${api}\nhandler(req,res)`, {req:{method:'POST'},res,getAppBuildId:()=>null});
  assert.equal(res.code,503);
});
for(const method of ['GET','POST','PUT','DELETE','PATCH','OPTIONS']) test(`app-version ${method}`, () => {
  const res=response(); vm.runInNewContext(`${version}\nhandler(req,res)`,{req:{method},res,getAppBuildId:()=> 'build'});
  assert.equal(res.headers['Cache-Control'],'no-store'); assert.equal(res.code,method==='GET'?200:405);
  if(method==='GET') assert.equal(res.body.appBuildId,'build');
});
test('app-version unavailable returns 503, has no Firebase dependency', () => {
  const res=response(); vm.runInNewContext(`${version}\nhandler(req,res)`,{req:{method:'GET'},res,getAppBuildId:()=> null});
  assert.equal(res.code,503); assert.doesNotMatch(read('pages/api/app-version.js'),/firebase|Firestore/);
});
test('build config shares generated ID, distinguishes separate builds', () => {
  const script = `const c=require('./next.config.js'); Promise.resolve(c.generateBuildId()).then(id=>console.log(JSON.stringify({id,client:c.env.NEXT_PUBLIC_APP_BUILD_ID})))`;
  const env={...process.env}; delete env.MAMORU_APP_BUILD_ID;
  const run=()=>JSON.parse(execFileSync(process.execPath,['-e',script],{cwd:new URL('..',import.meta.url),env,encoding:'utf8'}));
  const a=run(),b=run(); assert.equal(a.id,a.client); assert.notEqual(a.id,b.id);
});
test('helper fails closed and client sends its embedded ID without fetching a new ID', () => {
  const old=process.env.NEXT_PUBLIC_APP_BUILD_ID;
  try { process.env.NEXT_PUBLIC_APP_BUILD_ID='build'; assert.equal(getAppBuildId(),'build'); process.env.NEXT_PUBLIC_APP_BUILD_ID=''; assert.equal(getAppBuildId(),null); }
  finally { if(old===undefined) delete process.env.NEXT_PUBLIC_APP_BUILD_ID; else process.env.NEXT_PUBLIC_APP_BUILD_ID=old; }
  const page=read('pages/record/index.js'); assert.match(page,/"X-App-Build-Id": getAppBuildId\(\)/); assert.doesNotMatch(page,/api\/app-version/);
});
test('legacy pre-4A page can update weight before its headerless POST is rejected', async () => {
  const legacy=execFileSync('git',['show','ddb9008^:pages/record/index.js'],{encoding:'utf8'});
  const record=legacy.slice(legacy.indexOf('const handleRecord ='));
  assert.ok(record.indexOf('await updateDoc') < record.indexOf('await saveRecord'));
  assert.doesNotMatch(legacy,/X-App-Build-Id/);
  // The API cannot roll back a preceding, independent browser write.
  const staff={lastWeight:205}, records=[]; const res=response();
  await vm.runInNewContext(`${api}\nhandler(req,res)`,{req:{method:'POST',headers:{},body:{weightPrev:252,weightNow:205}},res,getAppBuildId:()=> 'build'});
  assert.equal(res.code,426); assert.equal(staff.lastWeight,205); assert.equal(records.length,0);
});
