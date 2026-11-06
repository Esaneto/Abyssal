(function(){
 function arrange(){
 const menu=document.getElementById('menuScreen');if(!menu||menu.querySelector('.abyss-orbit-nav,.abyss-orbit-navigation'))return;
 const ids=['shopBtn','rankingBtn','onlineBtn','playBtn','resonanceBtn','catalogBtn','profileBtn','wheelBtn','supportBtn'];
 const buttons=ids.map(id=>document.getElementById(id)).filter(b=>b&&menu.contains(b));
 // Include the remaining content actions without replacing their event listeners.
 for(const b of menu.querySelectorAll('.menu-secondary-actions button'))if(!buttons.includes(b))buttons.push(b);
 const nav=document.createElement('nav');nav.className='abyss-orbit-nav';nav.setAttribute('aria-label','Navegação ao redor da Fenda');
 buttons.forEach((b,i)=>{const angle=-170+i*340/Math.max(1,buttons.length-1),a=angle*Math.PI/180;b.style.setProperty('--orbit-x',(50+38*Math.sin(a))+'%');b.style.setProperty('--orbit-y',(57-29*Math.cos(a))+'%');b.style.setProperty('--orbit-angle',(-Math.sin(a)*22)+'deg');nav.appendChild(b);});menu.appendChild(nav);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrange);else arrange();
})();
