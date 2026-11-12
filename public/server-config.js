/* Single public endpoint for installed/native Abyssal builds.
 * Browser builds keep using window.location.origin. When infrastructure changes,
 * update this one value or inject ABYSSAL_NATIVE_SERVER_URL during the native build.
 */
(function(root){
  'use strict';
  const DEFAULT_NATIVE_SERVER_URL='https://abyssalgame.duckdns.org';
  const normalize=value=>{
    const raw=String(value||'').trim().replace(/\/+$/,'');
    if(!raw)return '';
    try{
      const url=new URL(raw);
      return url.protocol==='https:'?url.origin:'';
    }catch{return '';}
  };
  const meta=typeof document!=='undefined'?document.querySelector('meta[name="abyssal-native-server-url"]')?.content:'';
  const nativeUrl=normalize(root.ABYSSAL_NATIVE_SERVER_URL)||normalize(meta)||DEFAULT_NATIVE_SERVER_URL;
  root.ABYSSAL_SERVER_CONFIG=Object.freeze({nativeUrl});
})(window);
