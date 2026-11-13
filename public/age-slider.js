(function(root){
 'use strict';
 function install(){
   const range=document.getElementById('ageYearsRange');
   const value=document.getElementById('ageYearsValue');
   const shell=document.getElementById('ageSliderShell');
   if(!range||!value||!shell||range.dataset.bound==='1')return;
   range.dataset.bound='1';
   const render=()=>{
     const n=Math.max(0,Math.min(100,Number(range.value)||0));
     value.textContent=n>=100?'100+':String(n);
   };
   const mark=()=>{
     shell.dataset.selected='true';
     range.dataset.userSelected='true';
     render();
     root.dispatchEvent(new CustomEvent('abyssal-age-selected',{detail:{age:Number(range.value)||0}}));
   };
   range.addEventListener('input',mark,{passive:true});
   range.addEventListener('change',mark,{passive:true});
   range.addEventListener('pointerdown',()=>{shell.dataset.selected='true';range.dataset.userSelected='true';},{passive:true});
   range.addEventListener('keydown',()=>{shell.dataset.selected='true';range.dataset.userSelected='true';});
   render();
   root.AbyssalAgeSlider={
     value:()=>Number(range.value)||0,
     selected:()=>range.dataset.userSelected==='true',
     reset:(age=18)=>{range.value=String(Math.max(0,Math.min(100,Number(age)||18)));range.dataset.userSelected='false';shell.dataset.selected='false';render();}
   };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
