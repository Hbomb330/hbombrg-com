import http from 'node:http';
import {networkInterfaces} from 'node:os';
import {isIPv4} from 'node:net';
import {createHash, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {mkdir, open, readFile, rename, rm, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
const root=path.dirname(fileURLToPath(import.meta.url));
export const MAX=10*1024**3, CHUNK=1024**2, CAPACITY=20*1024**3;
export function privateIP(ip){return isIPv4(ip)&&(/^(127|10)\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip));}
export function safeName(s){s=String(s).split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'_').replace(/[. ]+$/,'');s=[...s].slice(0,100).join('');while(Buffer.byteLength(s)>180)s=[...s].slice(0,-1).join('');s=s.replace(/[. ]+$/,'');return !s||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s)?'received-file':s;}
const fail=(status,message)=>Object.assign(new Error(message),{status});
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
async function body(req,max){const parts=[];let n=0;for await(const b of req){n+=b.length;if(n>max)throw fail(413,'Request too large');parts.push(b);}return Buffer.concat(parts);}
async function json(req){try{return JSON.parse((await body(req,4096)).toString());}catch(e){if(e.status)throw e;throw fail(400,'Invalid JSON');}}
async function digest(file){const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');}
export async function createApp({host='127.0.0.1',port=8787,base=path.join(root,'data'),token=randomBytes(16).toString('hex'),clock=Date.now}={}){
 if(!privateIP(host))throw Error('Choose a private IPv4 address; wildcard and public binds are prohibited.');
 const session=path.join(base,randomUUID());await mkdir(session,{recursive:true});
 const devices=new Map(),transfers=new Map(),attempts=new Map();let reserved=0;
 const publicTransfer=t=>({id:t.id,name:t.name,size:t.size,sender:t.sender,receiver:t.receiver,status:t.status,offset:t.offset,sha256:t.sha256,downloadBytes:t.downloadBytes,downloadStatus:t.downloadStatus});
 async function discard(t,status='cancelled'){
  if(t.status==='ready')throw fail(409,'Completed files remain on Windows; stop sharing to clear access.');
  if(t.released)return;t.released=true;t.status=status;reserved-=t.size;
  await rm(t.temp,{force:true});
 }
 async function sweep(){
  for(const [key,a] of attempts)if(clock()-a.start>60000)attempts.delete(key);
  for(const t of transfers.values())if(!t.busy&&!['ready','declined','cancelled','failed','expired'].includes(t.status)&&clock()-t.touched>(t.status==='uploading'?120000:1800000))await discard(t,'expired');
  for(const [key,d] of devices)if(clock()>d.expires)devices.delete(key);
 }
 const timer=setInterval(()=>sweep().catch(()=>{}),30000);timer.unref();
 const server=http.createServer(async(req,res)=>{
  // Preserve Origin on native form POSTs; no-referrer makes it null in browsers.
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try{
   const authority=`${host}:${server.address().port}`,origin=`http://${authority}`;
   if(!privateIP(req.socket.remoteAddress||'')||req.headers.host!==authority)throw fail(403,'Local network access only');
   if(req.headers.origin&&req.headers.origin!==origin)throw fail(403,'Cross-origin request denied');
   if(req.headers['sec-fetch-site']==='cross-site')throw fail(403,'Cross-site request denied');
   const url=new URL(req.url,origin),p=url.pathname;
   const assets={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript'],'/sha256.js':['sha256.js','text/javascript'],'/style.css':['style.css','text/css']};
   if(req.method==='GET'&&assets[p]){const [name,type]=assets[p];res.writeHead(200,{'Content-Type':type});res.end(await readFile(path.join(root,'public',name)));return;}
   if(req.method==='POST'&&p==='/api/pair'){
    const ip=req.socket.remoteAddress,a=attempts.get(ip)||{start:clock(),count:0};attempts.set(ip,a);
    if(clock()-a.start>60000){a.start=clock();a.count=0;}if(++a.count>10)throw fail(429,'Too many pairing attempts. Wait one minute.');
    const data=await json(req);
    if(typeof data.key!=='string'||!equal(data.key,token))throw fail(401,'Pairing key does not match the Windows window.');
    if(typeof data.name!=='string'||!data.name.trim()||data.name.length>40)throw fail(400,'Use a device name of 1–40 characters.');
    if(devices.size>=8)throw fail(429,'Eight devices maximum. Disconnect an unused device or restart.');
    const credential=randomBytes(32).toString('hex'),device={id:randomUUID(),name:data.name.trim(),expires:clock()+8*60*60*1000,lastSeen:clock()};devices.set(credential,device);
    res.setHeader('Set-Cookie',`hb_session=${credential}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
    return send(201,{token:credential,device:{id:device.id,name:device.name}});
   }
   const download=p.match(/^\/api\/transfers\/([a-f0-9-]+)\/download$/);
   const credential=download?(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('hb_session='))?.slice(11):(req.headers.authorization||'').replace(/^Bearer /,'');
   const device=devices.get(credential);if(!device||clock()>device.expires)throw fail(401,'Pair this device again.');device.lastSeen=clock();
   if(req.method==='POST'&&p==='/api/disconnect'){
    // Do not delete active files mid-write. The sender loses access immediately;
    // incomplete transfers become cancellable by the receiver or expire.
    devices.delete(credential);res.setHeader('Set-Cookie','hb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(200,{disconnected:true});
   }
   if(req.method==='GET'&&p==='/api/state')return send(200,{device:{id:device.id,name:device.name},devices:[...devices.values()].filter(d=>clock()<d.expires).map(d=>({id:d.id,name:d.name,online:clock()-d.lastSeen<15000})),transfers:[...transfers.values()].filter(t=>t.sender===device.id||t.receiver===device.id).map(publicTransfer),max:MAX,chunk:CHUNK});
   if(req.method==='POST'&&p==='/api/transfers'){
    const {name,size,receiver}=await json(req);
    if(typeof name!=='string'||!name||name.length>255||!Number.isSafeInteger(size)||size<0||size>MAX)throw fail(400,'Invalid name or size (maximum 10 GiB).');
    if(receiver===device.id||![...devices.values()].some(d=>d.id===receiver&&clock()<d.expires))throw fail(400,'Select another paired device.');
    if(transfers.size>=100||reserved+size>CAPACITY)throw fail(429,'Session capacity reached. Restart; saved files remain on Windows.');
    const id=randomUUID(),t={id,name:safeName(name),size,sender:device.id,receiver,status:'pending',offset:0,temp:path.join(session,id+'.part'),touched:clock(),busy:false,downloadBytes:0,downloadStatus:'not started'};
    reserved+=size;transfers.set(id,t);return send(201,publicTransfer(t));
   }
   const match=p.match(/^\/api\/transfers\/([a-f0-9-]+)(?:\/(accept|decline|chunk|finish|ticket|download))?$/);
   if(!match)throw fail(404,'Not found');
   const t=transfers.get(match[1]),action=match[2];
   if(!t||(t.sender!==device.id&&t.receiver!==device.id))throw fail(404,'Transfer not found');
   if(t.busy)throw fail(409,'Transfer busy; try again shortly.');
   if(req.method==='DELETE'&&!action){await discard(t);return send(200,publicTransfer(t));}
   if(['accept','decline','ticket','download'].includes(action)&&t.receiver!==device.id)throw fail(403,'Only the selected receiver can do this.');
   if(['chunk','finish'].includes(action)&&t.sender!==device.id)throw fail(403,'Only the sender can upload.');
   if(req.method==='POST'&&(action==='accept'||action==='decline')){
    if(t.status!=='pending')throw fail(409,'Offer already decided.');
    if(action==='decline'){await discard(t,'declined');}else{t.status='accepted';t.touched=clock();}
    return send(200,publicTransfer(t));
   }
   if((req.method==='PUT'&&action==='chunk')||(req.method==='POST'&&action==='finish')){
    if(!['accepted','uploading'].includes(t.status))throw fail(409,'Receiver approval required before uploading.');
    const active=[...transfers.values()].filter(x=>x.busy).length;if(active>=4)throw fail(429,'Four active operations maximum.');
    t.busy=true;t.touched=clock();
    try{
     if(action==='chunk'){
      if(!url.searchParams.has('offset')||Number(url.searchParams.get('offset'))!==t.offset)throw fail(409,'Wrong chunk offset.');
      const b=await body(req,CHUNK);if(!b.length||t.offset+b.length>t.size)throw fail(400,'Wrong chunk size.');
      const f=await open(t.temp,t.offset===0?'wx':'a');try{await f.writeFile(b);}finally{await f.close();}
      t.offset+=b.length;t.status='uploading';return send(200,publicTransfer(t));
     }
     const {sha256}=await json(req);
     if(t.size===0)await (await open(t.temp,'wx')).close();
     if(!/^[a-f0-9]{64}$/.test(sha256)||t.offset!==t.size||(await stat(t.temp)).size!==t.size||await digest(t.temp)!==sha256){await discard(t,'failed');throw fail(422,'Integrity check failed; partial file removed.');}
     t.disk=path.join(session,`${t.id}--${t.name}`);await rename(t.temp,t.disk);t.sha256=sha256;t.status='ready';return send(201,publicTransfer(t));
    }catch(e){if(!e.status||e.code)await discard(t,'failed');throw e;}finally{t.busy=false;t.touched=clock();}
   }
   if(req.method==='POST'&&action==='ticket'){
    if(t.status!=='ready')throw fail(409,'File not ready.');
    t.ticket=randomBytes(32).toString('hex');t.ticketUntil=clock()+60000;return send(200,{ticket:t.ticket});
   }
   if(req.method==='POST'&&action==='download'){
    const form=new URLSearchParams((await body(req,1024)).toString());
    if(t.status!=='ready'||!t.ticket||clock()>t.ticketUntil||!equal(form.get('ticket')||'',t.ticket))throw fail(403,'Download approval expired. Click Save again.');
    t.ticket=null;t.busy=true;t.downloadBytes=0;t.downloadStatus='streaming';
    try{
     res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':t.size,'Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(t.name).replace(/'/g,'%27')}`});
     const meter=new Transform({transform(chunk,encoding,cb){t.downloadBytes+=chunk.length;cb(null,chunk);}});
     await pipeline(createReadStream(t.disk),meter,res);t.downloadStatus='sent to browser';
    }catch{t.downloadStatus='interrupted';res.destroy();}finally{t.busy=false;}return;
   }
   throw fail(405,'Method not allowed');
  }catch(e){if(res.headersSent){res.destroy();return;}send(e.status||500,{error:e.status?e.message:'Transfer failed; check disk space and retry.'});}
 });
 server.requestTimeout=120000;server.headersTimeout=15000;server.maxHeadersCount=40;server.setTimeout(60000,s=>s.destroy());
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 return {server,host,port:server.address().port,token,session,sweep,async close(){clearInterval(timer);server.closeAllConnections();await new Promise(r=>server.close(r));for(const t of transfers.values())if(t.status!=='ready')await discard(t);}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);let host=args[args.indexOf('--host')+1];if(!args.includes('--host')){
   const candidates=[...new Set(Object.values(networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal&&privateIP(x.address)).map(x=>x.address))];
   console.log('\nHB TRANSFER / LOCAL WI-FI\nChoose the Windows Wi-Fi IPv4 address (use ipconfig to check).');
   candidates.forEach((a,i)=>console.log(`${i+1}. ${a}`));console.log('0. This computer only (test mode)');
   const rl=createInterface({input:process.stdin,output:process.stdout});const answer=await rl.question('Address number: ');rl.close();host=answer==='0'?'127.0.0.1':candidates[Number(answer)-1];if(!host)throw Error('Invalid selection');
  }
  const app=await createApp({host});console.log(`\nOpen on Windows and Fire tablet: http://${app.host}:${app.port}\nPairing key: ${app.token}\nReceived files: ${app.session}\nTrusted Wi-Fi only: HTTP is not encrypted. No port forwarding or tunnels.\nCtrl+C to stop sharing.\n`);
  let stopping=false;for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{if(stopping)return;stopping=true;await app.close();process.exit(0);});
 }catch(e){console.error(e.message);process.exitCode=1;}
}
