import http from 'node:http';
import {isIPv4} from 'node:net';
import {networkInterfaces} from 'node:os';
import {createHash, randomBytes, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {mkdir, open, readFile, rename, rm, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
const root=path.dirname(fileURLToPath(import.meta.url));
export const MAX=256*1024*1024, CHUNK=1024*1024;
export function privateIP(ip){return isIPv4(ip) && (/^127\./.test(ip)||/^10\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip));}
export function safeName(s){s=String(s).split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f\x7f]/g,'_').replace(/[. ]+$/,'').slice(0,180);return !s||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s)?'received-file':s;}
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function body(req,max){const parts=[];let n=0;for await(const b of req){n+=b.length;if(n>max)throw fail(413,'Request too large');parts.push(b);}return Buffer.concat(parts);}
async function digest(file){const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');}
export async function createApp({host='127.0.0.1',port=8787,base=path.join(root,'data'),token=randomBytes(16).toString('hex'),now=Date.now}={}){
 if(!privateIP(host)||!/^\d+\.\d+\.\d+\.\d+$/.test(host))throw Error('Choose a private IPv4 address; wildcard and public binds are prohibited.');
 const session=path.join(base,randomUUID());await mkdir(session,{recursive:true});
 const pairCode=String(randomInt(100000000)).padStart(8,'0'),pairExpires=now()+10*60*1000;
 const clients=new Map();let attempts=0,attemptWindow=now();
 const files=new Map(),uploads=new Map();let reserved=0;
 async function discard(id){const u=uploads.get(id);if(u){uploads.delete(id);reserved-=u.size;await rm(u.temp,{force:true});}}
 const timer=setInterval(()=>{for(const [id,u] of uploads)if(!u.busy&&Date.now()-u.touched>120000)discard(id).catch(()=>{});},30000);timer.unref();
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try{
   const authority=`${host}:${server.address().port}`;
   if(!privateIP(req.socket.remoteAddress||'')||req.headers.host!==authority)throw fail(403,'Local network access only');
   if(Object.keys(req.headers).some(h=>h==='forwarded'||h.startsWith('x-forwarded-')))throw fail(403,'Proxy access is not supported');
   if(req.headers.origin&&req.headers.origin!==`http://${authority}`)throw fail(403,'Cross-origin request denied');
   if(req.headers['sec-fetch-site']==='cross-site')throw fail(403,'Cross-site request denied');
   const url=new URL(req.url,`http://${authority}`),p=url.pathname;
   const assets={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript'],'/sha256.js':['sha256.js','text/javascript'],'/style.css':['style.css','text/css']};
   if(req.method==='GET'&&assets[p]){const [name,type]=assets[p];res.writeHead(200,{'Content-Type':type});res.end(await readFile(path.join(root,'public',name)));return;}
   if(req.method==='POST'&&p==='/api/pair'){
    if(now()>pairExpires)throw fail(403,'Pairing code expired. Restart HB Transfer on Windows to pair again.');
    if(now()-attemptWindow>=60000){attempts=0;attemptWindow=now();}
    if(attempts>=5)throw fail(429,'Too many pairing attempts. Wait one minute and try again.');
    attempts++;
    const {code}=JSON.parse((await body(req,256)).toString());
    const candidate=Buffer.from(typeof code==='string'?code:'');
    if(candidate.length!==8||!timingSafeEqual(candidate,Buffer.from(pairCode)))throw fail(401,'Incorrect pairing code. Check the Windows window.');
    for(const [key,expires] of clients)if(now()>expires)clients.delete(key);
    if(clients.size>=8)throw fail(429,'Eight devices are already paired. Restart to revoke all devices.');
    const key=randomBytes(32).toString('hex');clients.set(key,now()+8*60*60*1000);
    return send(200,{token:key});
   }
   const supplied=Buffer.from(req.headers.authorization||''),expected=Buffer.from(`Bearer ${token}`);
   const key=(req.headers.authorization||'').replace(/^Bearer /,'');
   const master=supplied.length===expected.length&&timingSafeEqual(supplied,expected);
   if(!master&&!(clients.has(key)&&now()<=clients.get(key)))throw fail(401,'Connection expired. Disconnect and pair again; restart Windows host if the code expired.');
   if(req.method==='POST'&&p==='/api/disconnect'){clients.delete(key);return send(200,{disconnected:true});}
   if(req.method==='GET'&&p==='/api/files')return send(200,{files:[...files.values()].map(({disk,...f})=>f),max:MAX,chunk:CHUNK});
   if(req.method==='POST'&&p==='/api/uploads'){
    const {name,size}=JSON.parse((await body(req,4096)).toString());
    if(typeof name!=='string'||!Number.isSafeInteger(size)||size<0||size>MAX)throw fail(400,'Invalid name or size (maximum 256 MiB)');
    if(uploads.size>=4||files.size+uploads.size>=100||reserved+size>1024*1024*1024)throw fail(429,'Session capacity reached. Restart to clear the list; saved files remain on disk.');
    const id=randomUUID(),temp=path.join(session,id+'.part');
    const u={name:safeName(name),size,temp,offset:0,touched:Date.now(),busy:true};uploads.set(id,u);reserved+=size;
    try{await (await open(temp,'wx')).close();u.busy=false;}catch(e){await discard(id);throw e;}return send(201,{id});
   }
   const match=p.match(/^\/api\/uploads\/([a-f0-9-]+)(\/finish)?$/);
   if(match){const id=match[1],u=uploads.get(id);if(!u)throw fail(404,'Upload expired or missing');if(u.busy)throw fail(409,'Upload busy');
    if(req.method==='DELETE'&&!match[2]){await discard(id);return send(200,{cancelled:true});}
    u.busy=true;u.touched=Date.now();
    try{
     if(req.method==='PUT'&&!match[2]){
      const offset=Number(url.searchParams.get('offset'));if(!url.searchParams.has('offset')||offset!==u.offset)throw fail(409,'Wrong chunk offset');
      const b=await body(req,CHUNK);if(!b.length||u.offset+b.length>u.size)throw fail(400,'Wrong chunk size');
      const f=await open(u.temp,'a');try{await f.writeFile(b);}finally{await f.close();}u.offset+=b.length;return send(200,{offset:u.offset});
     }
     if(req.method==='POST'&&match[2]){
      const {sha256}=JSON.parse((await body(req,1024)).toString());
      if(!/^[a-f0-9]{64}$/.test(sha256)||u.offset!==u.size||(await stat(u.temp)).size!==u.size||await digest(u.temp)!==sha256){await discard(id);throw fail(422,'Integrity check failed; partial file removed');}
      const disk=path.join(session,`${id}--${u.name}`);await rename(u.temp,disk);uploads.delete(id);
      const f={id,name:u.name,size:u.size,sha256,disk};files.set(id,f);const {disk:_,...metadata}=f;return send(201,metadata);
     }
     throw fail(405,'Method not allowed');
    }catch(e){if(!e.status||e.code){await discard(id);}throw e;}finally{u.busy=false;u.touched=Date.now();}
   }
   const download=p.match(/^\/api\/files\/([a-f0-9-]+)$/);
   if(req.method==='GET'&&download){const f=files.get(download[1]);if(!f)throw fail(404,'File not found');res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':f.size,'Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(f.name).replace(/'/g,'%27')}`});await pipeline(createReadStream(f.disk),res);return;}
   throw fail(404,'Not found');
  }catch(e){if(res.headersSent){res.destroy();return;}send(e.status||(e instanceof SyntaxError?400:500),{error:e.status?e.message:e instanceof SyntaxError?'Invalid JSON request':'Transfer failed; check disk space and retry'});}
 });
 server.requestTimeout=120000;server.headersTimeout=15000;server.maxHeadersCount=40;server.setTimeout(60000,s=>s.destroy());
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 return {server,host,port:server.address().port,token,pairCode,session,async close(){clearInterval(timer);server.closeAllConnections();await new Promise(r=>server.close(r));for(const id of uploads.keys())await discard(id);}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);let host=args[args.indexOf('--host')+1];if(!args.includes('--host')){
   const candidates=[...new Set(Object.values(networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal&&privateIP(x.address)).map(x=>x.address))];
   console.log('\nHB TRANSFER / LOCAL WI-FI\nChoose the Windows Wi-Fi IPv4 address (use ipconfig to check).');
   candidates.forEach((a,i)=>console.log(`${i+1}. ${a}`));console.log('0. This computer only (test mode)');
   const rl=createInterface({input:process.stdin,output:process.stdout});const answer=await rl.question('Address number: ');rl.close();host=answer==='0'?'127.0.0.1':candidates[Number(answer)-1];if(!host)throw Error('Invalid selection');
  }
  const app=await createApp({host});console.log(`\nOpen on BOTH devices: http://${app.host}:${app.port}\nPairing code: ${app.pairCode.slice(0,4)} ${app.pairCode.slice(4)} (valid for 10 minutes)\nReceived files: ${app.session}\nTrusted Wi-Fi only: HTTP is not encrypted. No port forwarding or tunnels.\nCtrl+C to stop sharing.\n`);
  let stopping=false;for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{if(stopping)return;stopping=true;await app.close();process.exit(0);});
 }catch(e){console.error(e.message);process.exitCode=1;}
}
