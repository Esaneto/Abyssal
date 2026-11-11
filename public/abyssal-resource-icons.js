/* Original miniature illustrations for ocean minerals and exploration tools.
 * SVG is generated from a closed catalog, never from account or player input.
 * Shared by cockpit research requirements and the in-game backpack.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalResourceIcons=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const art=Object.freeze({
  abyssPickaxe:`<path d="M31 30 39 34 61 75 52 80Z" fill="#7d4c2d" stroke="#221c24" stroke-width="3"/><path d="m35 38 7 4 17 33-5 2Z" fill="#d39b59"/><path d="m11 18 9-8 32-1 14 8 6 11-12-3-9-7-10 6-20 4-9 9-8-8Z" fill="#203949" stroke="#a5eff6" stroke-width="3"/><path d="m11 18 11-7 9 2-4 11-15 12-8-7Z" fill="#59e6f4"/><path d="m29 12 20-3 4 10-12 6-17 3Z" fill="#80f2fd"/><path d="m51 10 14 8 7 10-14-3-10-7Z" fill="#3092ae"/><path d="m24 29 15-5 6 10-9 9-14-4Z" fill="#253b4e" stroke="#83b4c2" stroke-width="2"/><path d="m37 30 5-3 6 8-5 6Z" fill="#e5b265"/>`,
  polymetallicNodule:`<path d="M11 50Q5 34 20 24L42 19 63 29 70 48 58 63 28 67Z" fill="#303c4b" stroke="#9cabb3" stroke-width="3"/><g fill="#647e88" stroke="#bdc5bd" stroke-width="1.5"><circle cx="20" cy="43" r="12"/><circle cx="38" cy="36" r="14"/><circle cx="56" cy="44" r="11"/><circle cx="38" cy="56" r="12"/><circle cx="61" cy="58" r="8"/><circle cx="18" cy="60" r="7"/></g><g fill="#e4bd71"><circle cx="27" cy="38" r="3"/><circle cx="46" cy="30" r="3"/><circle cx="49" cy="58" r="3"/><circle cx="17" cy="56" r="2.5"/></g>`,
  ferromanganeseCrust:`<path d="m7 51 14-23 37-9 15 11-4 30-43 14Z" fill="#1b2635" stroke="#78909f" stroke-width="3"/><path d="m21 28 37-9 15 11-37 9Z" fill="#46546b"/><path d="m11 46 43-7 16 8-43 9Z" fill="#85809e"/><path d="m7 56 42-7 18 7-41 10Z" fill="#262d46"/><path d="m28 35 11-4 11 1M22 61l32-4" fill="none" stroke="#c3b9da" stroke-width="3"/>`,
  phosphorite:`<path d="m8 55 6-17 14-11 24-5 18 18-4 22-25 13-25-6Z" fill="#796c56" stroke="#e7c994" stroke-width="3"/><path d="m19 40 13-12 15-4 10 14-6 13-24 4Z" fill="#d9be8d"/><g fill="#f4dfb2" stroke="#ad8b5a" stroke-width="2"><circle cx="22" cy="54" r="10"/><circle cx="47" cy="52" r="9"/><circle cx="37" cy="36" r="8"/><circle cx="61" cy="43" r="7"/></g><path d="m15 66 18 6 28-9" fill="none" stroke="#a28252" stroke-width="3"/>`,
  hydrothermalSulfide:`<path d="m11 68 12-20 10 5 3-33 11-5 9 29 10-7 7 28-22 11Z" fill="#3b323c" stroke="#a07b61" stroke-width="3"/><path d="m26 56 8-31 9 10-3 32ZM46 62l3-35 13 29Z" fill="#72544f"/><g fill="#f3ab49"><path d="m15 58 9-19 6 15-6 14Z"/><path d="m52 49 10-20 7 32-14 7Z"/></g><g fill="#ffde77"><circle cx="38" cy="16" r="3"/><circle cx="61" cy="21" r="4"/><circle cx="42" cy="53" r="3"/></g>`,
  oilSeep:`<path d="M40 9C31 27 17 38 17 52a23 23 0 0 0 46 0C63 38 49 27 40 9Z" fill="#111824" stroke="#cdac79" stroke-width="3"/><path d="M35 22Q18 43 27 58" fill="none" stroke="#7d8b91" stroke-width="4" stroke-linecap="round"/><path d="M34 68Q55 74 59 54" fill="none" stroke="#4c7782" stroke-width="4"/>`,
  gasSeep:`<g fill="#234c62" stroke="#8de9de" stroke-width="3"><circle cx="42" cy="53" r="19"/><circle cx="19" cy="35" r="10"/><circle cx="55" cy="21" r="12"/><circle cx="28" cy="15" r="5"/></g><g fill="#d4faff"><circle cx="35" cy="45" r="5"/><circle cx="14" cy="30" r="3"/><circle cx="50" cy="16" r="3"/></g>`,
  emptyCylinder:`<rect x="26" y="14" width="29" height="57" rx="7" fill="#213c50" stroke="#afcbcf" stroke-width="4"/><path d="M29 49h23v14H29Z" fill="#63899b"/><path d="M36 8h10v7H36Z" fill="#a4c4d3"/><path d="M41 8V4" stroke="#cadbe2" stroke-width="4"/>`,
  oilCylinder:`<rect x="26" y="14" width="29" height="57" rx="7" fill="#213c50" stroke="#b8cbd2" stroke-width="4"/><path d="M29 33h23v30H29Z" fill="#121a25"/><path d="M36 8h10v7H36Z" fill="#a4c4d3"/><path d="M41 8V4" stroke="#cadbe2" stroke-width="4"/><path d="M32 40v15" stroke="#879ba3" stroke-width="3"/>`,
  gasCylinder:`<rect x="26" y="14" width="29" height="57" rx="7" fill="#213c50" stroke="#b8cbd2" stroke-width="4"/><path d="M29 33h23v30H29Z" fill="#26866f"/><path d="M36 8h10v7H36Z" fill="#a4c4d3"/><g fill="#baffd8"><circle cx="37" cy="49" r="3"/><circle cx="46" cy="39" r="2.4"/><circle cx="43" cy="59" r="2"/></g>`,
  seaMineral:`<path d="m12 56 12-28 23-16 23 22-8 28-30 12Z" fill="#274a5b" stroke="#9be4ef" stroke-width="3"/><path d="m24 28 23-16 4 35-19 27Z" fill="#65cbd9"/><path d="m47 12 23 22-19 13Z" fill="#a3f5f6"/>`,
  abyssWeapon:`<path d="M12 42L44 26 56 31 46 39 28 44 21 54 13 52 18 42Z" fill="#1b2a38" stroke="#8ae9f5" stroke-width="2.5"/><path d="M22 36L52 23" stroke="#7cf5ff" stroke-width="3.5"/><path d="M48 27L68 22" stroke="#e0fcff" stroke-width="4.5"/><path d="M28 43L22 55" stroke="#d6a56b" stroke-width="4"/><circle cx="68" cy="22" r="3" fill="#7bf3f0"/>`,
  medkitCanister:`<rect x="25" y="16" width="30" height="52" rx="8" fill="#143428" stroke="#48d698" stroke-width="3.5"/><rect x="29" y="30" width="22" height="30" rx="4" fill="#1f543e"/><path d="M40 37V53M32 45H48" stroke="#8effc3" stroke-width="4.5" stroke-linecap="round"/><rect x="33" y="10" width="14" height="6" rx="2" fill="#88cfaf"/>`
 });
 const aliases=Object.freeze({oil:'oilSeep',gas:'gasSeep'});
 function svg(input){
  const id=aliases[input]||input;
  const body=art[id]||art.seaMineral;
  return '<svg class="abyss-resource-graphic" viewBox="0 0 80 84" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+body+'</svg>';
 }
 return Object.freeze({svg,has:id=>Object.prototype.hasOwnProperty.call(art,aliases[id]||id)});
});
