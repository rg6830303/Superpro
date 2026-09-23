import * as THREE from '../superpro-opening/node_modules/three/build/three.module.js';
import {RoomEnvironment} from '../superpro-opening/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import {Reflector} from '../superpro-opening/node_modules/three/examples/jsm/objects/Reflector.js';
import logoPaths from './logo-paths.json';

const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;
const sm=(a,b,t)=>{const f=clamp((t-a)/(b-a),0,1);return f*f*(3-2*f);};
const rand=n=>{const f=Math.sin(n*127.1+311.7)*43758.5453;return f-Math.floor(f);};
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const DURATION=3.8;

window.makeKolkataFilm=async function(width=1080,height=1920){
 const portrait=height>width, aspect=width/height;
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
 renderer.setSize(width,height);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 document.body.style.cssText='margin:0;background:#02131e;overflow:hidden';document.body.appendChild(renderer.domElement);
 const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromScene(new RoomEnvironment(),.02).texture;
 function background(){const c=document.createElement('canvas');c.width=1024;c.height=1024;const x=c.getContext('2d');let g=x.createRadialGradient(560,490,20,500,520,730);g.addColorStop(0,'#174657');g.addColorStop(.5,'#062837');g.addColorStop(1,'#010a12');x.fillStyle=g;x.fillRect(0,0,1024,1024);for(let i=0;i<11000;i++){x.fillStyle=`rgba(180,230,230,${rand(i)*.023})`;x.fillRect(rand(i+2)*1024,rand(i+3)*1024,1,1);}const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;return tx;}
 const bg=background();
 const city=new THREE.Scene();city.background=bg;city.environment=env;city.fog=new THREE.FogExp2(0x041e2b,.027);
 const stage=new THREE.Scene();stage.background=bg;stage.environment=env;
 const cityCam=new THREE.PerspectiveCamera(37,aspect,.1,100);
 const cam=new THREE.PerspectiveCamera(43,aspect,.05,70);cam.position.z=8;
 const hud=new THREE.Scene();const hudCam=new THREE.OrthographicCamera(-aspect,aspect,1,-1,.01,20);hudCam.position.z=5;
 const material=(color,roughness=.4,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const marble=material(0xe7e9df,.33,.12),trim=material(0xffffff,.25,.16),steel=material(0xabc6cd,.26,.76),gold=material(0xc6ae6e,.3,.63),black=material(0x041a26,.65),green=material(0x00e575,.25,.42);
 function mesh(g,m,parent,pos=[0,0,0]){const o=new THREE.Mesh(g,m);o.position.set(...pos);parent.add(o);return o;}
 function box(parent,size,pos,m=marble){return mesh(new THREE.BoxGeometry(...size),m,parent,pos);}
 function cylinder(parent,rt,rb,h,pos,m=marble,segments=24){return mesh(new THREE.CylinderGeometry(rt,rb,h,segments),m,parent,pos);}
 function beam(parent,a,b,r=.04,m=steel){const start=V(...a),end=V(...b),v=end.clone().sub(start);const o=mesh(new THREE.CylinderGeometry(r,r,v.length(),8),m,parent);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1,0),v.normalize());return o;}
 function addLights(s){s.add(new THREE.HemisphereLight(0xb3dce8,0x06252c,.65));const a=new THREE.DirectionalLight(0xfff0d8,2.8);a.position.set(-4,7,7);s.add(a);const b=new THREE.DirectionalLight(0x5bffd1,2.3);b.position.set(5,3,-5);s.add(b);const c=new THREE.DirectionalLight(0x6daaf9,.7);c.position.set(-8,2,-4);s.add(c);}
 addLights(city);addLights(stage);
 const floor=new Reflector(new THREE.PlaneGeometry(65,65),{color:0x16333c,textureWidth:1024,textureHeight:1024,clipBias:.003});floor.rotation.x=-Math.PI/2;floor.position.y=-.14;city.add(floor);
 const mistFloor=mesh(new THREE.PlaneGeometry(65,65),new THREE.MeshBasicMaterial({color:0x031926,transparent:true,opacity:.30}),city,[0,-.12,0]);mistFloor.rotation.x=-Math.PI/2;
 const bridge=new THREE.Group();city.add(bridge);
 box(bridge,[13,.19,1.48],[0,.55,0],steel);box(bridge,[13,.09,1.22],[0,.69,0],black);
 for(const x of [-3.65,3.65]){box(bridge,[.48,.66,1.7],[x,.18,0],black);box(bridge,[.62,.13,1.85],[x,.08,0],steel);}
 const xs=[-6.3,-5.4,-4.5,-3.65,-2.7,-1.8,-.9,0,.9,1.8,2.7,3.65,4.5,5.4,6.3];
 function top(x){const a=Math.abs(x);return a>3.65?mix(3.55,.92,(a-3.65)/2.65):mix(2.08,3.55,a/3.65);}
 for(const z of [-.63,.63]){
  for(let i=0;i<xs.length;i++){const x=xs[i],y=top(x);beam(bridge,[x,.74,z],[x,y,z],.042);if(i<xs.length-1){const b=xs[i+1],h=top(b);beam(bridge,[x,y,z],[b,h,z],.068);beam(bridge,[x,.78,z],[b,h,z],.041);beam(bridge,[x,y,z],[b,.78,z],.027);beam(bridge,[x,1.30,z],[b,1.30,z],.031);}}
  beam(bridge,[-6.35,.82,z],[6.35,.82,z],.055);
 }
 for(let i=0;i<xs.length;i++){const x=xs[i],y=top(x);beam(bridge,[x,y,-.63],[x,y,.63],.036);if(i<xs.length-1)beam(bridge,[x,y,-.63],[xs[i+1],top(xs[i+1]),.63],.025);}
 for(const x of [-3.65,3.65]){for(const z of [-.63,.63]){beam(bridge,[x,.55,z],[x,3.83,z],.071);cylinder(bridge,.09,.09,.12,[x,3.82,z],gold);}}
 const glow=new THREE.MeshBasicMaterial({color:0x85ffe0});
 for(let i=0;i<41;i++){for(const z of [-.7,.7])mesh(new THREE.SphereGeometry(.021,6,5),glow,bridge,[-6.2+i*.31,.79,z]);}
 for(let i=0;i<65;i++){const x=-11+rand(i+202)*22,h=.12+rand(i+313)*.58;box(city,[.13+rand(i+1)*.26,h,.35],[x,h/2,-4.2-rand(i)*1.7],material(0x082532,.85));}

 const victoria=new THREE.Group();city.add(victoria);
 for(let k=0;k<4;k++)box(victoria,[7.1-k*.18,.075,3.1-k*.18],[0,k*.075,0],marble);
 box(victoria,[6.4,1.17,2.08],[0,.88,0]);box(victoria,[6.6,.12,2.23],[0,1.46,0],trim);
 box(victoria,[2.10,1.90,2.28],[0,1.30,0],marble);box(victoria,[2.28,.13,2.42],[0,2.24,0],trim);
 for(const x of [-2.92,2.92]){box(victoria,[.72,1.96,2.14],[x,1.25,0]);box(victoria,[.84,.12,2.25],[x,2.24,0],trim);cylinder(victoria,.34,.34,.46,[x,2.5,.65]);mesh(new THREE.SphereGeometry(.365,28,16,0,Math.PI*2,0,Math.PI/2),trim,victoria,[x,2.73,.65]);cylinder(victoria,.022,.05,.26,[x,3.05,.65],gold);}
 cylinder(victoria,.82,.94,.26,[0,2.42,0]);cylinder(victoria,.76,.80,.59,[0,2.84,0]);cylinder(victoria,.85,.83,.10,[0,3.15,0],trim);
 mesh(new THREE.SphereGeometry(.83,64,40,0,Math.PI*2,0,Math.PI/2),marble,victoria,[0,3.19,0]);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const points=[];for(let j=0;j<=24;j++){const p=j/24*Math.PI/2;points.push(V(Math.cos(a)*.835*Math.sin(p),3.19+.835*Math.cos(p),Math.sin(a)*.835*Math.sin(p)));}mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.009,4,false),trim,victoria);}
 for(let i=0;i<20;i++){const a=i/20*Math.PI*2;cylinder(victoria,.028,.033,.48,[Math.cos(a)*.8,2.84,Math.sin(a)*.8],trim,10);}
 cylinder(victoria,.085,.12,.20,[0,4.11,0],trim);cylinder(victoria,.018,.026,.26,[0,4.33,0],gold);
 // Winged finial on the dome, reduced to an architectural silhouette.
 box(victoria,[.023,.13,.025],[0,4.5,0],gold);beam(victoria,[0,4.48,0],[.13,4.53,0],.013,gold);beam(victoria,[0,4.49,0],[-.10,4.59,0],.012,gold);
 const archShape=new THREE.Shape();archShape.moveTo(-.29,0);archShape.lineTo(-.29,.63);archShape.absarc(0,.63,.29,Math.PI,0,true);archShape.lineTo(.29,0);archShape.closePath();
 function arch(x,y,z,scale=1){const a=mesh(new THREE.ShapeGeometry(archShape),black,victoria,[x,y,z]);a.scale.setScalar(scale);for(const side of [-1,1])cylinder(victoria,.035*scale,.047*scale,.7*scale,[x+side*.35*scale,y+.35*scale,z+.02],trim,12);const ring=mesh(new THREE.TorusGeometry(.35*scale,.032*scale,8,32,Math.PI),trim,victoria,[x,y+.7*scale,z+.015]);}
 arch(0,.32,1.151,1.66);
 for(const side of [-1,1])for(const x of [1.36,1.90,2.43])arch(x*side,.51,1.051,.65);
 for(const side of [-1,1])for(const x of [.68,.89])cylinder(victoria,.054,.067,1.38,[x*side,1.09,1.20],trim,16);
 for(const x of [-2.92,2.92]){arch(x,1.49,1.077,.64);arch(x,.50,1.077,.65);}
 for(let i=0;i<40;i++){const x=-3.1+i*6.2/39;cylinder(victoria,.022,.032,.18,[x,1.63,1.055],trim,8);}
 box(victoria,[6.35,.07,.11],[0,1.74,1.05],trim);
 for(let i=0;i<12;i++){for(const side of [-1,1]){const x=-3.0+i*.54;mesh(new THREE.SphereGeometry(.023,6,5),glow,victoria,[x,.32,side*1.35]);}}

 const paddle=new THREE.Group();stage.add(paddle);
 const sh=new THREE.Shape();sh.moveTo(-.37,.30);sh.lineTo(.37,.30);sh.quadraticCurveTo(.56,.34,.56,.57);sh.lineTo(.53,1.48);sh.quadraticCurveTo(.5,1.64,.29,1.66);sh.lineTo(-.29,1.66);sh.quadraticCurveTo(-.5,1.64,-.53,1.48);sh.lineTo(-.56,.57);sh.quadraticCurveTo(-.56,.34,-.37,.30);
 mesh(new THREE.ExtrudeGeometry(sh,{depth:.10,bevelEnabled:true,bevelThickness:.027,bevelSize:.025,bevelSegments:3}),material(0x081d2a,.32,.5),paddle);
 const rim=mesh(new THREE.ExtrudeGeometry(sh,{depth:.034,bevelEnabled:true,bevelThickness:.034,bevelSize:.04,bevelSegments:3}),green,paddle,[0,0,-.035]);
 cylinder(paddle,.10,.115,.65,[0,.025,0],trim,20);
 for(let y=-.24;y<.29;y+=.055){const r=mesh(new THREE.TorusGeometry(.105,.007,5,20),black,paddle,[0,y,0]);r.rotation.x=Math.PI/2;}
 // Very fine woven face texture, modelled as a local canvas texture.
 const weave=document.createElement('canvas');weave.width=weave.height=256;const wx=weave.getContext('2d');wx.fillStyle='#122c39';wx.fillRect(0,0,256,256);for(let x=0;x<256;x+=5)for(let y=0;y<256;y+=5){wx.fillStyle=(x+y)%10?'#29404c':'#152c39';wx.fillRect(x,y,3,4);}const wt=new THREE.CanvasTexture(weave);wt.wrapS=wt.wrapT=THREE.RepeatWrapping;wt.repeat.set(2,3);
 paddle.children[0].material.map=wt;
 const path=new THREE.ShapePath();for(const loop of logoPaths){path.moveTo(loop[0][0],loop[0][1]);for(const p of loop.slice(1))path.lineTo(...p);path.currentPath.closePath();}
 const shapes=path.toShapes(true);
 const markGeometry=new THREE.ExtrudeGeometry(shapes,{depth:.08,bevelEnabled:true,bevelSegments:4,bevelThickness:.012,bevelSize:.010,curveSegments:24});markGeometry.center();
 const paddleMark=mesh(markGeometry,trim,paddle,[0,1.03,.142]);paddleMark.scale.setScalar(.53);
 const mark=new THREE.Group();hud.add(mark);
 const mainMark=mesh(markGeometry,new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.18,metalness:.48,clearcoat:1,envMap:env,envMapIntensity:1.9}),mark);hud.add(new THREE.AmbientLight(0xffffff,2));const ml=new THREE.DirectionalLight(0xffffff,4);ml.position.set(-2,4,6);hud.add(ml);
 const markBack=mesh(markGeometry,new THREE.MeshStandardMaterial({color:0x00e578,metalness:.5,roughness:.25,emissive:0x00c564,emissiveIntensity:.13}),mark,[.006,-.008,-.06]);

 const holes=[];for(let i=0;i<40;i++){const y=1-2*(i+.5)/40,r=Math.sqrt(1-y*y),a=i*2.39996323;holes.push(V(Math.cos(a)*r,y,Math.sin(a)*r));}
 const ballMat=new THREE.MeshPhysicalMaterial({color:0xd4f640,roughness:.36,clearcoat:.24,clearcoatRoughness:.25});
 ballMat.onBeforeCompile=s=>{s.uniforms.holes={value:holes};s.vertexShader='varying vec3 holeNormal;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nholeNormal=normalize(position);');s.fragmentShader='varying vec3 holeNormal;uniform vec3 holes[40];\n'+s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfor(int i=0;i<40;i++){if(dot(normalize(holeNormal),holes[i])>.985)discard;}');};
 const ball=new THREE.Group();stage.add(ball);mesh(new THREE.SphereGeometry(.22,80,56),ballMat,ball);mesh(new THREE.SphereGeometry(.193,40,28),material(0x344914,.9),ball);
 const ballTrails=Array.from({length:7},(_,i)=>mesh(new THREE.SphereGeometry(.20,20,12),new THREE.MeshBasicMaterial({color:0xb2f779,transparent:true,opacity:.08*(1-i/8),depthWrite:false}),stage));

 const glassZ=3.8,gh=Math.tan(43*Math.PI/360)*(8-glassZ)*1.07,gw=gh*aspect;
 let seeds=[[0,0]];for(let i=0;i<24;i++){const a=i*2.39996,r=.035+Math.sqrt(rand(i+20))*.38;seeds.push([Math.cos(a)*r,Math.sin(a)*r]);}
 for(let i=0;i<106;i++)seeds.push([(rand(i+552)*2-1)*gw,(rand(i+195)*2-1)*gh]);
 function clip(poly,a,b,c){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p[0]+b*p[1]-c,dq=a*q[0]+b*q[1]-c;if(dp<=0)out.push(p);if((dp<0)!==(dq<0)){const u=dp/(dp-dq);out.push([mix(p[0],q[0],u),mix(p[1],q[1],u)]);}}return out;}
 const shardGroup=new THREE.Group();stage.add(shardGroup);const shards=[];
 seeds.forEach((s,i)=>{let poly=[[-gw,-gh],[gw,-gh],[gw,gh],[-gw,gh]];for(let j=0;j<seeds.length;j++){if(i===j)continue;const q=seeds[j];poly=clip(poly,q[0]-s[0],q[1]-s[1],(q[0]*q[0]+q[1]*q[1]-s[0]*s[0]-s[1]*s[1])/2);if(poly.length<3)return;}
  const cx=poly.reduce((a,p)=>a+p[0],0)/poly.length,cy=poly.reduce((a,p)=>a+p[1],0)/poly.length;
  const shape=new THREE.Shape();poly.forEach((p,j)=>j?shape.lineTo(p[0]-cx,p[1]-cy):shape.moveTo(p[0]-cx,p[1]-cy));shape.closePath();
  const thickness=.015+rand(i)*.015;
  const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelThickness:.0025,bevelSize:.002,bevelSegments:2,steps:1});
  const gm=new THREE.MeshPhysicalMaterial({color:0xe9fffa,metalness:0,roughness:.022,transmission:1,thickness:.035,ior:1.52,clearcoat:.7,envMapIntensity:.85,attenuationColor:0xb8e9e1,attenuationDistance:8,transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide});
  gm.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','gl_FragColor=vec4(outgoingLight,diffuseColor.a*(0.16+0.78*pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.5)));');};
  const group=new THREE.Group();group.position.set(cx,cy,glassZ);shardGroup.add(group);mesh(geo,gm,group);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo,30),new THREE.LineBasicMaterial({color:i%7===0?0xffffff:0x98d6d2,transparent:true,opacity:0}));group.add(edge);
  const r=Math.hypot(cx,cy),angle=Math.atan2(cy,cx);
  shards.push({group,mat:gm,edge,cx,cy,r,delay:r*.043+rand(i+65)*.019,vx:Math.cos(angle)*(1.8+rand(i+3)*3.8),vy:Math.sin(angle)*(1.5+rand(i+4)*3.2),vz:2.0+rand(i+91)*4.9,rx:(rand(i+72)-.5)*8,ry:(rand(i+76)-.5)*10,rz:(rand(i+93)-.5)*7});
 });
 const dustGeometry=new THREE.BufferGeometry();const dustPositions=new Float32Array(240*3);dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xd6fff2,size:.012,transparent:true,opacity:.9,sizeAttenuation:true,depthWrite:false}));stage.add(dust);
 const sparkleGeo=new THREE.BufferGeometry();const sparklePositions=new Float32Array(60*6);sparkleGeo.setAttribute('position',new THREE.BufferAttribute(sparklePositions,3));const sparkle=new THREE.LineSegments(sparkleGeo,new THREE.LineBasicMaterial({color:0xcefcea,transparent:true,opacity:.8}));stage.add(sparkle);
 // Fine secondary fractures add smaller branching chips to the tessellated pane.
 const fractureGroup=new THREE.Group();stage.add(fractureGroup);const fractures=[];
 for(let i=0;i<42;i++){const a=i*2.39996,r0=.04+rand(i)*.10,r1=.20+rand(i+23)*1.7;const pts=[];for(let k=0;k<7;k++){const r=mix(r0,r1,k/6),aa=a+(rand(i*7+k)-.5)*.07;pts.push(V(Math.cos(aa)*r,Math.sin(aa)*r,glassZ+.04));}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xf2fff9,transparent:true,opacity:.7}));fractureGroup.add(line);fractures.push(line);}

 function label(text,size,color){const c=document.createElement('canvas');c.width=1600;c.height=220;const x=c.getContext('2d');x.font=`500 ${size}px Arial`;x.textAlign='center';x.fillStyle=color;x.fillText(text,800,145);const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;const m=new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false,toneMapped:false});const sp=new THREE.Sprite(m);hud.add(sp);sp.scale.set(aspect*1.65,aspect*1.65*220/1600,1);return sp;}
 const cityTitle=label('K O L K A T A',83,'#e5fff8');cityTitle.position.set(0,.78,0);
 const bridgeTitle=label('H O W R A H   B R I D G E',47,'#9dbebf');bridgeTitle.position.set(0,-.72,0);
 const vicTitle=label('V I C T O R I A   M E M O R I A L',43,'#bbd2cd');vicTitle.position.copy(bridgeTitle.position);
 const flash=mesh(new THREE.PlaneGeometry(aspect*2,2),new THREE.MeshBasicMaterial({color:0xe9ffec,transparent:true,opacity:0,depthTest:false}),hud,[0,0,1]);flash.renderOrder=10;
 const tinyParticles=new THREE.BufferGeometry();const starPos=[];for(let i=0;i<110;i++)starPos.push((rand(i+737)-.5)*22,rand(i+121)*8+2,-10-rand(i+985)*7);tinyParticles.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));city.add(new THREE.Points(tinyParticles,new THREE.PointsMaterial({color:0x8fd7c2,size:.015,transparent:true,opacity:.5})));

 function ballAt(t){if(t<1.70){const f=sm(1.31,1.70,t);return V(mix(-1.85,-.06,f),mix(1.5,.12,f),mix(-.5,.3,f));}const f=clamp((t-1.70)/.42,0,1);return V(mix(-.06,0,f),mix(.12,0,f),mix(.3,8.45,f*f));}
 function seek(t){
  t=clamp(t,0,DURATION);renderer.autoClear=true;
  const cityVisible=t<1.34;
  bridge.visible=t<.68;victoria.visible=t>=.68;
  if(cityVisible){
   if(t<.68){const f=sm(0,.68,t);const dist=portrait?29.5:15.8;cityCam.position.set(mix(12,10.5,f),mix(5.8,5.3,f),dist-mix(0,.9,f));cityCam.lookAt(.05,1.1,0);}
   else{const f=sm(.68,1.34,t);cityCam.position.set(mix(4.0,2.5,f),mix(4.7,4.05,f),portrait?22.5-mix(0,1.0,f):10.2-mix(0,.4,f));cityCam.lookAt(0,1.8,0);}
   renderer.render(city,cityCam);
  }else{
   paddle.visible=t<1.90;
   const swing=sm(1.32,1.76,t);paddle.position.set(mix(-1.28,.74,swing),mix(-.70,-.28,swing),mix(-.15,.0,swing));paddle.rotation.set(mix(-.45,-.1,swing),mix(-.6,.6,swing),mix(-.90,1.00,swing));paddle.scale.setScalar(portrait?.86:1.10);
   ball.visible=t<2.125;ball.position.copy(ballAt(t));ball.rotation.set(t*4,t*8,t*3);
   ballTrails.forEach((b,i)=>{b.visible=t>1.71&&t<2.09;b.position.copy(ballAt(t-(i+1)*.010));});
   shardGroup.visible=t>=1.93&&t<2.76;
   shards.forEach((s,i)=>{const u=Math.max(0,t-1.995-s.delay),burst=u*1.35;const crack=sm(1.93+s.r*.032,1.985+s.r*.032,t);s.group.position.set(s.cx+s.vx*burst,s.cy+s.vy*burst-2.4*burst*burst,glassZ+s.vz*burst);s.group.rotation.set(s.rx*burst,s.ry*burst,s.rz*burst);s.mat.opacity=(1-sm(2.48,2.76,t))*(.10+.9*crack);s.edge.material.opacity=crack*(.55+.4*rand(i))*(1-sm(2.49,2.73,t));});
   fractureGroup.visible=t>=1.935&&t<2.13;fractures.forEach((f,i)=>{f.geometry.setDrawRange(0,Math.max(0,Math.floor(sm(1.935+i*.0008,2.015+i*.0008,t)*7)));f.material.opacity=(1-sm(2.02,2.13,t))*.85;});
   const u=Math.max(0,t-1.99);dust.visible=sparkle.visible=u>0&&u<.78;
   for(let i=0;i<240;i++){const a=i*2.39996,s=.35+rand(i+523)*6;dustPositions[i*3]=Math.cos(a)*u*s;dustPositions[i*3+1]=Math.sin(a)*u*s-u*u*2;dustPositions[i*3+2]=glassZ+u*(1+rand(i+195)*8);}
   dustGeometry.attributes.position.needsUpdate=true;dust.material.opacity=(1-sm(2.38,2.77,t))*.85;
   for(let i=0;i<60;i++){const a=i*2.39996,s=2+rand(i+897)*5,b=u*s;const p=V(Math.cos(a)*b,Math.sin(a)*b-u*u*2.1,glassZ+u*(1+rand(i)*7));p.toArray(sparklePositions,i*6);p.clone().add(V(Math.cos(a),Math.sin(a),.4).multiplyScalar(.025+u*.08)).toArray(sparklePositions,i*6+3);}
   sparkleGeo.attributes.position.needsUpdate=true;sparkle.material.opacity=(1-sm(2.32,2.71,t))*.7;
   const shake=sm(1.97,1.99,t)*(1-sm(1.99,2.10,t))*.026;cam.position.set(Math.sin(t*132)*shake,Math.cos(t*109)*shake,8);cam.lookAt(0,0,0);renderer.render(stage,cam);
  }
  const cityAlpha=sm(0,.08,t)*(1-sm(1.23,1.34,t));cityTitle.material.opacity=cityAlpha;bridgeTitle.material.opacity=cityAlpha*(1-sm(.61,.68,t));vicTitle.material.opacity=cityAlpha*sm(.68,.74,t);
  const markIn=sm(2.51,2.73,t),fly=sm(3.08,3.66,t);mark.visible=t>2.50;
  const markWidth=portrait?aspect*1.03:.58;const targetWidth=portrait?.095:.061;
  const spring=1+Math.sin((t-2.60)*23)*Math.exp(-Math.max(0,t-2.60)*10)*.075;
  mark.scale.setScalar(mix(markWidth,targetWidth,fly)*spring*mix(.72,1,markIn));
  mark.position.set(mix(0,-aspect+(portrait?.09:.10),fly),mix(0,.923,fly)+Math.sin(fly*Math.PI)*.15,0);
  mark.rotation.set((1-markIn)*-.18,(1-markIn)*-.68+Math.sin((t-2.70)*7)*.09*(1-fly),(1-markIn)*-.13);
  mainMark.material.transparent=markBack.material.transparent=true;mainMark.material.opacity=markBack.material.opacity=markIn;
  flash.material.opacity=sm(1.977,1.995,t)*(1-sm(1.995,2.045,t))*.52;
  renderer.autoClear=false;renderer.clearDepth();renderer.render(hud,hudCam);renderer.autoClear=true;
 }
 await renderer.compileAsync(city,cityCam);await renderer.compileAsync(stage,cam);await renderer.compileAsync(hud,hudCam);
 seek(0);
 const accumulation=document.createElement('canvas');accumulation.width=width;accumulation.height=height;const ax=accumulation.getContext('2d');
 window.film={seek,duration:DURATION,canvas:renderer.domElement,width,height,frame(t,blur=false){if(blur&&t>1.47&&t<2.70){seek(t-1/240);ax.globalAlpha=1;ax.drawImage(renderer.domElement,0,0);seek(t+1/240);ax.globalAlpha=.5;ax.drawImage(renderer.domElement,0,0);return accumulation.toDataURL('image/jpeg',.97);}seek(t);return renderer.domElement.toDataURL('image/jpeg',.97);},stats:()=>renderer.info.render};
 return {duration:DURATION,shards:shards.length,portrait,width,height};
};
