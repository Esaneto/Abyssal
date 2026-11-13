'use strict';
const crypto=require('node:crypto');
const KEYS_URL='https://www.gstatic.com/admob/reward/verifier-keys.json';
const UNITS=Object.freeze({'abyssal-wheel':'4477711642','abyssal-revive':'1166132534'});
let keys=new Map(),keysAt=0,pending=null;
async function loadKeys(force=false){
 if(!force&&Date.now()-keysAt<3600000&&keys.size)return keys;
 if(pending)return pending;
 pending=(async()=>{const response=await fetch(KEYS_URL,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('key-http-'+response.status);const json=await response.json();const next=new Map();for(const item of json.keys||[]){if(item.pem)next.set(String(item.keyId),crypto.createPublicKey(item.pem));}if(!next.size)throw Error('no-admob-keys');keys=next;keysAt=Date.now();return keys;})().finally(()=>{pending=null;});
 return pending;
}
function parseCallback(raw){
 const query=String(raw||'');const marker=query.lastIndexOf('&signature=');
 if(marker<=0)throw Error('missing-signature');
 const content=query.slice(0,marker),tail=query.slice(marker+1);
 const match=/^signature=([A-Za-z0-9_-]+={0,2})&key_id=(\d+)$/.exec(tail);
 if(!match)throw Error('invalid-signature-fields');
 const params=new URLSearchParams(content);const seen=new Set();for(const [key] of params){if(seen.has(key))throw Error('duplicate-param');seen.add(key);}
 return {content,signature:Buffer.from(match[1],'base64url'),keyId:match[2],params};
}
async function verifyCallback(raw){
 const parsed=parseCallback(raw);let key=(await loadKeys()).get(parsed.keyId);if(!key)key=(await loadKeys(true)).get(parsed.keyId);
 if(!key||!crypto.verify('sha256',Buffer.from(parsed.content,'utf8'),key,parsed.signature))throw Error('invalid-admob-signature');
 return parsed.params;
}
module.exports={UNITS,parseCallback,verifyCallback};
