/* Public Google OAuth client IDs identified by their type in the user's
 * Google Auth Platform project. This is NOT a secret. Do not confuse the
 * Android Play Store OAuth client with the Web audience used by GIS and
 * Credential Manager / GetSignInWithGoogleOption.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalGoogleOauthConfig=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const WEB_CLIENT_ID='356475666791-t5tfa24kg31qad3r1b5h4ecusvachjv6.apps.googleusercontent.com';
 const ANDROID_PLAY_CLIENT_ID='356475666791-b0m2248cgt80et9126c41br3mnk868v3.apps.googleusercontent.com';
 // The source-of-truth Web client ID was copied by the owner directly from
 // Google Cloud. The old identifier mistakenly used a lowercase 'l' instead
 // of the digit '1' in the sequence 'kg31qad'.
 const PREVIOUS_MISTYPED_WEB_ID='356475666791-t6tfa24kg3iqad3r1b5h4ecusvachjv6.apps.googleusercontent.com';
 const PREVIOUS_LETTER_L_WEB_ID='356475666791-t5tfa24kg3lqad3r1b5h4ecusvachjv6.apps.googleusercontent.com';
 const validFormat=value=>/^[0-9]{6,}-[a-z0-9]+[.]apps[.]googleusercontent[.]com$/i.test(String(value||'').trim());
 function isWebClientId(value){
  const id=String(value||'').trim();
  return validFormat(id)&&id!==ANDROID_PLAY_CLIENT_ID&&id!==PREVIOUS_MISTYPED_WEB_ID&&id!==PREVIOUS_LETTER_L_WEB_ID;
 }
 function normalizeWebClientId(value){
  const id=String(value||'').trim();
  return isWebClientId(id)?id:'';
 }
 function resolveWebClientId(configuredId){
  const raw=String(configuredId||'').trim();
  const valid=normalizeWebClientId(raw);
  // Production is usable on a fresh deployment and after old incorrect envs:
  // both Web and native Android must use the same registered Web client.
  return Object.freeze({
   clientId:valid||WEB_CLIENT_ID,
   source:valid?'environment':raw?'recovered-project-web':'project-web',
   corrected:Boolean(raw&&!valid)
  });
 }
 return Object.freeze({WEB_CLIENT_ID,ANDROID_PLAY_CLIENT_ID,PREVIOUS_MISTYPED_WEB_ID,PREVIOUS_LETTER_L_WEB_ID,
  isWebClientId,normalizeWebClientId,resolveWebClientId});
});
