from pathlib import Path
p=Path(__file__).with_name('film.js')
s=p.read_text()
s=s.replace('const DURATION=3.8','const DURATION=3.95')
start=s.index(' function label(')
end=s.index(' const flash=',start)
s=s[:start]+s[end:]
s='\n'.join(line for line in s.splitlines() if 'bridgeTitle' not in line and 'vicTitle' not in line)
s=s.replace('t=clamp(t,0,DURATION);renderer.autoClear=true;','t=clamp(t,0,DURATION);t-=.15*sm(1.94,2.80,t);renderer.autoClear=true;')
s=s.replace('i<24;i++){const a=i*2.39996','i<54;i++){const a=i*2.39996').replace('i<106;i++)seeds','i<160;i++)seeds')
s=s.replace('const thickness=.015+rand(i)*.015','const thickness=.022+rand(i)*.018')
s=s.replace('bevelThickness:.0025,bevelSize:.002','bevelThickness:.0035,bevelSize:.003')
s=s.replace('t-1.995-s.delay','t-2.045-s.delay').replace('burst=u*1.35','burst=u*1.12')
s=s.replace('t>=1.935&&t<2.13','t>=1.935&&t<2.25').replace('1-sm(2.02,2.13,t)','1-sm(2.08,2.25,t)')
insert=s.index(' const flash=')
s=s[:insert]+''' // Branching micro-cracks and concentric fractures surround the impact point.
 for(let i=0;i<80;i++){
  const angle=i*2.39996,base=.06+rand(i+630)*.62,length=.09+rand(i+812)*.32,pts=[];
  for(let k=0;k<7;k++){const f=k/6,a=angle+f*(rand(i+529)-.5)*1.8,r=base+f*length;pts.push(V(Math.cos(a)*r,Math.sin(a)*r,glassZ+.047));}
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xd6fff7,transparent:true,opacity:.7}));fractureGroup.add(line);fractures.push(line);
 }
 const pixelsCount=680,pixelPositions=new Float32Array(pixelsCount*3),pixelSizes=new Float32Array(pixelsCount),pixelSeeds=new Float32Array(pixelsCount);
 for(let i=0;i<pixelsCount;i++){pixelSizes[i]=(1.5+rand(i+570)*5.5)*(height/1920);pixelSeeds[i]=rand(i+810);}
 const pixelsGeo=new THREE.BufferGeometry();pixelsGeo.setAttribute('position',new THREE.BufferAttribute(pixelPositions,3));pixelsGeo.setAttribute('pixelSize',new THREE.BufferAttribute(pixelSizes,1));pixelsGeo.setAttribute('seed',new THREE.BufferAttribute(pixelSeeds,1));
 const pixelsMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{fade:{value:0},time:{value:0}},vertexShader:'attribute float pixelSize;attribute float seed;varying float vSeed;void main(){vSeed=seed;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(pixelSize*4./max(.9,-mv.z),1.,14.);}',fragmentShader:'uniform float fade;uniform float time;varying float vSeed;void main(){float edge=step(.10,gl_PointCoord.x)*step(.10,gl_PointCoord.y)*step(gl_PointCoord.x,.90)*step(gl_PointCoord.y,.90);float twinkle=.48+.52*pow(sin(time*17.+vSeed*48.),2.);vec3 color=mix(vec3(.25,.8,.72),vec3(.9,1.,1.),vSeed);gl_FragColor=vec4(color,fade*edge*twinkle);}' });
 const pixels=new THREE.Points(pixelsGeo,pixelsMat);stage.add(pixels);
'''+s[insert:]
insert=s.index('   const shake=')
s=s[:insert]+'''   const pu=Math.max(0,t-2.005);pixels.visible=pu>0&&t<2.91;
   for(let i=0;i<pixelsCount;i++){const a=i*2.399963,speed=.55+rand(i+946)*4.4,r=.04+rand(i+919)*.22+pu*speed;pixelPositions[i*3]=Math.cos(a)*r;pixelPositions[i*3+1]=Math.sin(a)*r-pu*pu*1.25;pixelPositions[i*3+2]=glassZ+pu*(.5+rand(i+510)*3.2);}
   pixelsGeo.attributes.position.needsUpdate=true;pixelsMat.uniforms.fade.value=sm(2.005,2.04,t)*(1-sm(2.35,2.89,t))*.85;pixelsMat.uniforms.time.value=t;
'''+s[insert:]
# Keep the crack edge definition sharp; motion blur still covers the city and logo travel.
s=s.replace('blur&&t<3.71','blur&&t<3.86&&!(t>1.94&&t<2.40)')
p.write_text(s)
p=Path(__file__).with_name('render.cjs')
s=p.read_text().replace('Math.round(3.8*fps)','Math.round(3.95*fps)').replace("['impact',1.986]","['impact',2.08]").replace("['glass',2.15]","['glass',2.28]").replace("['shards',2.33]","['shards',2.48]").replace("['dock',3.75]","['dock',3.92]")
p.write_text(s)
