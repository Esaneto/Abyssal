'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),c=require('../public/abyssal-solo-cavern');
const rock={x:100,y:100,rx:30,ry:30,r:43,angle:0,vertices:[[-30,-30],[30,-30],[30,30],[-30,30]],cavernSolid:true};
test('orb beside rock gets local companion clearance without crossing rock',()=>{const p=c.orbWaterPoint([rock],400,400,132,100,17);assert.ok(p);assert.equal(c.isBlocked([rock],p.x,p.y,17),false);assert.ok(Math.hypot(p.x-132,p.y-100)<30);assert.equal(c.orbReachable([rock],{x:150,y:100,r:11},p,12),true);});
test('orb cannot be collected through solid rock',()=>assert.equal(c.orbReachable([rock],{x:131,y:100,r:70},{x:69,y:100},12),false));
test('open water orb remains unchanged',()=>assert.deepEqual(c.orbWaterPoint([rock],400,400,220,220,17),{x:220,y:220}));

test('an already trapped orb is relocated to navigable water',()=>{const p=c.orbWaterPoint([rock],400,400,100,100,17);assert.ok(p);assert.equal(c.isBlocked([rock],p.x,p.y,17),false);});

// The navigation grid must not relocate an exposed orb through a sealed rock.
test('wet orb in a narrow sealed corridor does not jump through a wall',()=>{
 const wall={x:20,y:200,rx:10,ry:200,r:201,angle:0,vertices:[[-10,-200],[10,-200],[10,200],[-10,200]],cavernSolid:true};
 assert.equal(c.isBlocked([wall],5,200,0),false);
 assert.equal(c.orbWaterPoint([wall],400,400,5,200,17),null);
});
test('safe approach relocates only orbs outside pickup reach or inside rock',()=>{
 const orb={x:132,y:100};
 assert.equal(c.orbNeedsRelocation([rock],orb,{x:150,y:100},11,12),false);
 assert.equal(c.orbNeedsRelocation([rock],orb,{x:170,y:100},11,12),true);
 assert.equal(c.orbNeedsRelocation([rock],orb,{x:70,y:50},11,12),false);
 assert.equal(c.orbNeedsRelocation([rock],{x:100,y:100},{x:150,y:100},11,12),true);
 assert.equal(c.orbNeedsRelocation([rock],orb,null,11,12),false);
});
