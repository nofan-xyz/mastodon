'use strict';
const crypto=require('node:crypto');
const {request,assert,mark}=require('./verify_rehearsal.cjs');
function token(html){return html.match(/name="authenticity_token"[^>]*value="([^"]+)"/)?.[1];}
(async()=>{
 const jars={old:{},next:{}};const tokens={};
 const forwarded={'X-Forwarded-For':'198.18.19.21'};
 for(const node of ['old','next']) {const r=await request(node,'/auth/sign_in',{jar:jars[node],headers:forwarded});tokens[node]=token(r.text);assert(tokens[node],'Login token missing');}
 const email='no-such-'+crypto.randomUUID()+'@example.invalid';
 let blocked;
 for(let i=0;i<26;i++) {
   const node=i%2?'next':'old';
   const data=new URLSearchParams({'authenticity_token':tokens[node],'user[email]':email,'user[password]':'invalid-fixture-password'}).toString();
   const r=await request(node,'/auth/sign_in',{method:'POST',jar:jars[node],data,headers:{...forwarded,'Content-Type':'application/x-www-form-urlencoded'}});
   assert(i===25||r.status!==429,'Throttle triggered before the new test budget');
   if(i===25)blocked=r;
 }
 assert(blocked.status===429,'Two Webs granted separate login attempt budgets');
 assert(blocked.headers['x-ratelimit-limit']==='25','Unexpected login limit');
 mark('25 login attempts shared across 4.7 and 5.0; 26th rejected');
})().catch(e=>{console.error('FAIL '+e.message);process.exitCode=1;});
