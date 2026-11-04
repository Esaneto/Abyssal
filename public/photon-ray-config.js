/* Single source of truth for the Photon Ray's shared presentation and pulse cadence. */
(function(root,factory){
 const config=factory();
 if(typeof module==='object'&&module.exports)module.exports=config;
 if(root)root.AbyssalPhotonRay=config;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 return Object.freeze({
  color:'#ff8df4',
  duration:.09,
  pulseInterval:.25,
  remoteHold:.32,
  widths:Object.freeze([0,2.4,4,6]),
  maxLevel:3
 });
});
