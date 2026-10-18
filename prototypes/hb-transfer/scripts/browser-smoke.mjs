import {createRequire} from 'node:module';
import {createApp} from '../server.mjs';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=await mkdtemp(path.join(tmpdir(),'hb-ui-')),app=await createApp({port:0,base});let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true});
 const desktop=await browser.newContext({viewport:{width:1200,height:950},acceptDownloads:true}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const a=await desktop.newPage(),b=await mobile.newPage();for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://${app.host}:${app.port}`);await page.locator('#key').fill(app.pairCode);await page.locator('#connect button').click();await page.locator('#workspace').waitFor({state:'visible'});}
 const payload=Buffer.from(Array.from({length:1100000},(_,i)=>i%256));
 await a.locator('#file').setInputFiles({name:'Time-Core-test.apk',mimeType:'application/octet-stream',buffer:payload});await a.locator('#upload').click();await a.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Verified on Windows'));
 await b.locator('#refresh').click();await b.locator('[data-download]').click();await b.locator('#save').waitFor({state:'visible'});
 const downloadPromise=b.waitForEvent('download');await b.locator('#save').click();const download=await downloadPromise;assert.deepEqual(await readFile(await download.path()),payload);
 await b.locator('#verifyFile').setInputFiles(await download.path());await b.locator('#verify').click();await b.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Saved copy verified'));

 await b.locator('#file').setInputFiles({name:'Android-to-Windows.bin',mimeType:'application/octet-stream',buffer:Buffer.from('reverse direction test')});await b.locator('#upload').click();await b.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Verified on Windows'));
 await a.locator('#refresh').click();await a.locator('.file').filter({hasText:'Android-to-Windows.bin'}).locator('button').click();await a.locator('#save').waitFor({state:'visible'});

 const reverseDownload=a.waitForEvent('download');await a.locator('#save').click();assert.deepEqual(await readFile(await (await reverseDownload).path()),Buffer.from('reverse direction test'));
 for(const viewport of [{width:600,height:1024},{width:1024,height:600},{width:360,height:800}]){await b.setViewportSize(viewport);assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await b.locator('#lock').click();await b.locator('#pair').waitFor({state:'visible'});
 assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log('PASS: desktop upload → mobile receive/save/recheck; mobile upload → desktop receive; no browser errors or mobile horizontal overflow.');
}finally{await browser?.close();await app.close();await rm(base,{recursive:true,force:true});}
