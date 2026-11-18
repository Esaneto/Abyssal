'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
test('google login verifies signature and claims, does not use unchecked email identity',()=>{
 const s=fs.readFileSync(require('node:path').resolve(__dirname,'../google-login.js'),'utf8');
 assert.match(s,/crypto\.verify\('RSA-SHA256'/);
 assert.match(s,/payload\.aud!==clientId/);
 assert.match(s,/payload\.email_verified!==true/);
 assert.match(s,/payload\.iss/);
 assert.doesNotMatch(s,/tokeninfo/);
});
