/* Public OAuth client-type contract shared by Node and every native/web shell.
 * The Android client is not a Google Identity Services Web client and must never
 * be sent as the web audience for Google ID tokens.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalGoogleOauthConfig=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const ANDROID_PLAY_CLIENT_ID='356475666791-b0m2248cgt80et9126c41br3mnk868v3.apps.googleusercontent.com';
 const validFormat=value=>/^[0-9]{6,}-[a-z0-9]+[.]apps[.]googleusercontent[.]com$/i.test(String(value||'').trim());
 function isWebClientId(value){
  const id=String(value||'').trim();
  return validFormat(id)&&id!==ANDROID_PLAY_CLIENT_ID;
 }
 function normalizeWebClientId(value){
  const id=String(value||'').trim();
  return isWebClientId(id)?id:'';
 }
 return Object.freeze({ANDROID_PLAY_CLIENT_ID,isWebClientId,normalizeWebClientId});
});
