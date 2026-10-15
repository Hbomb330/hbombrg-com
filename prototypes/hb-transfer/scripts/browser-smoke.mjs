import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
const base=await mkdtemp(path.join(tmpdir(),'hb-browser-')),app=await createApp({port:0,base});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const desktop=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});
 const mobile=await browser.newContext({acceptDownloads:true,viewport:{width:600,height:1024},isMobile:true,hasTouch:true});
 const a=await desktop.newPage(),b=await mobile.newPage(),errors=[];
 for(const [page,name] of [[a,'Windows PC'],[b,'Fire tablet']]){
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('Browser:',m.text());});page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),new URL(r.url()).pathname);});await page.goto(`http://${app.host}:${app.port}`);await page.locator('#name').fill(name);await page.locator('#key').fill(app.token);await page.getByRole('button',{name:'Pair device',exact:true}).click();await page.locator('#workspace').waitFor({state:'visible'});
 }
 for(const [sender,receiver,name] of [[a,b,'pc-to-fire.bin'],[b,a,'fire-to-pc.bin']]){
  await sender.waitForFunction(()=>document.querySelector('#receiver').value!=='');
  const buffer=Buffer.alloc(2*1024*1024+17,0x5a);await sender.locator('#file').setInputFiles({name,mimeType:'application/octet-stream',buffer});
  await sender.getByRole('button',{name:'Request transfer',exact:true}).click();
  const card=receiver.locator('.file').filter({has:receiver.locator('.name',{hasText:name})});
  await card.getByRole('button',{name:'Accept file',exact:true}).waitFor();
  assert.match(await card.innerText(),/pending/);await card.getByRole('button',{name:'Accept file',exact:true}).click();
  const save=card.getByRole('button',{name:'Save to this device',exact:true});await save.waitFor({timeout:30000});
  const event=receiver.waitForEvent('download');await save.click();const download=await event;assert.equal(download.suggestedFilename(),name);assert.deepEqual(await readFile(await download.path()),buffer);
  await card.getByRole('button',{name:'Check saved copy',exact:true}).click();await receiver.locator('#verifyFile').setInputFiles({name,mimeType:'application/octet-stream',buffer});await receiver.getByRole('button',{name:'Compare size and SHA-256'}).click();
  await receiver.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Saved copy verified'));
 }
 for(const width of [360,600,1024]){await b.setViewportSize({width,height:900});assert.ok(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);console.log('PASS: two browser contexts, both directions, approval, native downloads, saved-copy hashes, responsive widths.');
}finally{await browser?.close();await app.close();await rm(base,{recursive:true,force:true});}
