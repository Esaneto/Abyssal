const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('portrait Android keyboard resize preserves physical orientation without blocking',()=>{
 const classes=new Set(),listeners={},gate={},field={matches:()=>true,disabled:false,readOnly:false,getBoundingClientRect:()=>({top:10,bottom:50})};
 const html={classList:{add:(...k)=>k.forEach(x=>classes.add(x)),toggle:(k,v)=>v?classes.add(k):classes.delete(k),remove:(...k)=>k.forEach(x=>classes.delete(x))},style:{setProperty(){},removeProperty(){}}};
 const document={readyState:'complete',activeElement:field,documentElement:html,querySelector:()=>null,body:{appendChild(){}},createElement:()=>({...gate,setAttribute(){}}),addEventListener(){}};
 const window={innerWidth:390,innerHeight:250,dispatchEvent(){},screen:{width:390,height:844,orientation:{type:'portrait-primary'}},addEventListener:(k,f)=>listeners[k]=f};
 vm.runInNewContext(fs.readFileSync('public/mobile-portrait.js','utf8'),{window,document,navigator:{userAgent:'Android Mobile'},setTimeout:()=>1,clearTimeout(){},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 assert.equal(window.AbyssalMobileOrientation.blocked,false);assert.ok(classes.has('abyssal-mobile-editing'));assert.ok(!classes.has('abyssal-handheld-landscape'));
 window.screen.orientation.type='landscape-primary';listeners.resize();assert.equal(window.AbyssalMobileOrientation.blocked,false);assert.ok(classes.has('abyssal-handheld-landscape'));
 window.screen.orientation.type='portrait-primary';document.activeElement=null;window.innerHeight=844;listeners.resize();assert.equal(window.AbyssalMobileOrientation.blocked,false);assert.ok(!classes.has('abyssal-mobile-editing'));
});
