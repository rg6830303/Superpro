import * as THREE from 'three';
import whiteLogo from '../../../../public/logo/superpro-logo-white.png';
import blackLogo from '../../../../public/logo/superpro-logo-black.png';

// Review-only prototype. This bundle is injected into a local browser session;
// it is deliberately not imported by the website or its authentication flows.
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const out = x => 1 - (1 - clamp(x, 0, 1)) ** 3;
const vec = a => new THREE.Vector3(...a);
// The sequence plays in 4.5 s of wall clock. Everything below is still authored
// against the original 6.5 s design timeline, so a single piecewise remap does
// the compression in one place rather than scattering new constants through the
// render function. Each pair is [wall clock, design time]; the segments are
// linear, so speed is constant within a beat and only steps at the joins — and
// the joins are chosen so the steps land where acceleration is wanted. The
// 2.8x segment is the swing itself, which should whip into contact, and the
// 2.2x segment is the hold between logo reveal and dock, which is dead air.
const SPAN = 4.5;
const BEATS = [[0,0],[.85,1.35],[1.05,1.91],[1.70,2.84],[2.05,3.21],[2.70,4.66],[4.05,6.08],[SPAN,6.5]];
function designTime(t){
  if(t<=0)return 0;
  if(t>=SPAN)return 6.5;
  let i=0;while(i<BEATS.length-2&&t>BEATS[i+1][0])i++;
  const [t0,d0]=BEATS[i],[t1,d1]=BEATS[i+1];
  return d0+(d1-d0)*(t-t0)/(t1-t0);
}
const duration = 6.5;
const smallDevice = () => innerWidth < 650 || matchMedia('(pointer: coarse)').matches;

