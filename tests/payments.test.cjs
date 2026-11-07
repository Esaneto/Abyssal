'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {calculateOrder,verifyStripeSignature,liveSalesReady,hasPurchaseResponsibilityAcceptance,PAID_SKINS,BOSS_SKINS,TERMS_VERSION}=require('../payments');

test('server catalog uses only R$1.99 R$4.99 and R$9.99 skin prices',()=>{
 for(const id of ['violet','reefshark','hammerhead'])assert.equal(PAID_SKINS[id].brl,199,id);
 for(const id of ['saltcroc','blackcaiman','abysscroc','armoredgator','electriceellegacy'])assert.equal(PAID_SKINS[id].brl,499,id);
 for(const id of BOSS_SKINS)assert.equal(PAID_SKINS[id].brl,999,id);
 assert.equal(calculateOrder('electriceellegacy',[],'brl').amount,499);
 assert.equal(calculateOrder('boss_bundle',[],'brl').amount,5994);
 assert.equal(calculateOrder('boss_bundle',BOSS_SKINS,'brl').amount,0);
 assert.throws(()=>calculateOrder('reefshark',[],'usd'),/Unsupported currency/);
 assert.match(TERMS_VERSION,/^\\d{4}-\\d{2}-\\d{2}-v\\d+$/);
});
test('Stripe signature verification uses raw bytes, timestamp tolerance and constant-time digest comparison',()=>{
 const raw=Buffer.from('{"id":"evt_test","type":"checkout.session.completed"}'),secret='whsec_test_secret',timestamp=1_800_000_000;
 const signature=crypto.createHmac('sha256',secret).update(String(timestamp)+'.').update(raw).digest('hex');
 assert.equal(verifyStripeSignature(raw,`t=${timestamp},v1=${signature}`,secret,timestamp),true);
 assert.equal(verifyStripeSignature(Buffer.from(raw.toString()+' '),`t=${timestamp},v1=${signature}`,secret,timestamp),false);
 assert.equal(verifyStripeSignature(raw,`t=${timestamp},v1=${signature}`,secret,timestamp+301),false);
 assert.equal(verifyStripeSignature(raw,`t=${timestamp},v1=${'0'.repeat(64)}`,secret,timestamp),false);
});

test('live sales require a valid STRIPE_SECRET_KEY',()=>{
 const prev=process.env.STRIPE_SECRET_KEY;
 try{
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(liveSalesReady(),false,'must be false without STRIPE_SECRET_KEY');
  process.env.STRIPE_SECRET_KEY='not-a-key';
  assert.equal(liveSalesReady(),false,'must be false with invalid key format');
  process.env.STRIPE_SECRET_KEY='sk_test_abc123';
  assert.equal(liveSalesReady(),true,'must be true with valid test key');
  process.env.STRIPE_SECRET_KEY='sk_live_abc123';
  assert.equal(liveSalesReady(),true,'must be true with valid live key');
 }finally{if(prev===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=prev;}
});


test('purchase responsibility declaration is versioned and must be explicitly recorded',()=>{
 assert.equal(hasPurchaseResponsibilityAcceptance(null),false);
 assert.equal(hasPurchaseResponsibilityAcceptance({purchaseResponsibilityAcceptedVersion:TERMS_VERSION}),false);
 assert.equal(hasPurchaseResponsibilityAcceptance({purchaseResponsibilityAcceptedVersion:'old-version',purchaseResponsibilityAcceptedAt:new Date().toISOString()}),false);
 assert.equal(hasPurchaseResponsibilityAcceptance({purchaseResponsibilityAcceptedVersion:TERMS_VERSION,purchaseResponsibilityAcceptedAt:new Date().toISOString()}),true);
});
