'use strict';
// Runs inside the isolated streaming container. Never follows redirects to live sites.
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const WebSocket = createRequire(process.cwd() + '/package.json')('ws');
const users = JSON.parse(fs.readFileSync('/results/users.json'));
const nodes = {old: ['web47','nofan.xyz'], next: ['web50','beta.nofan.xyz']};
const checks = [];
function assert(value, message) { if (!value) throw new Error(message); }
function mark(name) { checks.push(name); console.log('PASS ' + name); }
function request(node, path, {method='GET', user, data, headers={}, jar}={}) {
  const [hostname, host] = nodes[node];
  const body = data === undefined ? undefined : (Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data));
  return new Promise((resolve,reject) => {
    const req = http.request({hostname,port:3000,path,method,headers:{Host:host,'X-Forwarded-Proto':'https',Origin:'https://'+host,...(user?{Authorization:'Bearer '+users[user].token}:{}),...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{}),...(jar?{Cookie:Object.entries(jar).map(([k,v])=>k+'='+v).join('; ')}:{}),...headers}},res=>{
      let text='';res.setEncoding('utf8');res.on('data',x=>text+=x);res.on('end',()=>{
        if(jar) for(const cookie of res.headers['set-cookie']||[]) {const first=cookie.split(';')[0]; const i=first.indexOf('=');jar[first.slice(0,i)]=first.slice(i+1);}
        let json;try{json=JSON.parse(text);}catch{}
        resolve({status:res.statusCode,headers:res.headers,text,json});
      });
    });req.setTimeout(20000,()=>req.destroy(new Error('HTTP timeout '+path)));req.on('error',reject);if(body)req.write(body);req.end();
  });
}
async function api(node,path,opts={}) {
  const r=await request(node,path,opts);
  assert(r.status>=200&&r.status<300, `${node} ${opts.method||'GET'} ${path} returned ${r.status}`);
  return r.json;
}
function totp(secret) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
  for(const c of secret.toUpperCase().replace(/=+$/,'')) bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
  const key=Buffer.from((bits.match(/.{8}/g)||[]).map(x=>parseInt(x,2)));
  const time=Buffer.alloc(8);time.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const h=crypto.createHmac('sha1',key).update(time).digest(),i=h[19]&15;
  return ((h.readUInt32BE(i)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
function csrf(html) {return html.match(/name="authenticity_token"[^>]*value="([^"]+)"/)?.[1] || html.match(/value="([^"]+)"[^>]*name="authenticity_token"/)?.[1];}
async function passwordLogin(node,user,otp) {
  const jar={};let r=await request(node,'/auth/sign_in',{jar});
  assert(r.status===200&&csrf(r.text),node+' login form unavailable');
  let body=new URLSearchParams({'authenticity_token':csrf(r.text),'user[email]':users[user].email,'user[password]':users[user].password});
  r=await request(node,'/auth/sign_in',{method:'POST',jar,data:body.toString(),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  if(otp) {
    if(r.status===302&&r.headers.location?.includes('/auth/sign_in')) r=await request(node,'/auth/sign_in',{jar});
    assert(r.text.includes('otp_attempt')&&csrf(r.text),node+' OTP challenge not shown');
    body=new URLSearchParams({'authenticity_token':csrf(r.text),'user[otp_attempt]':otp});
    r=await request(node,'/auth/sign_in',{method:'POST',jar,data:body.toString(),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  }
  const logged=r.status===302&&!/auth\/sign_in/.test(r.headers.location||'');
  if(logged) {
    const home=await request(node,'/home',{jar});
    assert(home.status===200&&home.text.includes('initial-state'),node+' authenticated home failed');
    for(const cookie of r.headers['set-cookie']||[]) assert(!/;\s*domain=/i.test(cookie),'Unexpected shared domain cookie');
  }
  return {logged,jar,status:r.status,location:r.headers.location};
}
async function main() {
  for(const node of Object.keys(nodes)) {
    const health=await request(node,'/health');assert(health.status===200,node+' health');
    const me=await api(node,'/api/v1/accounts/verify_credentials',{user:'a'});
    assert(me.id===users.a.account_id,node+' shared OAuth identity');
  }mark('both versions read the same account and OAuth token');
  await api('old','/api/v1/accounts/'+users.b.account_id+'/follow',{method:'POST',user:'a'});
  await api('next','/api/v1/accounts/'+users.a.account_id+'/follow',{method:'POST',user:'b'});
  mark('follows written from both versions');
  const socket=new WebSocket('ws://streaming:4000/api/v1/streaming/?stream=user',users.b.token,{origin:'https://beta.nofan.xyz'});
  const events=[];socket.on('message',raw=>{try{events.push(JSON.parse(raw.toString()));}catch{}});
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);setTimeout(()=>reject(new Error('Streaming handshake timeout')),10000).unref();});
  const unique='shared rehearsal '+crypto.randomUUID();
  const status=await api('old','/api/v1/statuses',{method:'POST',user:'a',data:{status:unique,visibility:'public'},headers:{'Idempotency-Key':unique}});
  assert(new URL(status.url).hostname==='nofan.xyz','Noncanonical status identity');
  const duplicate=await api('next','/api/v1/statuses',{method:'POST',user:'a',data:{status:unique,visibility:'public'},headers:{'Idempotency-Key':unique}});
  assert(duplicate.id===status.id,'Cross-version idempotency duplicated a post');mark('cross-version posts share canonical URLs and idempotency');
  let copy=await api('next','/api/v1/statuses/'+status.id,{user:'b'});assert(copy.content.includes(unique),'Post invisible across Webs');
  await api('next','/api/v1/statuses/'+status.id,{method:'PUT',user:'a',data:{status:unique+' edited'}});
  copy=await api('old','/api/v1/statuses/'+status.id,{user:'a'});assert(copy.content.includes('edited'),'Edit invisible');mark('5.0 edits visible through 4.7');
  for(const action of ['favourite','bookmark','reblog']) {
    await api('next',`/api/v1/statuses/${status.id}/${action}`,{method:'POST',user:'b'});
    const state=await api('old','/api/v1/statuses/'+status.id,{user:'b'});
    assert(state[{favourite:'favourited',bookmark:'bookmarked',reblog:'reblogged'}[action]],action+' invisible');
  }mark('favourites bookmarks and boosts visible across versions');
  for(const node of ['old','next']) {
    const name='Shared '+node+' '+Date.now();
    await api(node,'/api/v1/accounts/update_credentials',{method:'PATCH',user:'a',data:{display_name:name}});
    const me=await api(node==='old'?'next':'old','/api/v1/accounts/verify_credentials',{user:'a'});
    assert(me.display_name===name,'Profile update invisible');
  }mark('profile updates visible in both directions');
  const deadline=Date.now()+20000;
  while(Date.now()<deadline&&!events.some(x=>x.event==='update'&&JSON.parse(x.payload).id===status.id)) await new Promise(r=>setTimeout(r,250));
  assert(events.some(x=>x.event==='update'&&JSON.parse(x.payload).id===status.id),'New worker did not deliver legacy post to streaming');
  socket.close();mark('5.0 worker distributes 4.7 posts to authenticated streaming');
  const notifications=await api('old','/api/v1/notifications',{user:'a'});
  assert(notifications.some(x=>x.type==='favourite'&&x.status?.id===status.id),'Shared favourite notification missing');
  mark('background notifications visible on legacy Web');
  assert((await passwordLogin('old','a')).logged,'4.7 password login failed');
  assert((await passwordLogin('next','a')).logged,'5.0 password login failed');mark('same password logs in on both Webs with host-only sessions');
  const code=totp(users.b.otp_secret);
  assert((await passwordLogin('old','b',code)).logged,'Legacy TOTP login failed');
  assert(!(await passwordLogin('next','b',code)).logged,'TOTP replay accepted across versions');mark('TOTP works and replay is rejected across Webs');
  await api('old','/api/v1/statuses/'+status.id,{method:'DELETE',user:'a'});
  const gone=await request('next','/api/v1/statuses/'+status.id,{user:'a'});assert(gone.status===404,'Delete invisible');mark('deletes visible across versions');
  fs.writeFileSync('/tmp/shared-http-results.json',JSON.stringify({checks,completed_at:new Date().toISOString()},null,2));
}
module.exports = {request,api,assert,mark,users,nodes,passwordLogin};
if (require.main === module) main().catch(error=>{console.error('FAIL '+error.message);process.exitCode=1;}).finally(()=>setTimeout(()=>process.exit(process.exitCode||0),100).unref());

