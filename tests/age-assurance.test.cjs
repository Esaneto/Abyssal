'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {deriveAgeStatus,deriveStripeAgeOutcome,stripeTestKey}=require('../age-assurance');

test('age status validates dates and calculates legal adulthood on UTC birthday',()=>{
 const now=new Date('2026-10-31T12:00:00.000Z');
 assert.equal(deriveAgeStatus({year:2008,month:10,day:31},now),'adult');
 assert.equal(deriveAgeStatus({year:2008,month:11,day:1},now),'minor');
 assert.equal(deriveAgeStatus({year:2010,month:2,day:29},now),null);
 assert.equal(deriveAgeStatus({year:2027,month:1,day:1},now),null);
 assert.equal(deriveAgeStatus(null,now),null);
});

test('Stripe document verification supplies the age-majority outcome without DOB access',()=>{
 assert.equal(deriveStripeAgeOutcome({type:'document',status:'verified'}),'adult');
 assert.equal(deriveStripeAgeOutcome({type:'document',status:'requires_input',last_error:{code:'under_supported_age'}}),'minor');
 assert.equal(deriveStripeAgeOutcome({type:'document',status:'requires_input',last_error:{code:'document_unverified_other'}}),null);
 assert.equal(deriveStripeAgeOutcome({type:'id_number',status:'verified'}),null);
 assert.equal(deriveStripeAgeOutcome(null),null);
});

test('age assurance accepts only explicit Stripe test secret keys',()=>{
 assert.equal(stripeTestKey('sk_test_abc123'),true);
 assert.equal(stripeTestKey('rk_test_abc123'),false);
 assert.equal(stripeTestKey('sk_live_abc123'),false);
 assert.equal(stripeTestKey('rk_live_abc123'),false);
 assert.equal(stripeTestKey('sk_test_'),false);
});
