import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp,privateIP,safeName,CHUNK,MAX} from '../server.mjs';
import {SHA256} from '../public/sha256.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function setup(t){
 const base=await mkdtemp(path.join(tmpdir(),'hb-transfer-'));let now=Date.now();const app=await createApp({port:0,base,clock:()=>now});
 t.after(async()=>{await app.close();await rm(base,{recursive:true,force:true});});const url=`http://${app.host}:${app.port}`;
 const call=(key,p,method='GET',data,headers={})=>fetch(url+'/api/'+p,{method,body:data,headers:{Authorization:'Bearer '+key,...headers}});
 async function pair(name){const r=await call('','pair','POST',JSON.stringify({key:app.token,name}));assert.equal(r.status,201);return {...await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]};}
 const a=await pair('Windows'),b=await pair('Fire'),c=await pair('Other');
 async function offer(name='sample.bin',size=3,sender=a,receiver=b){const r=await call(sender.token,'transfers','POST',JSON.stringify({name,size,receiver:receiver.device.id}));assert.equal(r.status,201);return (await r.json()).id;}
 async function ready(data,name='sample.bin',sender=a,receiver=b){const id=await offer(name,data.length,sender,receiver);assert.equal((await call(receiver.token,`transfers/${id}/accept`,'POST')).status,200);
 for(let o=0;o<data.length;o+=CHUNK)assert.equal((await call(sender.token,`transfers/${id}/chunk?offset=${o}`,'PUT',data.subarray(o,o+CHUNK))).status,200);
 assert.equal((await call(sender.token,`transfers/${id}/finish`,'POST',JSON.stringify({sha256:sha(data)}))).status,201);return id;}
 return {app,url,call,pair,a,b,c,offer,ready,advance:n=>now+=n};
}
test('SHA-256 is incremental across padding and chunk boundaries',()=>{for(const n of [0,1,55,56,63,64,65,127,128,1000,CHUNK+17]){const b=randomBytes(n),h=new SHA256();for(let o=0;o<n;o+=37)h.update(b.subarray(o,o+37));assert.equal(h.hex(),sha(b));}});
test('binding and filename safety',async()=>{for(const ip of ['0.0.0.0','8.8.8.8','169.254.1.2','::','192.168.1.999'])assert.equal(privateIP(ip),false);assert.equal(privateIP('192.168.1.4'),true);assert.equal(safeName('../../NUL.exe'),'received-file');assert.equal(safeName('C:\\foo\\a.apk'),'a.apk');await assert.rejects(()=>createApp({host:'0.0.0.0'}));});
test('pairing, host/origin controls, revocation and expiry',async t=>{
 const {app,url,call,a,advance}=await setup(t);
 assert.equal((await call('','state')).status,401);
 assert.equal((await call(a.token,'state','GET',undefined,{Origin:'http://evil.invalid'})).status,403);
 assert.equal((await call(a.token,'state','GET',undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal(await new Promise((resolve,reject)=>{const r=http.get(url+'/api/state',{headers:{Host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);}),403);
 assert.equal((await call('','pair','POST','{')).status,400);
 assert.equal((await call('','pair','POST',JSON.stringify({key:'wrong',name:'Intruder'}))).status,401);
 for(let i=0;i<6;i++)await call('','pair','POST',JSON.stringify({key:'wrong',name:'Intruder'}));
 assert.equal((await call('','pair','POST',JSON.stringify({key:app.token,name:'Late'}))).status,429);
 assert.equal((await call(a.token,'disconnect','POST')).status,200);assert.equal((await call(a.token,'state')).status,401);
 advance(9*60*60*1000);await app.sweep();assert.equal((await call(a.token,'state')).status,401);
});
test('receiver consent blocks bytes; third-party isolation; decline and cancel',async t=>{
 const {app,call,a,b,c,offer}=await setup(t),id=await offer();
 assert.equal((await call(a.token,`transfers/${id}/chunk?offset=0`,'PUT','abc')).status,409);assert.deepEqual(await readdir(app.session),[]);
 assert.equal((await call(a.token,`transfers/${id}/accept`,'POST')).status,403);
 assert.equal((await call(c.token,`transfers/${id}/accept`,'POST')).status,404);
 assert.equal((await call(b.token,`transfers/${id}/decline`,'POST')).status,200);
 assert.equal((await call(b.token,`transfers/${id}/accept`,'POST')).status,409);
 assert.equal((await call(a.token,`transfers/${id}/chunk?offset=0`,'PUT','abc')).status,409);
 assert.equal((await(await call(c.token,'state')).json()).transfers.length,0);
 const cancelled=await offer();assert.equal((await call(a.token,`transfers/${cancelled}`,'DELETE')).status,200);
});
test('both directions, file types, empty files, native streaming and single-use tickets',async t=>{
 const {app,call,a,b,c,ready}=await setup(t);
 for(const [i,name] of ['test.apk','test.zip','test.exe','image.png','video.mp4','doc.pdf','no-extension','empty','<script>😀.bin'].entries()){
  const sender=i%2?a:b,receiver=i%2?b:a,data=name==='empty'?Buffer.alloc(0):randomBytes(CHUNK+17),id=await ready(data,name,sender,receiver);
  assert.equal((await call(sender.token,`transfers/${id}/ticket`,'POST')).status,403);
  assert.equal((await call(c.token,`transfers/${id}/ticket`,'POST')).status,404);
  const {ticket}=await(await call(receiver.token,`transfers/${id}/ticket`,'POST')).json();
  const download=()=>call('',`transfers/${id}/download`,'POST',new URLSearchParams({ticket}),{Cookie:receiver.cookie});
  const r=await download();assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/^attachment/);assert.deepEqual(Buffer.from(await r.arrayBuffer()),data);
  // The final socket flush may still hold the busy lock after client EOF.
  assert.ok([403,409].includes((await download()).status), 'replayed ticket must be rejected');
  const disk=(await readdir(app.session)).find(x=>x.startsWith(id));assert.deepEqual(await readFile(path.join(app.session,disk)),data);
 }
});
test('corruption, bad offsets, oversized chunks, cancellation and stale cleanup',async t=>{
 const {app,call,a,b,offer,advance}=await setup(t),id=await offer();
 await call(b.token,`transfers/${id}/accept`,'POST');
 assert.equal((await call(a.token,`transfers/${id}/chunk?offset=1`,'PUT','abc')).status,409);
 assert.equal((await call(a.token,`transfers/${id}/chunk?offset=0`,'PUT','abc')).status,200);
 assert.equal((await call(a.token,`transfers/${id}/finish`,'POST',JSON.stringify({sha256:'0'.repeat(64)}))).status,422);
 assert.deepEqual(await readdir(app.session),[]);
 const big=await offer('large',CHUNK+1);await call(b.token,`transfers/${big}/accept`,'POST');
 assert.equal((await call(a.token,`transfers/${big}/chunk?offset=0`,'PUT',Buffer.alloc(CHUNK+1))).status,413);
 const stale=await offer();await call(b.token,`transfers/${stale}/accept`,'POST');await call(a.token,`transfers/${stale}/chunk?offset=0`,'PUT','a');advance(121000);await app.sweep();
 assert.equal((await call(a.token,`transfers/${stale}/chunk?offset=1`,'PUT','bc')).status,409);assert.deepEqual(await readdir(app.session),[]);
 assert.equal((await call(a.token,'transfers','POST',JSON.stringify({name:'too big',size:MAX+1,receiver:b.device.id}))).status,400);
});
test('large transfer streams 64 MiB with bounded chunks and verifies download incrementally',async t=>{
 const {call,a,b,offer}=await setup(t),n=64,id=await offer('large.bin',n*CHUNK),chunk=randomBytes(CHUNK),hash=createHash('sha256');
 await call(b.token,`transfers/${id}/accept`,'POST');
 for(let i=0;i<n;i++){hash.update(chunk);assert.equal((await call(a.token,`transfers/${id}/chunk?offset=${i*CHUNK}`,'PUT',chunk)).status,200);}
 const expected=hash.digest('hex');assert.equal((await call(a.token,`transfers/${id}/finish`,'POST',JSON.stringify({sha256:expected}))).status,201);
 const {ticket}=await(await call(b.token,`transfers/${id}/ticket`,'POST')).json();const r=await call('',`transfers/${id}/download`,'POST',new URLSearchParams({ticket}),{Cookie:b.cookie});assert.equal(r.status,200);
 const received=createHash('sha256');let total=0;for await(const chunk of r.body){received.update(chunk);total+=chunk.length;}assert.equal(total,n*CHUNK);assert.equal(received.digest('hex'),expected);
});
