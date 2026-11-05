const test=require('node:test'),assert=require('node:assert/strict');
const {species}=require('../public/marine-species');
const abilities=require('../skin-abilities');
const {calculateOrder}=require('../payments');
test('100 marine additions have unique identities, applied traits and authoritative prices',()=>{
 assert.equal(species.length,100);assert.equal(new Set(species.map(s=>s.id)).size,100);assert.equal(new Set(species.map(s=>s.name)).size,100);
 const methods={damage:'damageMultiplier',defense:'incomingDamageMultiplier',movement:'movementMultiplier',range:'targetRangeMultiplier',fireRate:'fireRateMultiplier',experience:'orbExperienceMultiplier',magnet:'magnetRangeMultiplier'};
 for(const s of species){assert.notEqual(abilities[methods[s.stat]](s.id),1);assert.ok(s.price>0);if(s.paid)assert.doesNotThrow(()=>calculateOrder(s.id,[]));else assert.throws(()=>calculateOrder(s.id,[]));}
});
