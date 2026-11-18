/* Public client ID contract. The ID string has the same shape for Web and
 * Android OAuth clients: application type must be verified in Google Cloud.
 * The ID provided by the Abyssal developer is kept as a deployment fallback.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalGoogleOauthConfig=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const USER_PROVIDED_CLIENT_ID='356475666791-b0m2248cgt80et9126c41br3mnk868v3.apps.googleusercontent.com';
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
 return Object.freeze({USER_PROVIDED_CLIENT_ID,RETIRED_CLIENT_ID,isWebClientId,normalizeWebClientId});
});
