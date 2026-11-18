'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {birthBand}=require('../auth-birthdate');
const now=new Date('2026-11-18T15:00:00Z');
test('registration birthday uses calendar birthdays and never infers invalid dates',()=>{
 assert.deepEqual(birthBand('2008-11-18',now),{age:18,band:'adult'});
 assert.deepEqual(birthBand('2008-11-19',now),{age:17,band:'teen'});
 assert.deepEqual(birthBand('2010-11-18',now),{age:16,band:'teen'});
 assert.deepEqual(birthBand('2010-11-19',now),{age:15,band:'under16'});
 for(const invalid of ['','2027-01-01','2010-02-29','1800-01-01','2020-13-02','1990-02-32',null]) assert.equal(birthBand(invalid,now),null);
});
