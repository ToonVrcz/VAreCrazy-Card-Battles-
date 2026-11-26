import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const wrap=document.querySelector('.scene-wrap');
const canvas=document.querySelector('#arena3d');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lowEffects=reduced;
let renderer,scene,camera,raf=0;
const toggle=document.querySelector('#motionToggle');

function material(color,roughness=.78,metalness=.12){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
function box(parent,w,h,d,x,y,z,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
function cylinder(parent,rt,rb,h,x,y,z,mat,segments=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat);m.position.set(x,y,z);parent.add(m);return m;}
function sphere(parent,r,x,y,z,mat){const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),mat);m.position.set(x,y,z);parent.add(m);return m;}
function createSeatCharacter(parent,x,z,hair,coat,scale=1,style='classic'){
 const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
 const stone=material('#57465f'),cloth=material(coat),skin=material('#d0a184'),hairMat=material(hair),gold=material('#d1ae6a',.42,.55),dark=material('#211a2a');
 // Individual throne with a high back, carved crest and arm rests.
 box(g,.98,.16,.72,0,.69,0,stone);box(g,.82,.78,.18,0,1.05,-.25,stone);
 box(g,.88,.08,.74,0,1.45,-.23,gold);
 box(g,.17,.38,.62,-.48,.88,.02,stone);box(g,.17,.38,.62,.48,.88,.02,stone);
 // Seated body, shoulders and folded legs.
 const torso=box(g,.62,.62,.38,0,1.14,.08,cloth);torso.rotation.x=-.08;
 sphere(g,.35,0,1.39,.05,cloth);
 box(g,.18,.18,.1,0,1.43,.27,gold);
 const legL=box(g,.25,.2,.56,-.18,.78,.42,cloth);legL.rotation.x=-.12;
 const legR=box(g,.25,.2,.56,.18,.78,.42,cloth);legR.rotation.x=-.12;
 box(g,.24,.12,.24,-.18,.69,.72,dark);box(g,.24,.12,.24,.18,.69,.72,dark);
 // Head, neck, ears, eyes and a small nose create a readable front-facing seated pose.
 cylinder(g,.12,.13,.18,0,1.48,.08,skin,12);
 sphere(g,.245,0,1.73,.12,skin);
 sphere(g,.055,-.245,1.72,.12,skin);sphere(g,.055,.245,1.72,.12,skin);
 sphere(g,.025,-.085,1.77,.326,dark);sphere(g,.025,.085,1.77,.326,dark);
 box(g,.045,.06,.025,0,1.69,.354,skin);
 // Hair silhouette differs by crew member.
 if(style==='toon'){
  sphere(g,.25,0,1.91,.08,hairMat);
  for(const [dx,dy,dz,rz] of [[-.16,.04,.06,-.45],[-.07,.12,.03,-.2],[.05,.15,.02,.1],[.17,.07,.02,.42]]){
   const spike=new THREE.Mesh(new THREE.ConeGeometry(.105,.32,7),hairMat);spike.position.set(dx,1.94+dy,dz);spike.rotation.z=rz;g.add(spike);
  }
 }else if(style==='add'){
  sphere(g,.25,0,1.91,.08,hairMat);
  const fringe=box(g,.34,.11,.16,0,1.84,.28,hairMat);fringe.rotation.z=-.16;
  sphere(g,.12,.2,1.84,.04,hairMat);
 }else if(style==='nu'){
  sphere(g,.26,0,1.91,.07,hairMat);
  const hood=new THREE.Mesh(new THREE.SphereGeometry(.29,12,9,0,Math.PI*2,0,Math.PI*.68),hairMat);hood.position.set(0,1.78,.04);g.add(hood);
  box(g,.43,.08,.08,0,1.84,.29,gold);
 }else{
  sphere(g,.25,0,1.91,.08,hairMat);
  const swept=box(g,.36,.12,.18,.05,1.86,.25,hairMat);swept.rotation.z=.18;
  const side=new THREE.Mesh(new THREE.ConeGeometry(.09,.28,7),hairMat);side.position.set(.22,1.72,.12);side.rotation.z=-.3;g.add(side);
 }
 // Arms rest on the throne; hands point naturally toward the battlefield.
 const armL=box(g,.15,.43,.17,-.39,1.12,.1,cloth);armL.rotation.z=-.24;
 const armR=box(g,.15,.43,.17,.39,1.12,.1,cloth);armR.rotation.z=.24;
 sphere(g,.085,-.4,.91,.2,skin);sphere(g,.085,.4,.91,.2,skin);
 // Costume trim, shoulder pieces and individual chest emblem.
 box(g,.09,.5,.04,-.25,1.13,.285,gold);box(g,.09,.5,.04,.25,1.13,.285,gold);
 const emblem=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),gold);emblem.position.set(0,1.18,.32);g.add(emblem);
 const cape=box(g,.7,.54,.07,0,1.1,-.18,dark);cape.rotation.x=-.08;
 return g;
}
function buildScene(){
 scene=new THREE.Scene();scene.background=new THREE.Color('#100a18');scene.fog=new THREE.Fog('#100a18',17,42);
 camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,10.5,23.5);camera.lookAt(0,1.65,-1.7);
 const hemi=new THREE.HemisphereLight('#d7c2ee','#170e20',lowEffects?.85:1.15);scene.add(hemi);
 const key=new THREE.DirectionalLight('#ffe0a3',lowEffects?1.15:2.0);key.position.set(-7,12,7);scene.add(key);key.castShadow=!lowEffects;key.shadow.mapSize.set(1024,1024);scene.add(key.target);
 const fill=new THREE.PointLight('#8f54c2',lowEffects?1:2.4,22);fill.position.set(0,5,-5);scene.add(fill);
 const gold=material('#9d7947',.42,.55),dark=material('#21172b'),floor=material('#30233a'),violet=material('#4a2b5e'),trim=material('#c2a064',.38,.7);
 // Ground and raised octagonal arena dais
 const ground=new THREE.Mesh(new THREE.CylinderGeometry(14,14,.45,8),dark);ground.position.y=-.45;ground.rotation.y=Math.PI/8;scene.add(ground);
 const dais=new THREE.Mesh(new THREE.CylinderGeometry(8.2,8.8,.65,8),floor);dais.position.set(0,-.05,0);dais.rotation.y=Math.PI/8;scene.add(dais);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(7.95,.11,8,8),trim);rim.rotation.x=Math.PI/2;rim.position.y=.32;scene.add(rim);
 const board=box(scene,11,.22,8,0,.38,.1,violet);board.material=material('#30203d');
 for(let i=-4;i<=4;i+=2){box(scene,.025,.012,7.6,i,.5,.1,trim);}
 for(let z=-3;z<=3;z+=2){box(scene,10,.012,.025,0,.5,z,trim);}
 // outer columns and arches / ornamental pillars
 for(let x of [-7.5,7.5])for(let z of [-4.5,3.5]){
  cylinder(scene,.35,.48,5,x,2.35,z,gold,12);cylinder(scene,.52,.52,.22,x,4.9,z,trim,12);cylinder(scene,.5,.5,.18,x,-.1,z,trim,12);
 }
 // rear spectator balcony, tiered seating
 box(scene,13,.35,2.4,0,2.15,-7.1,dark);box(scene,13,.22,.25,0,2.42,-8.15,trim);
 for(let i=0;i<4;i++){box(scene,12-i*.45,.18,.72,0,2.45+i*.38,-7.7-i*.23, i%2?violet:floor);}
 // back wall and crest
 box(scene,13,5,.38,0,4.1,-9.0,dark);
 const crest=new THREE.Mesh(new THREE.TorusGeometry(1.05,.07,8,6),trim);crest.position.set(0,4.7,-8.75);scene.add(crest);
 cylinder(scene,.3,.3,.14,0,4.7,-8.6,trim,6);
 // seated crew: varied scale and costume silhouettes
 const crew=new THREE.Group();scene.add(crew);
 createSeatCharacter(crew,-4.25,-7.05,'#b52f43','#71354f',1,'toon');
 createSeatCharacter(crew,-1.42,-7.05,'#d6ad55','#80602e',1,'add');
 createSeatCharacter(crew,1.42,-7.05,'#4f91c8','#294e72',1,'nu');
 createSeatCharacter(crew,4.25,-7.05,'#8864c1','#4b326d',1,'ball');
 // floating braziers and flame-like glow spheres
 for(const x of [-6.2,6.2]){cylinder(scene,.18,.25,1.1,x,3.0,-6.0,gold,10);sphere(scene,.22,x,3.72,-6.0,material('#e3a34e',.3,.1));}
 // subtle floor rings
 for(let r of [5.5,6.3]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.025,6,8),gold);ring.rotation.x=Math.PI/2;ring.position.y=.53;scene.add(ring);}
 return {crew,fill,key};
}
let sceneBits;
function resize(){if(!renderer||!camera)return;const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.position.z=window.innerWidth<480?30:window.innerWidth<800?27:23.5;camera.position.y=window.innerWidth<480?15:window.innerWidth<800?13:10.5;camera.lookAt(0,1.65,-1.7);camera.updateProjectionMatrix();}
function animate(){raf=requestAnimationFrame(animate);if(!lowEffects&&sceneBits){sceneBits.fill.intensity=2.2+Math.sin(performance.now()*.0007)*.18;sceneBits.crew.position.y=Math.sin(performance.now()*.0008)*.025;}renderer.render(scene,camera);}
function init(){
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:!lowEffects,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowEffects?1:1.35));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=!lowEffects;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  sceneBits=buildScene();resize();
  if(!lowEffects)animate();else renderer.render(scene,camera);
  window.addEventListener('resize',resize,{passive:true});
 }catch(err){console.error('3D arena init failed',err);wrap.classList.add('failed');}
}
function setLowEffects(value){lowEffects=value;toggle.textContent='LOW EFFECTS: '+(lowEffects?'ON':'OFF');if(renderer){if(raf)cancelAnimationFrame(raf);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowEffects?1:1.35));renderer.shadowMap.enabled=!lowEffects;if(!lowEffects)animate();else renderer.render(scene,camera);}}
toggle.addEventListener('click',()=>setLowEffects(!lowEffects));
init();
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else if(renderer&&!lowEffects&&!raf)animate();});
document.querySelectorAll('.handcard').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('#dialogTitle').textContent=btn.dataset.name;document.querySelector('#cardDialog').showModal();}));
document.querySelector('.dialogClose').addEventListener('click',()=>document.querySelector('#cardDialog').close());
document.querySelector('#logBtn').addEventListener('click',()=>document.querySelector('#log').classList.add('open'));
document.querySelector('#closeLog').addEventListener('click',()=>document.querySelector('#log').classList.remove('open'));
