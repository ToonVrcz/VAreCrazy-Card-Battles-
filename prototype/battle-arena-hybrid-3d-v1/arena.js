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
function createSeatCharacter(parent,x,z,hair,coat,scale=1){
 const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
 const stone=material('#55445d'),cloth=material(coat),skin=material('#c99b7b'),hairMat=material(hair),gold=material('#c9a45f',.45,.55);
 // throne and seated silhouette
 box(g,.9,.16,.62,0,.7,0,stone);box(g,.72,.62,.16,0,1.0,-.22,stone);
 box(g,.62,.48,.48,0,.98,.12,cloth);
 sphere(g,.22,0,1.58,.1,skin);sphere(g,.25,0,1.73,.08,hairMat);
 // seated legs extend forward; boots and arms create a readable seated pose
 const leg1=box(g,.2,.18,.48,-.19,.77,.45,cloth);leg1.rotation.x=-.08;
 const leg2=box(g,.2,.18,.48,.19,.77,.45,cloth);leg2.rotation.x=-.08;
 cylinder(g,.09,.1,.28,-.19,.69,.68,material('#302431'));cylinder(g,.09,.1,.28,.19,.69,.68,material('#302431'));
 const arm1=box(g,.13,.48,.14,-.39,1.03,.15,cloth);arm1.rotation.z=-.2;
 const arm2=box(g,.13,.48,.14,.39,1.03,.15,cloth);arm2.rotation.z=.2;
 sphere(g,.08,-.39,.78,.2,skin);sphere(g,.08,.39,.78,.2,skin);
 box(g,.95,.06,.7,0,.58,.05,gold);
 return g;
}
function buildScene(){
 scene=new THREE.Scene();scene.background=new THREE.Color('#100a18');scene.fog=new THREE.Fog('#100a18',17,42);
 camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,12,22);camera.lookAt(0,1.4,-.8);
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
 createSeatCharacter(crew,-4.2,-7.05,'#a63842','#65314d',.9);
 createSeatCharacter(crew,-1.4,-7.05,'#d3a44b','#795a2c',.9);
 createSeatCharacter(crew,1.4,-7.05,'#4e88b8','#244968',.9);
 createSeatCharacter(crew,4.2,-7.05,'#8061b2','#46305f',.9);
 // floating braziers and flame-like glow spheres
 for(const x of [-6.2,6.2]){cylinder(scene,.18,.25,1.1,x,3.0,-6.0,gold,10);sphere(scene,.22,x,3.72,-6.0,material('#e3a34e',.3,.1));}
 // subtle floor rings
 for(let r of [5.5,6.3]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.025,6,8),gold);ring.rotation.x=Math.PI/2;ring.position.y=.53;scene.add(ring);}
 return {crew,fill,key};
}
let sceneBits;
function resize(){if(!renderer||!camera)return;const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.position.z=window.innerWidth<700?27:22;camera.position.y=window.innerWidth<700?14:12;camera.lookAt(0,1.6,-.5);camera.updateProjectionMatrix();}
function animate(){raf=requestAnimationFrame(animate);if(!lowEffects&&sceneBits){sceneBits.fill.intensity=2.2+Math.sin(performance.now()*.0007)*.18;sceneBits.crew.position.y=Math.sin(performance.now()*.0008)*.025;}renderer.render(scene,camera);}
function init(){
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:!lowEffects,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowEffects?1:1.5));
  renderer.shadowMap.enabled=!lowEffects;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  sceneBits=buildScene();resize();
  if(!lowEffects)animate();else renderer.render(scene,camera);
  window.addEventListener('resize',resize,{passive:true});
 }catch(err){console.error('3D arena init failed',err);wrap.classList.add('failed');}
}
function setLowEffects(value){lowEffects=value;toggle.textContent='LOW EFFECTS: '+(lowEffects?'ON':'OFF');if(renderer){if(raf)cancelAnimationFrame(raf);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowEffects?1:1.5));renderer.shadowMap.enabled=!lowEffects;if(!lowEffects)animate();else renderer.render(scene,camera);}}
toggle.addEventListener('click',()=>setLowEffects(!lowEffects));
init();
document.querySelectorAll('.handcard').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('#dialogTitle').textContent=btn.dataset.name;document.querySelector('#cardDialog').showModal();}));
document.querySelector('.dialogClose').addEventListener('click',()=>document.querySelector('#cardDialog').close());
document.querySelector('#logBtn').addEventListener('click',()=>document.querySelector('#log').classList.add('open'));
document.querySelector('#closeLog').addEventListener('click',()=>document.querySelector('#log').classList.remove('open'));
