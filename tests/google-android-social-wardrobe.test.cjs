'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('Android uses server-approved Web audience and native Credential Manager errors are distinguishable',()=>{
 const src=read('public/online.js'),native=read('scripts/configure-android.cjs');
 new vm.Script(src,{filename:'online.js'});
 new vm.Script(native,{filename:'configure-android.cjs'});
 assert.match(src,/resolveWebClientId\?\.\(''\)/);
 assert.match(src,/getPlatform\?\.\(\)==='android'/);
 for(const code of ['GOOGLE_CANCELLED','GOOGLE_NO_CREDENTIAL','GOOGLE_PROVIDER_UNAVAILABLE','GOOGLE_CONFIG_ERROR','GOOGLE_INVALID_TOKEN']){
  assert.match(src,new RegExp(code));
  assert.match(native,new RegExp(code));
 }
 assert.match(native,/registerPlugin\(AbyssalGooglePlugin.class\)/);
 assert.match(native,/CredentialManager\.create/);
 assert.match(native,/getCredentialAsync/);
 assert.match(native,/GetSignInWithGoogleOption/);
 const oauth=require('../public/google-oauth-config.js');
 assert.equal(oauth.resolveWebClientId('').clientId,oauth.WEB_CLIENT_ID);
 assert.notEqual(oauth.WEB_CLIENT_ID,oauth.ANDROID_PLAY_CLIENT_ID);
});

test('social owns code redemption directly; shop legacy event IDs stay hidden',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js'),html=read('public/index.html');
 assert.match(runtime,/station:'cabine',name:'MERGULHAR'/);
 assert.match(runtime,/'RESGATAR CÓDIGO','Troque códigos promocionais por recompensas.',openEchoRedeem/);
 assert.match(runtime,/function openEchoRedeem\(\)\{[\s\S]*?\$\('openRedeemCodeBtn'\)\?\.click\(\)/);
 assert.doesNotMatch(runtime,/function openEchoRedeem\(\)\{\s*if\(!openEchoCatalog/);
 assert.match(html,/id="openRedeemCodeBtn"[^>]*hidden aria-hidden="true"/);
 assert.match(html,/id="shopRedeemShortcut"[^>]*hidden aria-hidden="true"/);
 assert.match(html,/id="shopCurrency" type="hidden" value="brl"/);
 assert.doesNotMatch(html,/Moeda de cobrança|BRL · Real/);
 assert.match(html,/id="redeemCodeBackBtn"[^>]*>VOLTAR AO SOCIAL/);
});

test('wardrobe preview has bounded high-DPI output and saves only on explicit action',()=>{
 const src=read('public/avatar-wardrobe.js');
 new vm.Script(src,{filename:'avatar-wardrobe.js'});
 assert.match(src,/thumb\.width=280;thumb\.height=280/);
 assert.match(src,/tc\.setTransform\(2,0,0,2,0,0\)/);
 assert.match(src,/pixelCap=Math\.sqrt\(3200000\/\(rect\.width\*rect\.height\)\)/);
 assert.match(src,/Math\.max\(2,window\.devicePixelRatio\|\|1\)/);
 assert.match(src,/ctx\.imageSmoothingQuality='high'/);
 assert.match(src,/save\.onclick=\(\)=>/);
 assert.doesNotMatch(src,/choice\.onclick=.*base\.apply\(/);
});
