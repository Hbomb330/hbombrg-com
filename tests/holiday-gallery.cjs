const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 // The original H.264 previews need the codecs bundled with branded Chrome.
 // Playwright's Chromium headless shell does not include those codecs.
 const browser=await chromium.launch({channel:'chrome'});
 console.log('Chrome launched',browser.version());
 try {
  const page=await browser.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().endsWith('.mp4'))console.log('Media response',r.status(),r.url(),JSON.stringify(r.headers()))});
  page.on('requestfailed',r=>console.error('Request failed',r.url(),r.failure()));
  assert(await page.evaluate(()=>document.createElement('video').canPlayType('video/mp4; codecs="avc1.64001f"')),'Test browser must support the original H.264 previews');
  for(const width of [1440,768,390]) {
   console.log(`Testing viewport ${width}`);
   await page.setViewportSize({width,height:900});
   await page.goto('http://127.0.0.1:8765/holiday-gallery.html');
   assert.equal(await page.locator('.theme-panel:visible').getAttribute('id'),'halloween');
   assert(await page.locator('video').evaluateAll(v=>v.every(x=>x.paused&&!x.autoplay&&x.preload==='none')));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`/tmp/holiday-${width}.png`,fullPage:true});
   for(const key of ['halloween','christmas','new-year']) {
    await page.locator(`[data-theme="${key}"]`).focus();await page.keyboard.press('Enter');
    await page.waitForFunction(k=>!document.getElementById(k).hidden,key);
    assert.equal(await page.locator('.theme-panel:visible').getAttribute('id'),key);
    console.log(`Testing playback ${width}: ${key}`);
    await page.locator(`#${key} video`).evaluate(v=>{v.play().catch(e=>{v.dataset.playError=e.message})});
    try {
     await page.waitForFunction(k=>{const v=document.querySelector(`#${k} video`);if(v.dataset.playError)throw Error(v.dataset.playError);return v.currentTime>.1},key,{timeout:20000});
    } catch(error) {
     console.error('Playback diagnostics',JSON.stringify(await page.locator(`#${key} video`).evaluate(v=>({src:v.currentSrc,paused:v.paused,currentTime:v.currentTime,duration:v.duration,readyState:v.readyState,networkState:v.networkState,error:v.error&&{code:v.error.code,message:v.error.message},playError:v.dataset.playError,videoWidth:v.videoWidth,visibility:document.visibilityState,h264:v.canPlayType('video/mp4; codecs="avc1.64001f"'),buffered:Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)])}))));
     await page.screenshot({path:`/tmp/holiday-failure-${width}-${key}.png`,fullPage:true});
     throw error;
    }
    assert(await page.locator(`#${key} video`).evaluate(v=>v.videoWidth>0&&!v.error));
    await page.screenshot({path:`/tmp/holiday-${width}-${key}.png`,fullPage:true});
   }
   assert(await page.locator('#christmas video').evaluate(v=>v.paused));
   await page.goBack();await page.waitForFunction(()=>!document.getElementById('christmas').hidden);
  }
  await page.goto('http://127.0.0.1:8765/');
  await page.locator('#blue-wave a[href="holiday-gallery.html"]').click();await page.waitForURL('**/holiday-gallery.html');
  await page.locator('.back').click();await page.waitForURL('**/index.html#blue-wave');
  assert.equal(await page.locator('[data-app-download="blue-wave"]').getAttribute('href'),'https://github.com/Hbomb330/hbombrg-com/releases/download/blue-wave-v2.1.0/HBOMB.Blue.Wave.2.1.0.exe');
  // Returning from the gallery must preserve the homepage preview/dock controls.
  await page.locator('#blue-wave .window-open-btn').click();
  await page.waitForFunction(()=>document.getElementById('appWindow').classList.contains('open'));
  await page.locator('#windowMin').click();
  await page.waitForFunction(()=>document.getElementById('appWindow').classList.contains('minimized'));
  await page.locator('.dockbtn[data-target="blue-wave"]').click();
  await page.waitForFunction(()=>document.getElementById('appWindow').classList.contains('open'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.getElementById('appWindow').getAttribute('aria-hidden')==='true');
  await page.locator('#blue-wave .window-open-btn').click();
  await page.locator('#windowClose').click();
  await page.waitForFunction(()=>document.getElementById('appWindow').getAttribute('aria-hidden')==='true');
  const ctx=await browser.newContext({javaScriptEnabled:false});const nojs=await ctx.newPage();
  await nojs.goto('http://127.0.0.1:8765/holiday-gallery.html');assert.equal(await nojs.locator('.theme-panel:visible').count(),3);await ctx.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/tablet/mobile, keyboard themes, playback, pause on switch, history, homepage navigation, unchanged Blue Wave download and no-JS fallback');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
