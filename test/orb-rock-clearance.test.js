'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),c=require('../public/abyssal-solo-cavern');
const rock={x:100,y:100,rx:30,ry:30,r:43,angle:0,vertices:[[-30,-30],[30,-30],[30,30],[-30,30]],cavernSolid:true};
test('orb beside rock gets local companion clearance without crossing rock',()=>{const p=c.orbWaterPoint([rock],400,400,132,100,17);assert.ok(p);assert.equal(c.isBlocked([rock],p.x,p.y,17),false);assert.ok(Math.hypot(p.x-132,p.y-100)<30);assert.equal(c.orbReachable([rock],{x:150,y:100,r:11},p,12),true);});
test('orb cannot be collected through solid rock',()=>assert.equal(c.orbReachable([rock],{x:131,y:100,r:70},{x:69,y:100},12),false));
test('open water orb remains unchanged',()=>assert.deepEqual(c.orbWaterPoint([rock],400,400,220,220,17),{x:220,y:220}));
