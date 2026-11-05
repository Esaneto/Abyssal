'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {calculateOrder,verifyStripeSignature,liveSalesReady,hasPurchaseResponsibilityAcceptance,PAID_SKINS,BOSS_SKINS,TERMS_VERSION}=require('../payments');

test('server catalog preserves the original BRL prices and discounted relic bundle',()=>{
 assert.equal(PAID_SKINS.violet.brl,390);assert.equal(PAID_SKINS.violet.testOnly,false);
 assert.deepEqual(
  ['reefshark','hammerhead','abysscroc','armoredgator'].map(id=>PAID_SKINS[id].brl),
  [590,590,690,690]
 );
 assert.deepEqual(
  ['angler','maw','aberration','leviathan','kraken','devourer'].map(id=>PAID_SKINS[id].brl),
  [1290,1490,1490,1690,1890,1990]
 );
 for(const id of ['abyssking','bloodmoon','abyssaleye','deepwarden'])assert.equal(PAID_SKINS[id],undefined,id);
 assert.equal(calculateOrder('violet',[],'brl').amount,390);
 assert.equal(calculateOrder('reefshark',[],'brl').amount,590);
 assert.equal(calculateOrder('boss_bundle',[],'brl').amount,6990);
 assert.equal(calculateOrder('boss_bundle',['leviathan'],'brl').amount,8150);
 assert.equal(calculateOrder('boss_bundle',['leviathan','kraken'],'brl').amount,6260);
 assert.equal(calculateOrder('boss_bundle',BOSS_SKINS,'brl').amount,0);
 assert.deepEqual(
  [PAID_SKINS.reefshark.name,PAID_SKINS.hammerhead.name,PAID_SKINS.abysscroc.name,PAID_SKINS.armoredgator.name],
  ['Tubarão-branco','Tubarão-martelo','Tubarão-Touro Estuarino','Caranguejo-Ferradura Couraçado']
 );
 assert.deepEqual(
  [PAID_SKINS.leviathan.name,PAID_SKINS.kraken.name,PAID_SKINS.aberration.name],
  ['Eco do Leviatã','Eco do Kraken','Casca da Aberração']
 );
 assert.throws(()=>calculateOrder('reefshark',[],'usd'),/Unsupported currency/);
 assert.throws(()=>calculateOrder('reefshark',[],'eur'),/Unsupported currency/);
 assert.match(TERMS_VERSION,/^\d{4}-\d{2}-\d{2}-v\d+$/);
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
