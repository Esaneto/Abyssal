(() => {
'use strict';
function continuePendingOnlineStart(){
  if(!window.AbyssalOnlinePendingStart)return;
  window.AbyssalOnlinePendingStart=false;
  queueMicrotask(()=>window.AbyssalOnline?.showRooms?.());
}
window.addEventListener('abyssal-authenticated',continuePendingOnlineStart);
window.addEventListener('abyssal-room-joined',()=>{
  window.AbyssalOnlinePendingStart=false;
  const overlay=document.getElementById('maintenanceOverlay');
  if(overlay)overlay.hidden=true;
});
})();
