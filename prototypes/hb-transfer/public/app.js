import {SHA256} from './sha256.js';
const $=id=>document.getElementById(id),CHUNK=1024*1024;
let key='',me=null,state=null,active=false,controller=null,current=null,expected=null,polling=false,generation=0;
const status=(s,p)=>{$('status').textContent=s;if(p!==undefined)$('progress').value=p;};
const bytes=n=>`${Number(n).toLocaleString()} bytes`;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function api(p,method='GET',data,signal){
 const res=await fetch('/api/'+p,{method,headers:{Authorization:'Bearer '+key},body:data===undefined?undefined:(data instanceof Uint8Array?data:JSON.stringify(data)),signal});
 if(!res.ok){let message='Connection failed';try{message=(await res.json()).error||message;}catch{}throw Error(message);}return res.json();
}
function busy(on){active=on;for(const id of ['upload','file','lock','verify'])$(id).disabled=on;$('cancel').hidden=!on||!current;}
function button(text,fn,cls=''){const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status(e.message);}finally{b.disabled=false;}};return b;}
function render(){
 const selected=$('receiver').value;$('receiver').replaceChildren();
 for(const d of state.devices.filter(d=>d.id!==me.id)){
  const o=document.createElement('option');o.value=d.id;o.textContent=`${d.name} · ${d.id.slice(0,8)}${d.online?'':' · inactive'}`;$('receiver').append(o);
 }
 if([...$('receiver').options].some(o=>o.value===selected))$('receiver').value=selected;
 if(!$('receiver').options.length){const o=document.createElement('option');o.value='';o.textContent='Pair the other device to begin';$('receiver').append(o);}
 const ids=new Set(state.transfers.map(t=>t.id));
 for(const el of [...$('files').children])if(!ids.has(el.dataset.id))el.remove();
 for(const t of state.transfers){
  let card=[...$('files').children].find(el=>el.dataset.id===t.id);
  const signature=JSON.stringify([t.status,t.downloadStatus,t.sha256]);
  if(!card){card=document.createElement('div');card.className='file';card.dataset.id=t.id;$('files').prepend(card);}
  if(card.dataset.signature!==signature){
   card.dataset.signature=signature;card.replaceChildren();const title=document.createElement('div');title.className='name';title.textContent=t.name;
   const other=state.devices.find(d=>d.id===(t.sender===me.id?t.receiver:t.sender));
   const info=document.createElement('p');info.textContent=`${t.sender===me.id?'To':'From'} ${other?.name||'disconnected device'} · ${(t.sender===me.id?t.receiver:t.sender).slice(0,8)} · ${bytes(t.size)}`;
   const progress=document.createElement('progress');progress.max=100;progress.setAttribute('aria-label',t.name+' transfer progress');
   const detail=document.createElement('p');detail.className='detail';card.append(title,info,progress,detail);
   if(t.receiver===me.id&&t.status==='pending'){
    card.append(button('Accept file',async()=>{await api(`transfers/${t.id}/accept`,'POST');await refresh();}),button('Decline',async()=>{await api(`transfers/${t.id}/decline`,'POST');await refresh();},'danger'));
   }
   if(t.receiver===me.id&&t.status==='ready'){
    card.append(button('Save to this device',()=>save(t)),button('Check saved copy',()=>{expected=t;$('verifyBox').hidden=false;$('verifyName').textContent=t.name+' · SHA-256 '+t.sha256;$('verifyBox').scrollIntoView({behavior:'smooth'});},'secondary'));
   }
   if(['pending','accepted','uploading'].includes(t.status))card.append(button('Cancel transfer',async()=>{if(current===t.id)controller?.abort();await api('transfers/'+t.id,'DELETE');await refresh();},'secondary'));
  }
  const streaming=t.downloadStatus!=='not started',n=streaming?t.downloadBytes:t.offset;
  card.querySelector('progress').value=t.size?100*n/t.size:(t.status==='ready'?100:0);
  card.querySelector('.detail').textContent=`${t.status==='ready'?'Verified copy on Windows':t.status} · ${bytes(n)} / ${bytes(t.size)}${streaming?' · '+t.downloadStatus+' (not disk verification)':''}`;
 }
}
async function refresh(){if(!key)return;const g=generation;const data=await api('state');if(g!==generation)return;state=data;render();}
$('connect').onsubmit=async e=>{
 e.preventDefault();const b=e.submitter||$('connect').querySelector('button');b.disabled=true;
 try{const data=await api('pair','POST',{name:$('name').value,key:$('key').value.trim()});key=data.token;me=data.device;generation++;
  $('key').value='';$('pair').hidden=true;$('workspace').hidden=false;$('identity').textContent=me.name+' · '+me.id.slice(0,8);await refresh();status('Paired. Choose the receiving device and request a transfer.',0);
 }catch(e){status(e.message);}finally{b.disabled=false;}
};
$('lock').onclick=async()=>{try{await api('disconnect','POST');key='';generation++;state=null;me=null;$('files').replaceChildren();$('pair').hidden=false;$('workspace').hidden=true;$('verifyBox').hidden=true;status('Disconnected. Pair again to reconnect.',0);}catch(e){status(e.message);}};
$('refresh').onclick=()=>refresh().catch(e=>status(e.message));
setInterval(async()=>{if(!key||polling)return;polling=true;try{await refresh();}catch(e){status(e.message+' Keep the host window open.');}finally{polling=false;}},2000);
$('upload').onclick=async()=>{
 if(active)return;const file=$('file').files[0],receiver=$('receiver').value;if(!file||!receiver){status('Choose a file and a paired receiving device.');return;}
 if(file.size>state.max){status('Maximum file size is 10 GiB.');return;}
 controller=new AbortController();busy(true);
 try{
  const t=await api('transfers','POST',{name:file.name,size:file.size,receiver},controller.signal);current=t.id;$('cancel').hidden=false;
  status('Waiting for receiver approval. Keep this page open.',0);
  for(;;){controller.signal.throwIfAborted();const s=await api('state','GET',undefined,controller.signal),offer=s.transfers.find(x=>x.id===current);
   if(offer?.status==='accepted')break;if(!offer||offer.status!=='pending')throw Error('Receiver declined, cancelled, or the offer expired.');await pause(1000);
  }
  const hash=new SHA256();for(let offset=0;offset<file.size;offset+=CHUNK){controller.signal.throwIfAborted();const b=new Uint8Array(await file.slice(offset,offset+CHUNK).arrayBuffer());hash.update(b);
   await api(`transfers/${current}/chunk?offset=${offset}`,'PUT',b,controller.signal);status(`Sending ${file.name}: ${bytes(offset+b.length)} / ${bytes(file.size)}`,100*(offset+b.length)/file.size);
  }
  status('Verifying the stored Windows copy…',100);await api(`transfers/${current}/finish`,'POST',{sha256:hash.hex()},controller.signal);
  status('Verified copy on Windows. Receiver can now save it through the browser.',100);$('file').value='';
 }catch(e){status(e.name==='AbortError'?'Sending cancelled. Partial data will be removed.':e.message);if(current)await api('transfers/'+current,'DELETE').catch(()=>{});
 }finally{current=null;controller=null;busy(false);refresh().catch(()=>{});}
};
$('cancel').onclick=()=>controller?.abort();
async function save(t){
 const {ticket}=await api(`transfers/${t.id}/ticket`,'POST');
 const form=document.createElement('form');form.method='POST';form.action=`/api/transfers/${t.id}/download`;form.target='downloadTarget';form.hidden=true;
 const field=document.createElement('input');field.name='ticket';field.value=ticket;form.append(field);document.body.append(form);form.submit();form.remove();
 status('Download requested. Check your browser’s Downloads. Server progress does not confirm a disk save.');
}
$('verify').onclick=async()=>{
 if(active)return;const file=$('verifyFile').files[0];if(!expected||!file){status('Select the saved file first.');return;}
 busy(true);try{if(file.size!==expected.size)throw Error('Saved file size does not match.');const hash=new SHA256();for(let o=0;o<file.size;o+=CHUNK){hash.update(new Uint8Array(await file.slice(o,o+CHUNK).arrayBuffer()));status('Checking saved bytes…',Math.min(100,(o+CHUNK)/file.size*100));await pause(0);}if(hash.hex()!==expected.sha256)throw Error('Saved file SHA-256 does not match.');status('Saved copy verified: exact size and SHA-256 match.',100);}catch(e){status(e.message);}finally{busy(false);}
};
window.addEventListener('beforeunload',e=>{if(active){e.preventDefault();e.returnValue='';}});
