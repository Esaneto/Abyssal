const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Audio=require('../public/abyssal-sample-audio.js');
test('death cue uses supplied recorded audio and no synthetic generator',()=>{
 const asset=Audio.ASSETS.playerDeath;
 assert.equal(Audio.cueAsset('player-death'),'playerDeath');
 assert.equal(asset.file,'effects/morte_jogador.ogg');
 const b=fs.readFileSync('public/audio/'+asset.file);
 assert.equal(b.toString('ascii',0,4),'OggS');assert.ok(b.includes(Buffer.from('OpusHead')));
 assert.ok(asset.max<=.424);assert.equal(Audio.buildDeathCry,undefined);
 assert.ok(fs.readFileSync('public/offline-sw.js','utf8').includes('audio/'+asset.file));
});
