/* Client ID format contract. A syntactically valid ID is not proof of an
 * existing Google OAuth client; only the Google Cloud credentials list can
 * confirm registration and client type. No hardcoded production fallback.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalGoogleOauthConfig=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const RETIRED_CLIENT_ID='356475666791-t6tfa24kg3iqad3r1b5h4ecusvachjv6.apps.googleusercontent.com';
 const validFormat=value=>/^[0-9]{6,}-[a-z0-9]+[.]apps[.]googleusercontent[.]com$/i.test(String(value||'').trim());
 // Structural validation only. Real Web/Android client type is checked in Google Cloud.
 function isWebClientId(value){
  const id=String(value||'').trim();
  return validFormat(id)&&id!==RETIRED_CLIENT_ID;
 }
 function normalizeWebClientId(value){
  const id=String(value||'').trim();
  return isWebClientId(id)?id:'';
 }
 return Object.freeze({RETIRED_CLIENT_ID,isWebClientId,normalizeWebClientId});
});
