'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Codec=require('../public/net-codec');
test('binary input is fixed 20 bytes and round-trips',()=>{const b=Codec.input(42,123.5,456.25,-1.2);assert.equal(b.byteLength,20);const d=Codec.readInput(b);assert.equal(d.seq,42);assert.ok(Math.abs(d.x-123.5)<.001);assert.ok(Math.abs(d.y-456.25)<.001);assert.ok(Math.abs(d.angle+1.2)<.001);});
test('binary reconcile is fixed 16 bytes and preserves blocked flag',()=>{const b=Codec.reconcile(9,10.5,20.25,true);assert.equal(b.byteLength,16);const d=Codec.readReconcile(b);assert.equal(d[0],9);assert.equal(d[3],true);});
test('binary player motion is 4 byte header plus 16 bytes per peer',()=>{const b=Codec.playerMotion([[7,10,20,.5],[8,30,40,-.5]]);assert.equal(b.byteLength,36);const d=Codec.readPlayerMotion(b);assert.equal(d.length,2);assert.equal(d[0][0],7);assert.equal(d[1][0],8);});
test('codec rejects wrong version and malformed frames',()=>{const b=Codec.input(1,2,3,4),v=new Uint8Array(b);v[0]=99;assert.equal(Codec.readInput(b),null);assert.equal(Codec.readReconcile(new ArrayBuffer(3)),null);});

test('player motion supports maximum one-byte batch count safely',()=>{const rows=Array.from({length:300},(_,i)=>[i+1,i,i*2,.25]);const b=Codec.playerMotion(rows),d=Codec.readPlayerMotion(b);assert.equal(d.length,255);assert.equal(b.byteLength,4+255*16);});
