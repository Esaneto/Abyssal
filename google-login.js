'use strict';
/* Verify Google OpenID Connect ID tokens before granting an Abyssal session.
 * No Google profile may be linked to an existing password account by email alone.
 */
const crypto=require('node:crypto');
let jwksCache={expires:0,keys:[]};
async function googleKeys(){
 if(jwksCache.expires>Date.now()&&jwksCache.keys.length)return jwksCache.keys;
 const res=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(9000)});
 if(!res.ok)throw Error('google_keys_unavailable');
 const obj=await res.json();
 const keys=(Array.isArray(obj.keys)?obj.keys:[]).filter(k=>k.kty==='RSA'&&k.use==='sig'&&k.kid&&k.n&&k.e);
 if(!keys.length)throw Error('google_keys_empty');
 jwksCache={expires:Date.now()+Math.min(3600000,Math.max(60000,Number((res.headers.get('cache-control')||'').match(/max-age=(\d+)/)?.[1]||300)*1000)),keys};
 return keys;
}
function readPart(value){
 if(!/^[A-Za-z0-9_-]{1,12000}$/.test(value))throw Error('google_token_invalid');
 return JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
}
async function verifyGoogleIdToken(idToken,clientId){
 if(!clientId||!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId))throw Error('google_oauth_unconfigured');
 const parts=String(idToken||'').split('.');
 if(parts.length!==3||parts.some(p=>p.length>12000))throw Error('google_token_invalid');
 const [h,b,sig]=parts,header=readPart(h),payload=readPart(b);
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('google_token_invalid');
 const key=(await googleKeys()).find(k=>k.kid===header.kid&&k.alg!=='RS384');
 if(!key)throw Error('google_key_not_found');
 const valid=crypto.verify('RSA-SHA256',Buffer.from(h+'.'+b),crypto.createPublicKey({key,format:'jwk'}),Buffer.from(sig,'base64url'));
 if(!valid)throw Error('google_signature_invalid');
 const now=Math.floor(Date.now()/1000);
 if(!['accounts.google.com','https://accounts.google.com'].includes(payload.iss)||payload.aud!==clientId||
    !Number.isSafeInteger(payload.exp)||payload.exp<=now-30||
    !Number.isSafeInteger(payload.iat)||payload.iat>now+120||payload.iat<now-7200||
    !/^[0-9]{5,32}$/.test(String(payload.sub||''))||payload.email_verified!==true||
    typeof payload.email!=='string'||payload.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
   throw Error('google_claims_invalid');
 return {sub:payload.sub,email:payload.email.toLowerCase(),name:String(payload.name||'').slice(0,80)};
}
module.exports={verifyGoogleIdToken};
