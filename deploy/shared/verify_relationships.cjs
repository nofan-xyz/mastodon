'use strict';
const {request,api,assert,mark,users}=require('./verify_rehearsal.cjs');
(async()=>{
 const path='/api/v1/accounts/relationships?id[]='+users.b.account_id;
 let before=await api('old',path,{user:'a'});assert(!before[0].blocking,'Fixture already blocked');
 await api('next','/api/v1/accounts/'+users.b.account_id+'/block',{method:'POST',user:'a'});
 try {
  const after=await api('old',path,{user:'a'});assert(after[0].blocking,'Warm 4.7 relationship cache did not reflect 5.0 block');
  mark('cross-version block invalidates the other Web cache');
 } finally {await api('next','/api/v1/accounts/'+users.b.account_id+'/unblock',{method:'POST',user:'a'});}
})().catch(e=>{console.error('FAIL '+e.message);process.exitCode=1;});