async function createIntro({forceFallback=false}={}) {
  window.superproIntro?.dispose();
  const headerLogo = document.querySelector('header img[alt="SuperPro"]');
  if (!headerLogo) throw new Error('The live SuperPro header logo must be present.');
  const root = document.createElement('div');
  root.id = 'superpro-smash-preview';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<style>
    #superpro-smash-preview{position:fixed;inset:0;width:100%;height:100%;height:100dvh;z-index:2147483600;pointer-events:none;overflow:hidden;isolation:isolate;font-family:Arial,sans-serif;--volt:#00e55f}
    #superpro-smash-preview *{box-sizing:border-box}
    #superpro-smash-preview .sp-stage{position:absolute;inset:0;background:radial-gradient(ellipse at 68% 38%,#123e50 0%,#041c2c 48%,#010e18 100%)}
    #superpro-smash-preview canvas{position:absolute;inset:0;width:100%;height:100%}
    #superpro-smash-preview .sp-grain{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0px,transparent 3px,#fff 4px);opacity:.015;mix-blend-mode:screen}
    #superpro-smash-preview .sp-copy{position:absolute;left:8.4%;top:31%;color:white;will-change:transform,opacity}
    #superpro-smash-preview .sp-kicker{font:10px/1.3 monospace;letter-spacing:.23em;text-transform:uppercase;color:#72e4ac;display:flex;align-items:center;gap:12px}
    #superpro-smash-preview .sp-kicker:before{content:'';width:25px;height:2px;background:#00e55f}
    #superpro-smash-preview .sp-title{font-size:clamp(35px,5.1vw,78px);font-weight:800;line-height:.99;letter-spacing:-.055em;margin:23px 0 22px}
    #superpro-smash-preview .sp-title span{color:#00e55f}
    #superpro-smash-preview .sp-caption{font-size:12px;letter-spacing:.03em;color:#99b2c3}
    #superpro-smash-preview .sp-topline{position:absolute;left:8.4%;right:8.4%;top:7.5%;display:flex;justify-content:space-between;font:10px monospace;letter-spacing:.17em;color:#c0d5dd}
    #superpro-smash-preview .sp-topline b{color:#00e55f;font-weight:400}
    #superpro-smash-preview .sp-bottomline{position:absolute;bottom:8%;left:8.4%;right:8.4%;border-top:1px solid #ffffff1b;padding-top:16px;display:flex;justify-content:space-between;color:#7b9aa9;font:9px monospace;letter-spacing:.16em}
    #superpro-smash-preview .sp-impact{position:absolute;inset:0;background:#00e55f;opacity:0}
    #superpro-smash-preview .sp-iris{position:absolute;left:50%;top:50%;width:32px;height:32px;border:1px solid #00e55f;border-radius:50%;opacity:0;transform:translate(-50%,-50%)}
    #superpro-smash-preview .sp-logo{position:absolute;width:310px;aspect-ratio:672/381;transform-origin:center;will-change:transform,opacity}
    #superpro-smash-preview .sp-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
    #superpro-smash-preview .sp-tag{position:absolute;left:0;right:0;top:calc(50% + 128px);text-align:center;color:#a4bccc;font:10px monospace;letter-spacing:.3em}
    #superpro-smash-preview .sp-accent{position:absolute;left:50%;top:calc(50% + 106px);width:46px;height:3px;border-radius:3px;background:#00e55f;transform:translateX(-50%)}
    #superpro-smash-preview .sp-skip{position:absolute;right:max(24px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));border:1px solid #91b3c64d;background:#051721bd;color:#c4d8e3;border-radius:24px;padding:10px 16px;font:11px Arial;cursor:pointer;pointer-events:auto}
    #superpro-smash-preview .sp-skip:focus-visible{outline:2px solid #00e55f;outline-offset:3px}
    @media(max-width:600px){
      #superpro-smash-preview .sp-copy{left:8%;top:11%}
      #superpro-smash-preview .sp-title{font-size:43px;margin:15px 0}
      #superpro-smash-preview .sp-caption{font-size:10px}
      #superpro-smash-preview .sp-topline{left:8%;right:8%;font-size:8px;top:6%}
      #superpro-smash-preview .sp-bottomline{left:8%;right:8%;font-size:8px;bottom:6%}
      #superpro-smash-preview .sp-kicker{font-size:8px}
    }
    @media(max-height:500px) and (max-width:1000px){#superpro-smash-preview .sp-copy{left:6%;top:27%}#superpro-smash-preview .sp-title{font-size:34px;margin:14px 0}#superpro-smash-preview .sp-caption{display:none}#superpro-smash-preview .sp-bottomline{display:none}#superpro-smash-preview .sp-topline{top:6%;font-size:8px}#superpro-smash-preview .sp-kicker{font-size:8px}#superpro-smash-preview .sp-tag{top:calc(50% + 99px)}#superpro-smash-preview .sp-accent{top:calc(50% + 83px)}}
  </style>
  <div class="sp-stage"></div><div class="sp-grain"></div>
  <div class="sp-copy"><div class="sp-kicker">Kolkata's pickleball house</div><div class="sp-title">EVERY POINT.<br><span>STARTS HERE.</span></div><div class="sp-caption">Pickleball, played properly.</div></div>
  <div class="sp-topline"><span>SUPERPRO / KOLKATA</span><b>BUILT FOR THE GAME</b></div>
  <div class="sp-bottomline"><span>PRECISION. POWER. PLAY.</span><span>01 / THE SMASH</span></div>
  <div class="sp-impact"></div><div class="sp-iris"></div>
  <div class="sp-logo"><img class="sp-logo-white" src="${whiteLogo}" alt=""><img class="sp-logo-black" src="${blackLogo}" alt=""></div>
  <div class="sp-accent"></div><div class="sp-tag">WELCOME TO YOUR COURT.</div>`;
  document.body.append(root);
  root.style.display='none';
  const $ = s => root.querySelector(s);
  await Promise.allSettled([...root.querySelectorAll('img')].map(img => img.decode()));
  const stage = $('.sp-stage'), copy = $('.sp-copy'), topline = $('.sp-topline'), bottomline = $('.sp-bottomline');
  const logo = $('.sp-logo'), logoWhite = $('.sp-logo-white'), logoBlack = $('.sp-logo-black');
  const accent = $('.sp-accent'), tag = $('.sp-tag'), impact = $('.sp-impact'), iris = $('.sp-iris');
  root.removeAttribute('aria-hidden');
  for(const child of root.children) child.setAttribute('aria-hidden','true');
  const skip=document.createElement('button');skip.className='sp-skip';skip.textContent='Skip intro';skip.setAttribute('aria-label','Skip SuperPro introduction');root.appendChild(skip);

  // The page stays usable when motion is disabled or WebGL2 is unavailable.
  function simpleIntro(reduced=false){
    let raf=0,start=0,playing=false,guard=0;
    const seconds=reduced?.3:1.65,originalVisibility=headerLogo.style.visibility;
    copy.style.display=topline.style.display=bottomline.style.display=accent.style.display=tag.style.display=impact.style.display=iris.style.display='none';
    logoWhite.style.opacity='0';logoBlack.style.opacity='1';stage.style.background='#fff';
    function frame(t){const end=t>=seconds;root.style.display=end?'none':'block';headerLogo.style.visibility=end?originalVisibility:'hidden';const p=reduced?1:smooth(.6,1.5,t);const r=headerLogo.getBoundingClientRect(),w=Math.min(210,innerWidth*.55),h=w*381/672;logo.style.width=`${w}px`;logo.style.height=`${h}px`;logo.style.left=`${lerp(innerWidth/2,r.left+r.width/2,p)-w/2}px`;logo.style.top=`${lerp(innerHeight/2,r.top+r.height/2,p)-h/2}px`;logo.style.opacity=String(reduced?1:Math.min(1,t/.16));logo.style.transform=`scale(${lerp(1,r.width/w,p)})`;stage.style.opacity=String(1-p);}
    const finish=()=>{cancelAnimationFrame(raf);clearTimeout(guard);playing=false;frame(seconds);};
    const onKey=e=>{if(e.key==='Escape')finish();};addEventListener('keydown',onKey);skip.onclick=finish;
    const api={version:'smash-preview-2',mode:reduced?'reduced-motion':'logo-fallback',duration:seconds,get playing(){return playing;},seek(t){cancelAnimationFrame(raf);clearTimeout(guard);playing=false;frame(t);},play(){finish();start=performance.now();playing=true;guard=setTimeout(finish,seconds*1000+80);const tick=now=>{const t=(now-start)/1000;frame(t);if(t<seconds)raf=requestAnimationFrame(tick);else{playing=false;clearTimeout(guard);}};raf=requestAnimationFrame(tick);},dispose(){finish();removeEventListener('keydown',onKey);root.remove();}};
    window.superproIntro=api;frame(seconds);return api;
  }
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return simpleIntro(true);
  if(forceFallback)return simpleIntro();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x041c2c, .055);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias:!smallDevice(), alpha:true, powerPreference:smallDevice()?'low-power':'high-performance' }); }
  catch { return simpleIntro(); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, smallDevice()?1.25:1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x041c2c, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  stage.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,80);
  const mobile = () => innerWidth < 650;
  const homeCamera = new THREE.Vector3(0,3.35,10.8);
  const target = new THREE.Vector3(0,1.65,0);

  scene.add(new THREE.HemisphereLight(0xaddbee,0x0b1722,2.0));
  function light(color,intensity,position){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...position);scene.add(l);return l;}
  function rimLight(){
    const l=new THREE.DirectionalLight(0x8ffcd0,1.55);
    l.position.set(-3.2,5.4,-7.5);
    scene.add(l);
    const fill=new THREE.DirectionalLight(0x9fd4ff,.55);
    fill.position.set(5.5,2.2,4.5);
    scene.add(fill);
    return l;
  }
  const key = light(0xffffff,4.4,[-3,8,6]); key.castShadow=true;
  key.shadow.mapSize.set(smallDevice()?512:1024,smallDevice()?512:1024);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.normalBias=.025;
  light(0x00ff86,4.0,[4,5,-4]);light(0x8dc7ff,2.3,[-5,3,-2]);
  rimLight();
  const mat=(color,roughness=.55,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const navy=mat(0x06263d,.62,.06), shortsMat=mat(0x02131e,.72,.05), skin=mat(0xc6865a,.52), skinLight=mat(0xd49468,.56), white=mat(0xe9f5f6,.48,.04), green=mat(0x00e55f,.38,.08), dark=mat(0x081219,.72);
  // A little sheen on kit and skin; sweat and synthetics are not matte.
  navy.envMapIntensity=1.15;green.envMapIntensity=1.3;skin.envMapIntensity=.85;skinLight.envMapIntensity=.85;
  const glow=new THREE.MeshBasicMaterial({color:0x45ffa1});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(65,65),mat(0x082c3a,.83));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const court=new THREE.Mesh(new THREE.PlaneGeometry(8,15),mat(0x0c3f48,.85));court.rotation.x=-Math.PI/2;court.position.y=.005;court.position.z=-3;court.receiveShadow=true;scene.add(court);
  function line(a,b,color=0x71b7ab,opacity=.4){const g=new THREE.BufferGeometry().setFromPoints([vec(a),vec(b)]);const o=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity}));scene.add(o);return o;}
  for(const x of [-4,4])line([x,.012,-10.5],[x,.012,4.5]);
  for(const z of [-10.5,-5,-1.5,4.5])line([-4,.012,z],[4,.012,z]);
  line([0,.012,-10.5],[0,.012,-5]);line([0,.012,-1.5],[0,.012,4.5]);
  for(let i=-5;i<=5;i++)line([i*3,.012,-20],[i*3,.012,10],0x428e93,.08);
  for(let i=-6;i<=3;i++)line([-15,.012,i*3],[15,.012,i*3],0x428e93,.08);
  // A dim net and stadium strips give the athlete a real sense of depth.
  for(let x=-4;x<=4;x+=smallDevice()?.44:.22)line([x,.12,-4.5],[x,1.03,-4.5],0x8ac8c2,.12);
  for(let y=.12;y<=1.05;y+=smallDevice()?.24:.12)line([-4,y,-4.5],[4,y,-4.5],0x8ac8c2,.12);
  line([-4,1.05,-4.5],[4,1.05,-4.5],0xc9f3e6,.65);
  for(const x of [-6,6]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,6,12),navy);pole.position.set(x,3,-6);scene.add(pole);
    const strip=new THREE.Mesh(new THREE.BoxGeometry(2.8,.075,.1),glow);strip.position.set(x,6,-6);scene.add(strip);
  }
  const SEG=smallDevice()?16:26;
  const athlete=new THREE.Group();scene.add(athlete);
  // The upper body is a child group: `turn` rotates the whole athlete (the hips),
  // `tw` rotates only this. The gap between them is the coil.
  const upper=new THREE.Group();upper.position.y=1.46;athlete.add(upper);
  const mesh=(geometry,material,parent=athlete)=>{const o=new THREE.Mesh(geometry,material);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const ellipsoid=(radius,scale,material,position,parent=athlete)=>{const o=mesh(new THREE.SphereGeometry(radius,SEG,SEG*2/3|0),material,parent);o.scale.set(...scale);o.position.set(...position);return o;};
  // Torso: a tapered barrel plus a lat flare, so the silhouette reads V-shaped
  // from the front instead of tubular. Y values are relative to the hip group.
  const torso=mesh(new THREE.CylinderGeometry(.44,.33,.86,SEG),navy,upper);torso.scale.z=.63;torso.position.y=.51;
  const chest=ellipsoid(1,[.47,.29,.28],navy,[0,.78,.01],upper);
  const lat=[-1,1].map(x=>ellipsoid(1,[.15,.26,.17],navy,[x*.35,.62,-.02],upper));
  const abs=ellipsoid(1,[.30,.22,.20],navy,[0,.36,.06],upper);
  const collar=mesh(new THREE.TorusGeometry(.185,.036,8,SEG),green,upper);collar.rotation.x=Math.PI/2;collar.position.set(0,.94,0);
  const trap=[-1,1].map(x=>ellipsoid(1,[.19,.10,.15],navy,[x*.24,.93,-.01],upper));
  const pelvis=ellipsoid(1,[.37,.25,.25],shortsMat,[0,1.43,0]);
  const neck=mesh(new THREE.CylinderGeometry(.115,.15,.26,SEG/2|0),skin,upper);neck.position.y=1.03;
  // Head: cranium, jaw and chin as separate masses — one ellipsoid reads as an egg.
  const headGroup=new THREE.Group();headGroup.position.set(0,1.20,.015);upper.add(headGroup);
  const head=ellipsoid(1,[.223,.255,.225],skin,[0,.04,0],headGroup);
  const jaw=ellipsoid(1,[.183,.145,.196],skin,[0,-.145,.022],headGroup);
  const chin=ellipsoid(1,[.085,.072,.085],skin,[0,-.215,.10],headGroup);
  const brow=ellipsoid(1,[.208,.055,.19],skin,[0,.075,.045],headGroup);
  const nose=ellipsoid(1,[.042,.062,.055],skinLight,[0,-.03,.205],headGroup);
  const ears=[-1,1].map(x=>{const e=ellipsoid(1,[.032,.072,.052],skin,[x*.222,-.005,-.005],headGroup);e.rotation.z=x*.18;return e;});
  const hair=ellipsoid(1,[.229,.155,.228],dark,[0,.165,-.01],headGroup);
  const cap=ellipsoid(1,[.248,.125,.248],navy,[0,.19,0],headGroup);
  const visor=ellipsoid(1,[.248,.026,.205],navy,[0,.178,.195],headGroup);
  const band=mesh(new THREE.CylinderGeometry(.233,.233,.05,SEG),green,headGroup);band.scale.z=.98;band.position.y=.166;
  // Eyes set under the brow, with a dark iris — a flat dark patch reads as a hole.
  for(const x of [-.093,.093]){
    ellipsoid(1,[.049,.038,.030],white,[x,.005,.186],headGroup);
    ellipsoid(1,[.026,.028,.020],dark,[x,.001,.205],headGroup);
  }
  for(const x of [-.098,.098])ellipsoid(1,[.058,.017,.032],dark,[x,.052,.182],headGroup);
  const mouth=mesh(new THREE.BoxGeometry(.078,.014,.010),dark,headGroup);mouth.position.set(0,-.128,.176);
  const jerseyCanvas=document.createElement('canvas');jerseyCanvas.width=512;jerseyCanvas.height=512;
  const jc=jerseyCanvas.getContext('2d');jc.clearRect(0,0,512,512);jc.fillStyle='#00e55f';jc.font='bold italic 44px Arial';jc.textAlign='center';jc.fillText('SUPERPRO',256,170);jc.fillStyle='#ffffff';jc.font='bold 150px Arial';jc.fillText('07',256,335);
  const jerseyTexture=new THREE.CanvasTexture(jerseyCanvas);jerseyTexture.colorSpace=THREE.SRGBColorSpace;
  const badge=mesh(new THREE.PlaneGeometry(.64,.64),new THREE.MeshBasicMaterial({map:jerseyTexture,transparent:true,depthWrite:false}),upper);badge.position.set(0,.575,.285);
  const seam=mesh(new THREE.BoxGeometry(.031,.69,.012),green,upper);seam.position.set(-.31,.52,.208);seam.rotation.z=.1;
  const limbs=[];
  function bone(radius,length,material){const o=mesh(new THREE.CapsuleGeometry(radius,length,6,16),material);limbs.push(o);return o;}
  function link(o,a,b){const av=vec(a),bv=vec(b),d=bv.clone().sub(av);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());o.scale.set(1,Math.max(.01,(d.length()+.095)/(o.geometry.parameters.height+2*o.geometry.parameters.radius)),1);}
  const arms=[-1,1].map(side=>({
    side,
    delt:ellipsoid(1,[.175,.165,.165],navy,[0,0,0]),
    sleeve:bone(.158,.22,navy),
    upper:bone(.118,.35,skin),
    biceps:ellipsoid(1,[.128,.16,.125],skin,[0,0,0]),
    elbow:ellipsoid(.112,[1,1,1],skin,[0,0,0]),
    fore:bone(.098,.40,skinLight),
    forearm:ellipsoid(1,[.112,.13,.108],skinLight,[0,0,0]),
    wrist:bone(.104,.045,white),
    hand:ellipsoid(1,[.105,.13,.10],skin,[0,0,0]),
    // Four fingers and a thumb, wrapped round the grip on the paddle side.
    fingers:Array.from({length:4},()=>bone(.031,.085,skin)),
    thumb:bone(.035,.075,skin),
  }));
  const legs=[-1,1].map(side=>({
    side,
    glute:ellipsoid(1,[.20,.18,.19],shortsMat,[0,0,0]),
    short:bone(.185,.3,shortsMat),
    thigh:bone(.148,.37,skin),
    quad:ellipsoid(1,[.165,.20,.155],skin,[0,0,0]),
    knee:ellipsoid(.128,[1,1,1],skin,[0,0,0]),
    shin:bone(.099,.47,skinLight),
    calf:ellipsoid(1,[.125,.175,.14],skinLight,[0,0,0]),
    sock:bone(.114,.20,white),
    shoe:ellipsoid(1,[.152,.115,.295],white,[0,0,0]),
    heel:ellipsoid(1,[.125,.105,.115],white,[0,0,0]),
    sole:ellipsoid(1,[.158,.033,.298],green,[0,0,0]),
  }));
  const paddle=new THREE.Group();athlete.add(paddle);
  const shape=new THREE.Shape();shape.moveTo(-.21,.22);shape.lineTo(.21,.22);shape.quadraticCurveTo(.34,.26,.34,.43);shape.lineTo(.32,.90);shape.quadraticCurveTo(.31,1.02,.18,1.04);shape.lineTo(-.18,1.04);shape.quadraticCurveTo(-.31,1.02,-.32,.90);shape.lineTo(-.34,.43);shape.quadraticCurveTo(-.34,.26,-.21,.22);
  const paddleFace=mesh(new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.018,bevelSize:.035,bevelSegments:3,steps:1}),shortsMat,paddle);
  const edge=mesh(new THREE.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelThickness:.035,bevelSize:.045,bevelSegments:3,steps:1}),green,paddle);edge.position.z=-.022;
  const grip=mesh(new THREE.CylinderGeometry(.069,.075,.36,16),white,paddle);grip.position.y=.045;
  for(let y=-.10;y<.20;y+=.042){const r=mesh(new THREE.TorusGeometry(.072,.006,4,16),navy,paddle);r.rotation.x=Math.PI/2;r.position.y=y;}
  const paddleTexture=new THREE.TextureLoader().load(whiteLogo);paddleTexture.colorSpace=THREE.SRGBColorSpace;
  const paddleBrand=mesh(new THREE.PlaneGeometry(.43,.245),new THREE.MeshBasicMaterial({map:paddleTexture,transparent:true}),paddle);paddleBrand.position.set(0,.66,.082);
  const shadowTexture=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,1,64,64,64);g.addColorStop(0,'rgba(0,0,0,.65)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(3,2),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=.018;scene.add(contactShadow);

  // Forty round apertures, cut in the surface shader; a dark inner shell adds depth.
  const holes=[];for(let i=0;i<40;i++){const y=1-2*(i+.5)/40,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));holes.push(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));}
  const ballMat=mat(0xc9fa35,.37);
  // `spDetail` switches the hole test off once the ball has grown past the
  // point where the apertures are readable. Forty dot products and a discard
  // per fragment is affordable on a ball a few hundred pixels wide, and pure
  // waste on one covering the viewport in the last third of a second.
  const ballDetail={value:1};
  ballMat.onBeforeCompile=shader=>{
    shader.uniforms.spHoles={value:holes};
    shader.uniforms.spDetail=ballDetail;
    shader.vertexShader='varying vec3 spNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nspNormal = normalize(position);');
    shader.fragmentShader='varying vec3 spNormal; uniform vec3 spHoles[40]; uniform float spDetail;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(spDetail>.5){for(int i=0;i<40;i++){if(dot(normalize(spNormal),spHoles[i])>.985) discard;}}');
  };
  const ball=new THREE.Group();scene.add(ball);
  const ballOuter=mesh(new THREE.SphereGeometry(.145,56,40),ballMat,ball);
  mesh(new THREE.SphereGeometry(.125,32,20),mat(0x25350d,.95),ball);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.25,.016,8,64),glow);scene.add(ring);
  const trail=Array.from({length:8},(_,i)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),new THREE.MeshBasicMaterial({color:0xc9fa35,transparent:true,opacity:.12*(1-i/8),depthWrite:false}));scene.add(m);return m;});
  const swing=Array.from({length:smallDevice()?7:11},(_,i)=>{
    const m=new THREE.Mesh(
      new THREE.SphereGeometry(.115-i*.007,10,8),
      new THREE.MeshBasicMaterial({color:0x8ffcd0,transparent:true,opacity:0,depthWrite:false}),
    );
    scene.add(m);
    return m;
  });
  const specks=Array.from({length:26},(_,i)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.018+(i%3)*.007,6,4),glow);scene.add(m);return m;});

  // Keyframes on the 6.5 s design clock. Channels:
  //   y      hip height (the jump)          turn  hip rotation
  //   tw     chest relative to the hips     crunch trunk flexion
  //   side   lateral trunk lean             hp    head pitch
  //   re/rw  right elbow / wrist            le/lw left elbow / wrist
  //   rk/ra  right knee / ankle             lk/la left knee / ankle
  //   p/py   paddle pitch / yaw
  //
  // The smash lives in the gap between `turn` and `tw`. The hips fire first, the
  // chest lags behind them through the coil, then overtakes into contact — chest
  // world rotation runs -1.10 → -0.50 → +0.44 rad across 0.56 s of design time,
  // which the retime compresses to roughly 0.2 s of wall clock. That lag and
  // release is what separates a smash from someone waving an arm.
  const poses=[
    // Ready, weight forward, paddle up.
    {t:0,y:0,turn:-.32,tw:.10,crunch:.02,side:0,hp:.06,lean:.04,
     re:[.84,1.93,.1],rw:[1.04,2.38,.32],le:[-.68,1.88,.16],lw:[-.57,2.15,.47],
     rk:[.4,.77,.12],ra:[.57,.18,.12],lk:[-.45,.78,.21],la:[-.68,.18,.35],p:-.5,py:.1},

    // Load: knees bend, chest coils away, off arm points up to track the ball.
    {t:.75,y:-.15,turn:-.48,tw:-.42,crunch:-.06,side:.05,hp:.16,lean:.11,
     re:[.9,2.50,-.24],rw:[.73,2.93,-.41],le:[-.66,2.51,.30],lw:[-.47,3.08,.49],
     rk:[.5,.84,.45],ra:[.67,.18,.16],lk:[-.4,.84,.49],la:[-.62,.18,.35],p:.20,py:-.35},

    // Airborne, maximum coil, paddle deep behind the head.
    {t:1.35,y:.47,turn:-.52,tw:-.58,crunch:-.14,side:.08,hp:.22,lean:-.14,
     re:[.89,2.69,-.31],rw:[.48,3.08,-.52],le:[-.8,2.68,.31],lw:[-.58,3.17,.48],
     rk:[.42,.86,-.18],ra:[.55,.38,-.63],lk:[-.43,.86,.25],la:[-.65,.17,.2],p:.18,py:-.5},

    // Hips have already fired; the elbow leads and the paddle still trails.
    {t:1.68,y:.56,turn:-.16,tw:-.30,crunch:-.05,side:.04,hp:.18,lean:-.04,
     re:[.93,2.84,-.10],rw:[.70,3.22,-.26],le:[-.80,2.46,.28],lw:[-.76,2.12,.44],
     rk:[.44,.83,-.02],ra:[.58,.30,-.44],lk:[-.42,.86,.18],la:[-.58,.18,.02],p:-.05,py:-.30},

    // CONTACT. Chest square and past the hips, arm at full extension.
    {t:1.91,y:.55,turn:.10,tw:.34,crunch:.06,side:-.02,hp:.05,lean:.06,
     re:[.83,2.82,.19],rw:[1.02,3.34,.43],le:[-.78,2.15,.22],lw:[-.71,1.84,.48],
     rk:[.46,.80,.13],ra:[.62,.19,-.2],lk:[-.41,.85,.12],la:[-.5,.20,-.20],p:-.38,py:0},

    // Whip through: the wrist pronates and the trunk crunches down over it.
    {t:2.02,y:.46,turn:.34,tw:.48,crunch:.18,side:-.06,hp:-.06,lean:.13,
     re:[.76,2.55,.44],rw:[.66,2.70,.86],le:[-.76,2.08,.06],lw:[-.79,1.76,.24],
     rk:[.50,.79,.26],ra:[.70,.18,.06],lk:[-.45,.81,.07],la:[-.58,.19,-.21],p:-1.25,py:.22},

    // Follow through across the body.
    {t:2.20,y:.3,turn:.51,tw:.30,crunch:.14,side:-.05,hp:-.12,lean:.17,
     re:[.64,2.22,.65],rw:[.22,2.02,1.12],le:[-.74,2.01,-.08],lw:[-.83,1.68,.04],
     rk:[.52,.77,.37],ra:[.75,.18,.28],lk:[-.47,.78,.03],la:[-.65,.18,-.22],p:-1.95,py:.35},

    // Land and settle.
    {t:2.7,y:0,turn:.32,tw:.06,crunch:.04,side:0,hp:-.04,lean:.04,
     re:[.50,1.99,.46],rw:[.03,1.79,.73],le:[-.72,1.96,.15],lw:[-.7,1.61,.33],
     rk:[.5,.77,.19],ra:[.72,.18,.23],lk:[-.46,.79,-.02],la:[-.63,.18,-.19],p:-2.2,py:.3},

    {t:7,y:0,turn:.32,tw:.06,crunch:.04,side:0,hp:-.04,lean:.04,
     re:[.50,1.99,.46],rw:[.03,1.79,.73],le:[-.72,1.96,.15],lw:[-.7,1.61,.33],
     rk:[.5,.77,.19],ra:[.72,.18,.23],lk:[-.46,.79,-.02],la:[-.63,.18,-.19],p:-2.2,py:.3}
  ];
  // Segments ending at contact accelerate instead of easing out, so the paddle
  // is travelling fastest at the moment it meets the ball. Easing both ends of
  // every segment — the default — makes a swing look like it is being carried
  // rather than swung.
  function poseAt(t){
    let i=0;while(i<poses.length-2&&t>poses[i+1].t)i++;
    const a=poses[i],b=poses[i+1];
    const x=clamp((t-a.t)/(b.t-a.t),0,1);
    const f=b.t===1.91?x*x*x:a.t===1.91?1-(1-x)**2:x*x*(3-2*x);
    const p={};
    for(const k of Object.keys(a)){
      if(k==='t')continue;
      p[k]=Array.isArray(a[k])?a[k].map((v,j)=>lerp(v,b[k][j],f)):lerp(a[k],b[k],f);
    }
    return p;
  }
  // Place a mass along a bone at fraction f, so a biceps sits on the upper arm
  // and a calf on the shin without either needing its own keyframe.
  function along(o,a,b,f,lift=0){
    o.position.set(lerp(a[0],b[0],f),lerp(a[1],b[1],f),lerp(a[2],b[2],f)+lift);
  }
  function posePlayer(t){
    const p=poseAt(t);
    athlete.position.set(mobile()?0:1.15,p.y,mobile()?.8:0);
    athlete.rotation.set(p.lean,p.turn,-.025);
    // Hip/shoulder separation: the chest leads or trails the hips by `tw`.
    upper.rotation.set(p.crunch??0,p.tw??0,p.side??0);
    headGroup.rotation.set(p.hp??0,-(p.tw??0)*.45,0);

    const c=Math.cos(p.tw??0),sn=Math.sin(p.tw??0);
    for(const a of arms){
      const sd=a.side;
      // Shoulder anchor rides the twisted torso, while the elbow and wrist keys
      // stay authored in athlete space — the arm reaches where the pose says.
      const sx=sd*.46,sz=0;
      const shoulder=[sx*c+sz*sn,2.28,-sx*sn+sz*c];
      const elbow=sd===1?p.re:p.le,wrist=sd===1?p.rw:p.lw;

      a.delt.position.set(...shoulder);
      const sleeveEnd=shoulder.map((v,i)=>lerp(v,elbow[i],.46));
      link(a.sleeve,shoulder,sleeveEnd);
      link(a.upper,sleeveEnd,elbow);
      along(a.biceps,shoulder,elbow,.62);
      a.elbow.position.set(...elbow);
      link(a.fore,elbow,wrist);
      along(a.forearm,elbow,wrist,.28);
      const wb=elbow.map((v,i)=>lerp(v,wrist[i],.87));
      link(a.wrist,wb,wrist);
      a.hand.position.set(...wrist);

      // The paddle hand curls round the grip; the free hand stays open.
      const grips=sd===1;
      const dir=[wrist[0]-elbow[0],wrist[1]-elbow[1],wrist[2]-elbow[2]];
      const len=Math.hypot(...dir)||1;
      const u=dir.map(v=>v/len);
      a.fingers.forEach((f,i)=>{
        const off=(i-1.5)*.062;
        const base=[wrist[0]+u[0]*.05-u[1]*off,wrist[1]+u[1]*.05+u[0]*off,wrist[2]+u[2]*.05];
        const tip=grips
          ? [base[0]-u[0]*.02,base[1]-u[1]*.02,base[2]+.10]
          : [base[0]+u[0]*.11,base[1]+u[1]*.11,base[2]+.02];
        link(f,base,tip);
      });
      const tb=[wrist[0]+u[0]*.02+sd*.05,wrist[1]+u[1]*.02,wrist[2]+.02];
      link(a.thumb,tb,[tb[0]-sd*.03,tb[1]+.02,tb[2]+(grips?.09:.07)]);
    }

    for(const l of legs){
      const sd=l.side,hip=[sd*.22,1.46,0];
      const knee=sd===1?p.rk:p.lk,ankle=sd===1?p.ra:p.la;
      const hem=hip.map((v,i)=>lerp(v,knee[i],.52));
      l.glute.position.set(hip[0],hip[1]-.06,hip[2]-.07);
      link(l.short,hip,hem);
      link(l.thigh,hem,knee);
      along(l.quad,hip,knee,.52,.05);
      l.knee.position.set(...knee);
      link(l.shin,knee,ankle);
      along(l.calf,knee,ankle,.34,-.06);
      const sockTop=knee.map((v,i)=>lerp(v,ankle[i],.72));
      link(l.sock,sockTop,ankle);
      l.shoe.position.set(ankle[0],ankle[1]-.04,ankle[2]+.1);
      l.heel.position.set(ankle[0],ankle[1]-.03,ankle[2]-.06);
      l.sole.position.copy(l.shoe.position);
      l.sole.position.y-=.082;
    }

    paddle.position.set(...p.rw);
    paddle.rotation.set(p.p,(p.py??0),-.12);
    contactShadow.position.x=athlete.position.x;
    contactShadow.scale.setScalar(1+p.y*.55);
    contactShadow.material.opacity=1-p.y*.6;
    athlete.updateMatrixWorld(true);
  }
  posePlayer(1.91);
  let strike=paddle.localToWorld(new THREE.Vector3(0,.67,.10));

  // The paddle path is fully determined by the keyframes, so sample it once at
  // startup and read the ribbon out of the table. Re-solving the rig per ribbon
  // segment per frame cost more than the rest of the scene put together.
  const PATH_T0=1.10,PATH_T1=2.35,PATH_N=64;
  let paddlePath=[];
  function bakePaddlePath(){
    paddlePath=[];
    for(let i=0;i<=PATH_N;i++){
      posePlayer(PATH_T0+(PATH_T1-PATH_T0)*i/PATH_N);
      paddlePath.push(paddle.localToWorld(new THREE.Vector3(0,.67,.05)));
    }
    posePlayer(1.91);
  }
  bakePaddlePath();
  function paddleHeadAt(t){
    const f=clamp((t-PATH_T0)/(PATH_T1-PATH_T0),0,1)*PATH_N;
    const i=Math.min(PATH_N-1,Math.floor(f));
    return paddlePath[i].clone().lerp(paddlePath[i+1],f-i);
  }
  function ballPosition(t){
    if(t<1.91){const f=smooth(.1,1.91,t);return new THREE.Vector3(lerp(strike.x-.95,strike.x,f),lerp(strike.y+2.7,strike.y,f),lerp(-1.5,strike.z,f));}
    const f=clamp((t-1.91)/.88,0,1),e=f*f;
    return new THREE.Vector3(lerp(strike.x,0,out(f)),lerp(strike.y,3.18,out(f))-Math.sin(f*Math.PI)*.9,lerp(strike.z,9.85,e));
  }
  let raf=0,started=0,disposed=false,playing=false,guard=0,slowFrames=0;
  const oldVisibility=headerLogo.style.visibility;
  function render(t){
    if(disposed)return;
    const w=innerWidth,h=innerHeight,isMobile=mobile();
    root.style.display=t>=duration?'none':'block';
    root.dataset.time=t.toFixed(3);
    headerLogo.style.visibility=t>.1&&t<6.14?'hidden':oldVisibility;
    const introIn=smooth(0,.33,t),sceneOut=1-smooth(2.64,2.94,t),reveal=smooth(4.60,5.94,t);
    stage.style.opacity=String(introIn*(1-reveal));renderer.domElement.style.opacity=String(sceneOut);
    const textIn=smooth(.18,.58,t),textOut=1-smooth(1.6,2.04,t);
    copy.style.opacity=String(textIn*textOut);copy.style.transform=`translateY(${(1-textIn)*18-textOut*0}px)`;
    topline.style.opacity=bottomline.style.opacity=String(introIn*(1-smooth(2.2,2.7,t)));
    posePlayer(t);
    camera.aspect=w/h;
    camera.position.copy(homeCamera);
    if(isMobile){camera.position.set(0,4.2,15.3);target.set(0,2.5,0);athlete.position.z=.8;}else{target.set(0,1.95,0);}
    const shake=(1-smooth(2.64,2.91,t))*smooth(2.6,2.65,t)*.06;
    camera.position.x+=Math.sin(t*71)*shake;camera.position.y+=Math.sin(t*97)*shake;camera.lookAt(target);camera.updateProjectionMatrix();
    ball.position.copy(ballPosition(t));
    if(isMobile&&t>1.91){const f=clamp((t-1.91)/.88,0,1);ball.position.z+=5.0*f*f;ball.position.y+=.9*f*f;}
    ball.visible=t<2.84;ball.rotation.set(t*4,t*6,-t*2);ball.scale.setScalar(1+smooth(2.2,2.81,t)*8.5);
    ballDetail.value=ball.scale.x>3.2?0:1;
    // Paddle-head ribbon, read from the path cached at startup.
    const swingLit=smooth(1.42,1.62,t)*(1-smooth(2.05,2.30,t));
    if(swingLit>0.001){
      swing.forEach((m,i)=>{
        m.position.copy(paddleHeadAt(t-(i+1)*.026));
        m.material.opacity=swingLit*.42*(1-i/swing.length);
        m.visible=true;
      });
    } else {
      swing.forEach(m=>{m.visible=false;});
    }
    trail.forEach((m,i)=>{m.visible=t>1.94&&t<2.73;m.position.copy(ballPosition(t-(i+1)*.016));m.scale.setScalar(1+smooth(2.1,2.72,t)*2);});
    const hit=smooth(1.9,2.04,t)*(1-smooth(2.1,2.3,t));ring.position.copy(strike);ring.lookAt(camera.position);ring.scale.setScalar(1+clamp((t-1.91)*8,0,4));ring.visible=hit>0;ring.material.transparent=true;ring.material.opacity=hit;
    specks.forEach((m,i)=>{const f=clamp((t-1.91)/.8,0,1),a=i*2.399;m.visible=t>1.91&&t<2.72;m.position.copy(strike).add(new THREE.Vector3(Math.cos(a)*f*1.6,Math.sin(a)*f*1.6-f*f*.7,(i%4)*f*.4));m.scale.setScalar(1-f);});
    const flash=smooth(2.69,2.81,t)*(1-smooth(2.81,3.03,t));impact.style.opacity=String(flash*.98);
    const ringP=clamp((t-2.86)/.75,0,1);iris.style.opacity=String((1-ringP)*smooth(2.86,2.99,t)*.3);iris.style.transform=`translate(-50%,-50%) scale(${3+ringP*22})`;
    const appear=smooth(2.91,3.21,t),travel=smooth(4.66,6.08,t),logoW=Math.min(310,w*.60,h*.45),logoH=logoW*381/672;
    const rect=headerLogo.getBoundingClientRect();
    const lx=lerp(w/2,rect.left+rect.width/2,travel),ly=lerp(h/2,rect.top+rect.height/2,travel)-Math.sin(travel*Math.PI)*h*.085;
    const scale=lerp(1,rect.width/logoW,travel)*(1+Math.sin(Math.max(0,t-2.96)*11)*Math.exp(-Math.max(0,t-2.96)*4)*.10);
    logo.style.width=`${logoW}px`;logo.style.height=`${logoH}px`;logo.style.left=`${lx-logoW/2}px`;logo.style.top=`${ly-logoH/2}px`;
    logo.style.opacity=String(appear*(1-smooth(6.1,6.23,t)));logo.style.transform=`perspective(800px) rotateY(${(1-appear)*-50+Math.sin((t-3.1)*4)*3*(1-travel)}deg) rotateZ(${(1-appear)*-9}deg) scale(${scale})`;
    logoWhite.style.opacity=String(1-smooth(.23,.66,travel));logoBlack.style.opacity=String(smooth(.23,.66,travel));
    tag.style.opacity=accent.style.opacity=String(smooth(3.2,3.55,t)*(1-smooth(4.40,4.8,t)));
    tag.style.transform=`translateY(${(1-smooth(3.2,3.55,t))*8}px)`;
    if(t<2.94)renderer.render(scene,camera);
  }
  function stop(){cancelAnimationFrame(raf);clearTimeout(guard);playing=false;}
  function seek(t){stop();render(designTime(clamp(t,0,SPAN)));}
  function play(){
    stop();started=performance.now();playing=true;
    let last=started;
    // Hard stop a little past the end: a stalled tab must not leave the overlay up.
    guard=setTimeout(()=>{stop();render(6.5);},SPAN*1000+220);
    const tick=now=>{
      const delta=now-last;last=now;
      if(smallDevice()&&delta>50)slowFrames++;
      if(smallDevice()&&slowFrames===4){renderer.shadowMap.enabled=false;renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);slowFrames++;}
      const wall=(now-started)/1000;
      render(designTime(wall));
      if(wall<SPAN&&!disposed)raf=requestAnimationFrame(tick);else{playing=false;clearTimeout(guard);}
    };
    raf=requestAnimationFrame(tick);
  }
  function resize(){renderer.setSize(innerWidth,innerHeight);posePlayer(1.91);strike=paddle.localToWorld(new THREE.Vector3(0,.67,.10));bakePaddlePath();if(!playing)render(Number(root.dataset.time||0));}
  const finish=()=>{stop();render(duration);};
  const onKey=e=>{if(e.key==='Escape')finish();};
  const onVisibility=()=>{if(document.hidden)finish();};
  const onContextLost=e=>{e.preventDefault();finish();};
  skip.onclick=finish;
  addEventListener('keydown',onKey);document.addEventListener('visibilitychange',onVisibility);renderer.domElement.addEventListener('webglcontextlost',onContextLost);
  function dispose(){stop();disposed=true;headerLogo.style.visibility=oldVisibility;removeEventListener('resize',resize);visualViewport?.removeEventListener('resize',resize);removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVisibility);renderer.domElement.removeEventListener('webglcontextlost',onContextLost);root.remove();const textures=new Set();scene.traverse(o=>{o.geometry?.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();});}});textures.forEach(t=>t.dispose());renderer.dispose();}
  addEventListener('resize',resize);
  visualViewport?.addEventListener('resize',resize);
  try { await renderer.compileAsync(scene,camera); } catch { dispose();return createIntro({forceFallback:true}); }
  const api={play,seek,dispose,captureFrame(t){seek(t);return renderer.domElement.toDataURL('image/png');},duration:smallDevice()?4.8:duration,timelineDuration:duration,version:'smash-preview-2',mode:'threejs',get playing(){return playing;},get stats(){return {pixelRatio:renderer.getPixelRatio(),shadowMap:key.shadow.mapSize.x,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}};
  window.superproIntro=api;
  render(duration);
  return api;
}
window.createSuperproIntro=createIntro;
window.superproIntroReady=createIntro();
