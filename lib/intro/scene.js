import * as THREE from 'three';

/**
 * The SuperPro smash entrance.
 *
 * A procedural athlete smashes a pickleball into the camera; the ball fills the
 * frame, becomes the logo, and the logo flies to its seat in the header. The
 * whole thing runs in 4.5 s and is skippable at any point.
 *
 * Loaded only from the browser, and only behind a dynamic import, so Three.js
 * never reaches the server bundle or the initial page payload.
 */
const whiteLogo = '/logo/superpro-logo-white.png';
const blackLogo = '/logo/superpro-logo-black.png';
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const out = x => 1 - (1 - clamp(x, 0, 1)) ** 3;
const vec = a => new THREE.Vector3(...a);

// Plain array vector maths for the hand frame — cheaper than a Three.js node
// per finger joint, and the hand has fourteen of them.
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rodrigues rotation: spin `v` about unit axis `k` by `a` radians. */
function rotateAbout(v, k, a) {
  const c = Math.cos(a), s2 = Math.sin(a);
  const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const kxv = cross(k, v);
  return [
    v[0] * c + kxv[0] * s2 + k[0] * kv * (1 - c),
    v[1] * c + kxv[1] * s2 + k[1] * kv * (1 - c),
    v[2] * c + kxv[2] * s2 + k[2] * kv * (1 - c),
  ];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
/** Orientation with +Y along `up` and +Z along `forward`. */
function frameQuat(forward, up) {
  const f = vec(forward).normalize();
  const u = vec(up).normalize();
  const r = new THREE.Vector3().crossVectors(u, f).normalize();
  const trueUp = new THREE.Vector3().crossVectors(f, r);
  _m.makeBasis(r, trueUp, f);
  return _q.setFromRotationMatrix(_m).clone();
}
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

/** The logo is the dock target, and it may mount a frame or two after us. */
async function waitForHeaderLogo(timeoutMs = 2000) {
  const find = () => document.querySelector('header img[alt="SuperPro"]');
  const found = find();
  if (found) return found;
  return new Promise(resolve => {
    const started = performance.now();
    const tick = () => {
      const el = find();
      if (el) return resolve(el);
      if (performance.now() - started > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function createIntro({forceFallback=false}={}) {
  window.superproIntro?.dispose();
  const headerLogo = await waitForHeaderLogo();
  if (!headerLogo) throw new Error('The SuperPro header logo must be present.');
  const root = document.createElement('div');
  root.id = 'superpro-smash-intro';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<style>
    #superpro-smash-intro{position:fixed;inset:0;width:100%;height:100%;height:100dvh;z-index:2147483600;pointer-events:none;overflow:hidden;isolation:isolate;font-family:Arial,sans-serif;--volt:#00e55f}
    #superpro-smash-intro *{box-sizing:border-box}
    #superpro-smash-intro .sp-stage{position:absolute;inset:0;background:radial-gradient(ellipse at 68% 38%,#123e50 0%,#041c2c 48%,#010e18 100%)}
    #superpro-smash-intro canvas{position:absolute;inset:0;width:100%;height:100%}
    #superpro-smash-intro .sp-grain{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0px,transparent 3px,#fff 4px);opacity:.015;mix-blend-mode:screen}
    #superpro-smash-intro .sp-copy{position:absolute;left:8.4%;top:31%;color:white;will-change:transform,opacity}
    #superpro-smash-intro .sp-kicker{font:10px/1.3 monospace;letter-spacing:.23em;text-transform:uppercase;color:#72e4ac;display:flex;align-items:center;gap:12px}
    #superpro-smash-intro .sp-kicker:before{content:'';width:25px;height:2px;background:#00e55f}
    #superpro-smash-intro .sp-title{font-size:clamp(35px,5.1vw,78px);font-weight:800;line-height:.99;letter-spacing:-.055em;margin:23px 0 22px}
    #superpro-smash-intro .sp-title span{color:#00e55f}
    #superpro-smash-intro .sp-caption{font-size:12px;letter-spacing:.03em;color:#99b2c3}
    #superpro-smash-intro .sp-topline{position:absolute;left:8.4%;right:8.4%;top:7.5%;display:flex;justify-content:space-between;font:10px monospace;letter-spacing:.17em;color:#c0d5dd}
    #superpro-smash-intro .sp-topline b{color:#00e55f;font-weight:400}
    #superpro-smash-intro .sp-bottomline{position:absolute;bottom:8%;left:8.4%;right:8.4%;border-top:1px solid #ffffff1b;padding-top:16px;display:flex;justify-content:space-between;color:#7b9aa9;font:9px monospace;letter-spacing:.16em}
    #superpro-smash-intro .sp-impact{position:absolute;inset:0;background:#00e55f;opacity:0}
    #superpro-smash-intro .sp-iris{position:absolute;left:50%;top:50%;width:32px;height:32px;border:1px solid #00e55f;border-radius:50%;opacity:0;transform:translate(-50%,-50%)}
    #superpro-smash-intro .sp-logo{position:absolute;width:310px;aspect-ratio:672/381;transform-origin:center;will-change:transform,opacity}
    #superpro-smash-intro .sp-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
    #superpro-smash-intro .sp-tag{position:absolute;left:0;right:0;top:calc(50% + 128px);text-align:center;color:#a4bccc;font:10px monospace;letter-spacing:.3em}
    #superpro-smash-intro .sp-accent{position:absolute;left:50%;top:calc(50% + 106px);width:46px;height:3px;border-radius:3px;background:#00e55f;transform:translateX(-50%)}
    #superpro-smash-intro .sp-skip{position:absolute;right:max(24px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));border:1px solid #91b3c64d;background:#051721bd;color:#c4d8e3;border-radius:24px;padding:10px 16px;font:11px Arial;cursor:pointer;pointer-events:auto}
    #superpro-smash-intro .sp-skip:focus-visible{outline:2px solid #00e55f;outline-offset:3px}
    @media(max-width:600px){
      #superpro-smash-intro .sp-copy{left:8%;top:11%}
      #superpro-smash-intro .sp-title{font-size:43px;margin:15px 0}
      #superpro-smash-intro .sp-caption{font-size:10px}
      #superpro-smash-intro .sp-topline{left:8%;right:8%;font-size:8px;top:6%}
      #superpro-smash-intro .sp-bottomline{left:8%;right:8%;font-size:8px;bottom:6%}
      #superpro-smash-intro .sp-kicker{font-size:8px}
    }
    @media(max-height:500px) and (max-width:1000px){#superpro-smash-intro .sp-copy{left:6%;top:27%}#superpro-smash-intro .sp-title{font-size:34px;margin:14px 0}#superpro-smash-intro .sp-caption{display:none}#superpro-smash-intro .sp-bottomline{display:none}#superpro-smash-intro .sp-topline{top:6%;font-size:8px}#superpro-smash-intro .sp-kicker{font-size:8px}#superpro-smash-intro .sp-tag{top:calc(50% + 99px)}#superpro-smash-intro .sp-accent{top:calc(50% + 83px)}}
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
  const torso=mesh(new THREE.CylinderGeometry(.305,.235,.88,SEG),navy,upper);torso.scale.z=.70;torso.position.y=.51;
  const chest=ellipsoid(1,[.325,.24,.215],navy,[0,.80,.015],upper);
  const lat=[-1,1].map(x=>ellipsoid(1,[.098,.235,.135],navy,[x*.245,.63,-.015],upper));
  const abs=ellipsoid(1,[.215,.215,.165],navy,[0,.37,.05],upper);
  const collar=mesh(new THREE.TorusGeometry(.142,.028,8,SEG),green,upper);collar.rotation.x=Math.PI/2;collar.position.set(0,.955,0);
  const trap=[-1,1].map(x=>ellipsoid(1,[.135,.082,.115],navy,[x*.165,.945,-.012],upper));
  const pelvis=ellipsoid(1,[.255,.215,.195],shortsMat,[0,1.44,0]);
  const neck=mesh(new THREE.CylinderGeometry(.088,.112,.235,SEG/2|0),skin,upper);neck.position.y=1.045;
  // Head: cranium, jaw and chin as separate masses — one ellipsoid reads as an egg.
  const headGroup=new THREE.Group();headGroup.position.set(0,1.195,.014);upper.add(headGroup);
  const head=ellipsoid(1,[.196,.225,.199],skin,[0,.04,0],headGroup);
  const jaw=ellipsoid(1,[.158,.128,.172],skin,[0,-.132,.020],headGroup);
  const chin=ellipsoid(1,[.072,.062,.074],skin,[0,-.196,.088],headGroup);
  const brow=ellipsoid(1,[.182,.048,.166],skin,[0,.070,.040],headGroup);
  const nose=ellipsoid(1,[.036,.054,.048],skinLight,[0,-.028,.180],headGroup);
  const ears=[-1,1].map(x=>{const e=ellipsoid(1,[.028,.062,.045],skin,[x*.195,-.004,-.004],headGroup);e.rotation.z=x*.18;return e;});
  const hair=ellipsoid(1,[.201,.137,.202],dark,[0,.148,-.009],headGroup);
  const cap=ellipsoid(1,[.216,.110,.218],navy,[0,.168,0],headGroup);
  const visor=ellipsoid(1,[.216,.023,.180],navy,[0,.157,.172],headGroup);
  const band=mesh(new THREE.CylinderGeometry(.204,.204,.044,SEG),green,headGroup);band.scale.z=.98;band.position.y=.147;
  // Eyes set under the brow, with a dark iris — a flat dark patch reads as a hole.
  for(const x of [-.082,.082]){
    ellipsoid(1,[.042,.033,.026],white,[x,.004,.164],headGroup);
    ellipsoid(1,[.022,.024,.017],dark,[x,.001,.180],headGroup);
  }
  for(const x of [-.086,.086])ellipsoid(1,[.050,.015,.028],dark,[x,.046,.160],headGroup);
  const mouth=mesh(new THREE.BoxGeometry(.066,.012,.009),dark,headGroup);mouth.position.set(0,-.116,.155);
  const jerseyCanvas=document.createElement('canvas');jerseyCanvas.width=512;jerseyCanvas.height=512;
  const jc=jerseyCanvas.getContext('2d');jc.clearRect(0,0,512,512);jc.fillStyle='#00e55f';jc.font='bold italic 44px Arial';jc.textAlign='center';jc.fillText('SUPERPRO',256,170);jc.fillStyle='#ffffff';jc.font='bold 150px Arial';jc.fillText('07',256,335);
  const jerseyTexture=new THREE.CanvasTexture(jerseyCanvas);jerseyTexture.colorSpace=THREE.SRGBColorSpace;
  const badge=mesh(new THREE.PlaneGeometry(.46,.46),new THREE.MeshBasicMaterial({map:jerseyTexture,transparent:true,depthWrite:false}),upper);badge.position.set(0,.585,.215);
  const seam=mesh(new THREE.BoxGeometry(.031,.69,.012),green,upper);seam.position.set(-.215,.52,.152);seam.rotation.z=.1;
  const limbs=[];
  function bone(radius,length,material){const o=mesh(new THREE.CapsuleGeometry(radius,length,6,16),material);limbs.push(o);return o;}
  function link(o,a,b){const av=vec(a),bv=vec(b),d=bv.clone().sub(av);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());o.scale.set(1,Math.max(.01,(d.length()+.095)/(o.geometry.parameters.height+2*o.geometry.parameters.radius)),1);}
  const arms=[-1,1].map(side=>({
    side,
    delt:ellipsoid(1,[.128,.122,.122],navy,[0,0,0]),
    sleeve:bone(.116,.20,navy),
    upper:bone(.093,.35,skin),
    biceps:ellipsoid(1,[.100,.135,.098],skin,[0,0,0]),
    elbow:ellipsoid(.086,[1,1,1],skin,[0,0,0]),
    fore:bone(.078,.40,skinLight),
    forearm:ellipsoid(1,[.088,.115,.085],skinLight,[0,0,0]),
    wrist:bone(.080,.042,white),
    // Four fingers and a thumb, wrapped round the grip on the paddle side.
    palm:ellipsoid(1,[.080,.096,.044],skin,[0,0,0]),
    knuckle:ellipsoid(1,[.082,.036,.046],skin,[0,0,0]),
    fingers:Array.from({length:4},()=>({
      prox:bone(.0295,.062,skin),
      dist:bone(.0255,.05,skin),
      tip:ellipsoid(1,[.027,.03,.027],skinLight,[0,0,0]),
    })),
    thumbProx:bone(.036,.058,skin),
    thumbDist:bone(.031,.045,skin),
  }));
  const legs=[-1,1].map(side=>({
    side,
    glute:ellipsoid(1,[.152,.142,.148],shortsMat,[0,0,0]),
    short:bone(.148,.30,shortsMat),
    thigh:bone(.121,.37,skin),
    quad:ellipsoid(1,[.130,.175,.122],skin,[0,0,0]),
    knee:ellipsoid(.101,[1,1,1],skin,[0,0,0]),
    shin:bone(.082,.47,skinLight),
    calf:ellipsoid(1,[.100,.155,.112],skinLight,[0,0,0]),
    sock:bone(.092,.20,white),
    shoe:ellipsoid(1,[.118,.095,.255],white,[0,0,0]),
    heel:ellipsoid(1,[.098,.086,.095],white,[0,0,0]),
    sole:ellipsoid(1,[.123,.028,.258],green,[0,0,0]),
  }));
  const paddle=new THREE.Group();athlete.add(paddle);
  paddle.scale.setScalar(.66);
  const shape=new THREE.Shape();shape.moveTo(-.21,.22);shape.lineTo(.21,.22);shape.quadraticCurveTo(.34,.26,.34,.43);shape.lineTo(.32,.90);shape.quadraticCurveTo(.31,1.02,.18,1.04);shape.lineTo(-.18,1.04);shape.quadraticCurveTo(-.31,1.02,-.32,.90);shape.lineTo(-.34,.43);shape.quadraticCurveTo(-.34,.26,-.21,.22);
  const graphite=mat(0x16333f,.48,.22);
  const paddleFace=mesh(new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.018,bevelSize:.035,bevelSegments:3,steps:1}),graphite,paddle);
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
  // Keyframes on the 6.5 s design clock. Channels:
  //   y      hip height (the jump)          turn   hip rotation
  //   tw     chest relative to the hips     crunch trunk flexion
  //   side   lateral trunk lean             hp     head pitch
  //   wrist  forearm pronation              p/py   paddle pitch / yaw
  //   re/rw  right elbow / wrist            le/lw  left elbow / wrist
  //   rk/ra  right knee / ankle             lk/la  left knee / ankle
  //
  // Three things make this read as an overhead smash rather than a flex:
  //
  //  1. At the trophy the hitting wrist sits BELOW and BEHIND the elbow — the
  //     back-scratch. An arm raised straight up is a wave, not a wind-up.
  //  2. The off arm points up at the ball while loading, then is pulled hard
  //     down into the chest through contact. That counter-rotation is what
  //     actually drives shoulder turn, and its absence is why the old pose
  //     looked like someone flexing both biceps.
  //  3. Feet stay inside roughly a shoulder width. The old stance splayed the
  //     ankles wider apart than the shoulders, which reads as a wrestler.
  // Keyframes on the 6.5 s design clock. Channels:
  //   y      hip height (the jump)          turn   hip rotation
  //   tw     chest relative to the hips     crunch trunk flexion
  //   side   lateral trunk lean             hp     head pitch
  //   wrist  forearm pronation              p/py   paddle pitch / yaw
  //   re/rw  right elbow / wrist            le/lw  left elbow / wrist
  //   rk/ra  right knee / ankle             lk/la  left knee / ankle
  //
  // Three things make this read as an overhead smash rather than a flex:
  //
  //  1. At the trophy the hitting wrist sits BELOW and BEHIND the elbow — the
  //     back-scratch. An arm raised straight up is a wave, not a wind-up.
  //  2. The off arm points up at the ball while loading, then is pulled hard
  //     down into the chest through contact. That counter-rotation is what
  //     actually drives shoulder turn, and its absence is why the old pose
  //     looked like someone flexing both biceps.
  //  3. Feet stay inside roughly a shoulder width. The old stance splayed the
  //     ankles wider apart than the shoulders, which reads as a wrestler.
  const poses=[
    // Ready. Split step, paddle up in front, weight forward.
    {t:0,wrist:-.35,y:0,turn:-.22,tw:.08,crunch:.03,side:0,hp:.05,lean:.05,
     re:[.52,2.05,.20],rw:[.44,2.40,.42],le:[-.42,2.02,.18],lw:[-.28,2.32,.40],
     rk:[.20,.85,.14],ra:[.22,.16,.10],lk:[-.20,.85,.16],la:[-.24,.16,.14],p:-.45,py:.10},

    // Load. Turning away, weight onto the back leg, off arm starting to rise.
    {t:.75,wrist:-1.15,y:-.14,turn:-.55,tw:-.42,crunch:-.05,side:.04,hp:.20,lean:.10,
     re:[.62,2.42,-.12],rw:[.52,2.62,-.42],le:[-.44,2.50,.22],lw:[-.36,2.92,.34],
     rk:[.22,.80,.06],ra:[.26,.15,-.04],lk:[-.22,.84,.22],la:[-.26,.16,.20],p:.15,py:-.35},

    // Trophy, at the top of the jump. Elbow high, paddle dropped behind the
    // head, off arm almost straight up tracking the ball, back arched.
    {t:1.35,wrist:-1.40,y:.50,turn:-.52,tw:-.56,crunch:-.16,side:.06,hp:.26,lean:-.12,
     re:[.50,2.78,-.20],rw:[.30,2.50,-.46],le:[-.34,2.72,.16],lw:[-.28,3.14,.22],
     rk:[.20,.92,-.22],ra:[.30,.52,-.60],lk:[-.18,.88,.12],la:[-.22,.30,.28],p:.10,py:-.48},

    // Drive. Hips already opening, elbow leading up and forward, paddle still
    // trailing behind the hand.
    {t:1.68,wrist:-1.05,y:.58,turn:-.14,tw:-.26,crunch:-.04,side:.03,hp:.20,lean:-.03,
     re:[.44,3.00,.02],rw:[.36,2.76,-.28],le:[-.36,2.60,.10],lw:[-.34,2.86,.10],
     rk:[.20,.90,-.06],ra:[.28,.44,-.42],lk:[-.18,.88,.08],la:[-.22,.24,.14],p:-.10,py:-.28},

    // CONTACT. Hitting arm at full extension above and slightly in front; off
    // arm pulled down into the chest; chest square and past the hips.
    {t:1.91,wrist:.12,y:.56,turn:.12,tw:.32,crunch:.08,side:-.02,hp:.04,lean:.07,
     re:[.40,2.92,.16],rw:[.46,3.30,.34],le:[-.34,2.16,.10],lw:[-.20,1.86,.20],
     rk:[.22,.84,.10],ra:[.30,.22,-.14],lk:[-.18,.86,.06],la:[-.24,.20,-.06],p:-.35,py:0},

    // Whip through. Wrist pronates over, trunk crunches down on top of it.
    {t:2.02,wrist:1.05,y:.44,turn:.34,tw:.46,crunch:.20,side:-.05,hp:-.08,lean:.14,
     re:[.32,2.58,.42],rw:[.22,2.60,.82],le:[-.32,2.06,.02],lw:[-.26,1.76,.10],
     rk:[.24,.82,.22],ra:[.34,.18,.04],lk:[-.20,.84,.02],la:[-.26,.19,-.14],p:-1.20,py:.20},

    // Follow through, paddle finishing across the opposite hip.
    {t:2.20,wrist:1.70,y:.26,turn:.48,tw:.28,crunch:.16,side:-.05,hp:-.14,lean:.16,
     re:[.18,2.26,.58],rw:[-.20,2.02,.92],le:[-.30,2.00,-.04],lw:[-.30,1.70,.04],
     rk:[.26,.80,.30],ra:[.36,.17,.18],lk:[-.22,.82,.02],la:[-.28,.18,-.16],p:-1.90,py:.34},

    // Land and recover to a ready base.
    {t:2.7,wrist:1.35,y:0,turn:.26,tw:.06,crunch:.04,side:0,hp:-.03,lean:.05,
     re:[.30,2.04,.36],rw:[.02,1.84,.62],le:[-.32,1.98,.12],lw:[-.30,1.66,.28],
     rk:[.20,.84,.14],ra:[.24,.16,.12],lk:[-.20,.84,.02],la:[-.24,.16,.02],p:-2.10,py:.30},

    {t:7,wrist:1.35,y:0,turn:.26,tw:.06,crunch:.04,side:0,hp:-.03,lean:.05,
     re:[.30,2.04,.36],rw:[.02,1.84,.62],le:[-.32,1.98,.12],lw:[-.30,1.66,.28],
     rk:[.20,.84,.14],ra:[.24,.16,.12],lk:[-.20,.84,.02],la:[-.24,.16,.02],p:-2.10,py:.30}
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
      const sx=sd*.325,sz=0;
      const shoulder=[sx*c+sz*sn,2.30,-sx*sn+sz*c];
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

      // ── The hand ───────────────────────────────────────────────────────
      // Built on a small frame at the wrist: `u` runs along the forearm, `side`
      // across the knuckles, `up` out of the back of the hand. Everything else
      // is placed in that frame, so the hand stays correct however the arm is
      // swinging rather than only from one camera angle.
      const grips=sd===1;
      const u=norm([wrist[0]-elbow[0],wrist[1]-elbow[1],wrist[2]-elbow[2]]);
      const side=norm(cross(u,[0,1,0]));
      const up=norm(cross(side,u));

      // Wrist snap. The forearm pronates through contact and keeps rolling
      // afterwards — the single most recognisable thing about a smash, and the
      // reason the paddle face squares up exactly when it meets the ball.
      const roll=p.wrist??0;
      const rollAxis=(v,a)=>rotateAbout(v,u,a);
      const sideR=rollAxis(side,roll);
      const upR=rollAxis(up,roll);

      const at=(o,a,b,c)=>[
        wrist[0]+u[0]*a+sideR[0]*b+upR[0]*c,
        wrist[1]+u[1]*a+sideR[1]*b+upR[1]*c,
        wrist[2]+u[2]*a+sideR[2]*b+upR[2]*c,
      ];

      a.palm.position.set(...at(0,.052,0,.012));
      a.palm.quaternion.copy(frameQuat(u,upR));
      a.knuckle.position.set(...at(0,.105,0,.006));
      a.knuckle.quaternion.copy(frameQuat(u,upR));

      // Knuckles on an arc, and the outer fingers shorter — a straight row of
      // equal fingers is the thing that makes a CG hand look wrong.
      a.fingers.forEach((f,i)=>{
        const across=(i-1.5)*.052;
        const len=1-Math.abs(i-1.2)*.12;
        const base=at(0,.108,across,.004+Math.abs(i-1.5)*-.004);
        if(grips){
          // Curled round the grip: first joint forward, second hooked back
          // under, so the fingertips face the palm.
          const mid=[base[0]+u[0]*.052+upR[0]*-.030,base[1]+u[1]*.052+upR[1]*-.030,base[2]+u[2]*.052+upR[2]*-.030];
          const tip=[mid[0]-u[0]*.026+upR[0]*-.048,mid[1]-u[1]*.026+upR[1]*-.048,mid[2]-u[2]*.026+upR[2]*-.048];
          link(f.prox,base,mid);link(f.dist,mid,tip);f.tip.position.set(...tip);
        }else{
          // Open, with a natural slack curl rather than rigid spikes.
          const mid=[base[0]+u[0]*.062*len+upR[0]*-.012,base[1]+u[1]*.062*len+upR[1]*-.012,base[2]+u[2]*.062*len+upR[2]*-.012];
          const tip=[mid[0]+u[0]*.048*len+upR[0]*-.020,mid[1]+u[1]*.048*len+upR[1]*-.020,mid[2]+u[2]*.048*len+upR[2]*-.020];
          link(f.prox,base,mid);link(f.dist,mid,tip);f.tip.position.set(...tip);
        }
      });

      // The thumb opposes across the grip instead of lying alongside.
      const tBase=at(0,.055,sd*.072,-.006);
      const tMid=grips
        ? [tBase[0]+u[0]*.05+sideR[0]*-sd*.042,tBase[1]+u[1]*.05+sideR[1]*-sd*.042,tBase[2]+u[2]*.05+sideR[2]*-sd*.042]
        : [tBase[0]+u[0]*.05+sideR[0]*sd*.03,tBase[1]+u[1]*.05+sideR[1]*sd*.03,tBase[2]+u[2]*.05+sideR[2]*sd*.03];
      const tTip=grips
        ? [tMid[0]+u[0]*.03+upR[0]*-.026,tMid[1]+u[1]*.03+upR[1]*-.026,tMid[2]+u[2]*.03+upR[2]*-.026]
        : [tMid[0]+u[0]*.04,tMid[1]+u[1]*.04,tMid[2]+u[2]*.04];
      link(a.thumbProx,tBase,tMid);link(a.thumbDist,tMid,tTip);
    }

    for(const l of legs){
      const sd=l.side,hip=[sd*.155,1.46,0];
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
    paddle.rotation.set(p.p,(p.py??0),-.12+(p.wrist??0)*.86);
    // Read by the verification harness; costs nothing and makes the swing testable.
    if(typeof window!=='undefined')window.__wristProbe=p.wrist??0;
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
    // Push in through the swing, then kick back at impact.
    const pushIn=smooth(1.30,1.88,t)*(1-smooth(1.91,2.16,t));
    const kick=smooth(1.90,1.94,t)*(1-smooth(1.94,2.10,t));
    camera.position.z-=pushIn*1.45;
    camera.position.y-=pushIn*.28;
    camera.position.z+=kick*.55;

    const shake=(1-smooth(2.64,2.91,t))*smooth(2.6,2.65,t)*.06+kick*.045;
    camera.position.x+=Math.sin(t*71)*shake;camera.position.y+=Math.sin(t*97)*shake;camera.lookAt(target);camera.updateProjectionMatrix();
    ball.position.copy(ballPosition(t));
    if(isMobile&&t>1.91){const f=clamp((t-1.91)/.88,0,1);ball.position.z+=5.0*f*f;ball.position.y+=.9*f*f;}
    ball.visible=t<2.84;ball.rotation.set(t*4,t*6,-t*2);
    // Squash on contact, released over the next fifth of a second.
    const squash=smooth(1.88,1.92,t)*(1-smooth(1.92,2.08,t));
    ball.scale.set(1-squash*.34,1+squash*.22,1+squash*.22);ball.scale.multiplyScalar(1+smooth(2.2,2.81,t)*8.5);
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
export { createIntro };
export default createIntro;
