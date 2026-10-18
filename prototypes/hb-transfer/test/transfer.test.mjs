import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp,privateIP,safeName,CHUNK} from '../server.mjs';
import {SHA256} from '../public/sha256.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('incremental browser SHA-256 matches Node across padding and chunk boundaries',()=>{
 for(const n of [0,1,55,56,63,64,65,127,128,1000,CHUNK+17]){const b=randomBytes(n),h=new SHA256();for(let o=0;o<n;o+=37)h.update(b.subarray(o,o+37));assert.equal(h.hex(),sha(b));}
 assert.equal(new SHA256().update(new TextEncoder().encode('abc')).hex(),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('private bindings and filename safety',async()=>{for(const ip of ['0.0.0.0','8.8.8.8','169.254.1.2','::'])assert.equal(privateIP(ip),false);assert.equal(privateIP('192.168.1.4'),true);assert.equal(safeName('../../NUL.exe'),'received-file');assert.equal(safeName('C:\\foo\\a.apk'),'a.apk');await assert.rejects(()=>createApp({host:'0.0.0.0'}));});
test('real HTTP transfers, isolation, cancellation and corruption rejection',async t=>{
 const base=await mkdtemp(path.join(tmpdir(),'hb-transfer-')),app=await createApp({port:0,base}),url=`http://${app.host}:${app.port}`;
 t.after(async()=>{await app.close();await rm(base,{recursive:true,force:true});});
 const call=(p,method='GET',body,headers={})=>fetch(url+p,{method,body,headers:{Authorization:'Bearer '+app.token,...headers}});
 assert.equal((await fetch(url+'/api/files')).status,401);
 assert.equal((await call('/api/files','GET',undefined,{Origin:'http://evil.invalid'})).status,403);
 assert.equal(await new Promise((resolve,reject)=>{const r=http.get(url+'/api/files',{headers:{Host:'evil.invalid',Authorization:'Bearer '+app.token}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);}),403);
 assert.equal((await call('/api/files','GET',undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal((await call('/data/anything')).status,404);
 async function init(name,size){const r=await call('/api/uploads','POST',JSON.stringify({name,size}));assert.equal(r.status,201);return (await r.json()).id;}
 for(const name of ['test.apk','test.zip','test.exe','image.png','video.mp4','doc.pdf','no-extension','empty','<script>😀.bin']){
  const b=name==='empty'?Buffer.alloc(0):randomBytes(CHUNK+17),id=await init(name,b.length);
  for(let o=0;o<b.length;o+=CHUNK)assert.equal((await call(`/api/uploads/${id}?offset=${o}`,'PUT',b.subarray(o,o+CHUNK))).status,200);
  const r=await call(`/api/uploads/${id}/finish`,'POST',JSON.stringify({sha256:sha(b)}));assert.equal(r.status,201);const meta=await r.json();assert.equal(meta.size,b.length);
  const response=await call('/api/files/'+id);assert.match(response.headers.get('content-disposition'),/^attachment/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),b);
  const disk=(await readdir(app.session)).find(x=>x.startsWith(id));assert.deepEqual(await readFile(path.join(app.session,disk)),b);
 }
 const id=await init('bad.apk',3);assert.equal((await call(`/api/uploads/${id}?offset=1`,'PUT','abc')).status,409);assert.equal((await call(`/api/uploads/${id}?offset=0`,'PUT','abc')).status,200);
 assert.equal((await call(`/api/uploads/${id}/finish`,'POST',JSON.stringify({sha256:'0'.repeat(64)}))).status,422);
 assert.equal((await call('/api/files/'+id)).status,404);assert.equal((await readdir(app.session)).some(x=>x.startsWith(id)),false);
 const short=await init('short',4);assert.equal((await call(`/api/uploads/${short}/finish`,'POST',JSON.stringify({sha256:sha(Buffer.alloc(0))}))).status,422);
 const cancel=await init('cancel',4);assert.equal((await call('/api/uploads/'+cancel,'DELETE')).status,200);
 assert.equal((await call('/api/uploads','POST',JSON.stringify({name:'large',size:256*1024*1024+1}))).status,400);
 const big=await init('chunk',CHUNK+1);assert.equal((await call(`/api/uploads/${big}?offset=0`,'PUT',Buffer.alloc(CHUNK+1))).status,413);await call('/api/uploads/'+big,'DELETE');
 const list=await(await call('/api/files')).json();assert.equal(list.files.length,9);assert.equal('disk' in list.files[0],false);
 const app2=await createApp({port:0,base});try{assert.notEqual(app2.token,app.token);assert.deepEqual((await(await fetch(`http://${app2.host}:${app2.port}/api/files`,{headers:{Authorization:'Bearer '+app2.token}})).json()).files,[]);}finally{await app2.close();}
});

test('pairing, expiry, revocation, proxy rejection and malformed requests',async t=>{
 let clock=1000;
 const base=await mkdtemp(path.join(tmpdir(),'hb-pair-'));
 const app=await createApp({port:0,base,now:()=>clock}),url=`http://${app.host}:${app.port}`;
 t.after(async()=>{await app.close();await rm(base,{recursive:true,force:true});});
 const pair=code=>fetch(url+'/api/pair',{method:'POST',body:JSON.stringify({code})});
 const auth=(token,p='/api/files',method='GET')=>fetch(url+p,{method,headers:{Authorization:'Bearer '+token}});
 assert.match(app.pairCode,/^\d{8}$/);
 const r=await pair(app.pairCode);assert.equal(r.status,200);const {token}=await r.json();
 assert.equal((await auth(token)).status,200);
 assert.equal((await auth(token,'/api/disconnect','POST')).status,200);
 assert.equal((await auth(token)).status,401);
 const second=await(await pair(app.pairCode)).json();
 for(let i=0;i<3;i++)assert.equal((await pair('wrong')).status,401);
 assert.equal((await pair(app.pairCode)).status,429);
 clock+=60001;assert.equal((await pair(app.pairCode)).status,200);
 assert.equal((await fetch(url+'/api/pair',{method:'POST',body:'{'})).status,400);
 assert.equal((await fetch(url+'/api/files',{headers:{Authorization:'Bearer '+app.token,Forwarded:'for=8.8.8.8'}})).status,403);
 clock+=600001;assert.equal((await pair(app.pairCode)).status,403);
 assert.equal((await auth(second.token)).status,200);
 clock+=8*60*60*1000;assert.equal((await auth(second.token)).status,401);
 for(const ip of ['10.evil','127.999.0.1','192.168.1.999','172.16.example','10.0.0.1.evil'])assert.equal(privateIP(ip),false);
});

test('duplicate names, capacity and partial cleanup preserve completed files',async t=>{
 const base=await mkdtemp(path.join(tmpdir(),'hb-clean-')),app=await createApp({port:0,base});
 t.after(async()=>{await rm(base,{recursive:true,force:true});});
 const url=`http://${app.host}:${app.port}`,call=(p,method='GET',body)=>fetch(url+p,{method,body,headers:{Authorization:'Bearer '+app.token}});
 const init=async(size=0)=>(await(await call('/api/uploads','POST',JSON.stringify({name:'same.txt',size}))).json()).id;
 try{
 const ids=[];for(let i=0;i<2;i++){const id=await init();ids.push(id);assert.equal((await call('/api/uploads/'+id+'/finish','POST',JSON.stringify({sha256:sha(Buffer.alloc(0))}))).status,201);}
 assert.notEqual(ids[0],ids[1]);
 for(let i=0;i<4;i++)await init(1);
 assert.equal((await call('/api/uploads','POST',JSON.stringify({name:'fifth',size:1}))).status,429);
 }finally{await app.close();}
 const names=await readdir(app.session);assert.equal(names.length,2);assert.equal(names.some(x=>x.endsWith('.part')),false);
});
