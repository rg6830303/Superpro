from pathlib import Path
p=Path(__file__).with_name('film.js')
s=p.read_text()
s=s.replace(" const cityTitle=label('K O L K A T A',83,'#e5fff8');cityTitle.position.set(0,.78,0);",'')
start=s.index('  const cityVisible=t<1.34;')
end=s.index('   paddle.visible=t<1.90;',start)
s=s[:start]+'  {\n'+s[end:]
s=s.replace('cam.lookAt(0,0,0);renderer.render(stage,cam);','cam.lookAt(0,0,0);renderer.setRenderTarget(t<1.48?shotB:null);renderer.render(stage,cam);renderer.setRenderTarget(null);')
start=s.index('  const cityAlpha=')
end=s.index('  const markIn=',start)
s=s[:start]+'''  if(t<1.48){
   if(t<.82){renderCity('bridge',t,shotA);renderCity('victoria',t,shotB);dissolve(sm(.52,.82,t));}
   else {renderCity('victoria',t,shotA);dissolve(sm(1.15,1.48,t));}
  }
  bridgeTitle.material.opacity=sm(0,.12,t)*(1-sm(.50,.73,t));
  vicTitle.material.opacity=sm(.71,.90,t)*(1-sm(1.16,1.39,t));
'''+s[end:]
insert=s.index(' function seek(t){')
s=s[:insert]+''' // Render overlapping shots into separate targets for continuous eased dissolves.
 const shotA=new THREE.WebGLRenderTarget(width,height,{samples:4});
 const shotB=new THREE.WebGLRenderTarget(width,height,{samples:4});
 const transitionScene=new THREE.Scene(),transitionCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const transitionMaterial=new THREE.ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,uniforms:{a:{value:shotA.texture},b:{value:shotB.texture},progress:{value:0}},vertexShader:'varying vec2 uvCoord;void main(){uvCoord=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D a;uniform sampler2D b;uniform float progress;varying vec2 uvCoord;void main(){gl_FragColor=mix(texture2D(a,uvCoord),texture2D(b,uvCoord),progress);#include <colorspace_fragment>\\n}'});
 transitionMaterial.fragmentShader=transitionMaterial.fragmentShader.replace(';#include',';\\n#include');
 transitionScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),transitionMaterial));
 function dissolve(progress){transitionMaterial.uniforms.progress.value=progress;renderer.setRenderTarget(null);renderer.render(transitionScene,transitionCam);}
 function renderCity(which,t,target){
  bridge.visible=which==='bridge';victoria.visible=which==='victoria';
  if(bridge.visible){const f=sm(0,.95,t);cityCam.position.set(mix(12,10.5,f),mix(5.8,5.3,f),(portrait?29.5:15.8)-.9*f);cityCam.lookAt(.05,1.1,0);}
  else {const f=sm(.45,1.55,t);cityCam.position.set(mix(4,2.5,f),mix(4.7,4.05,f),(portrait?22.5:10.8)-(portrait?1:.4)*f);cityCam.lookAt(0,1.8,0);}
  renderer.setRenderTarget(target);renderer.render(city,cityCam);renderer.setRenderTarget(null);
 }
'''+s[insert:]
# Ease the logo into view during the departing shards, without a spring snap.
s=s.replace('sm(2.51,2.73,t),fly=sm(3.08,3.66,t);mark.visible=t>2.50','sm(2.39,2.82,t),fly=sm(3.02,3.70,t);mark.visible=t>2.39')
s=s.replace('const spring=1+Math.sin((t-2.60)*23)*Math.exp(-Math.max(0,t-2.60)*10)*.075;','const spring=1;')
s=s.replace('mix(.72,1,markIn)','mix(.90,1,markIn)')
s=s.replace("blur&&t>1.47&&t<2.70","blur&&t<3.71")
p.write_text(s)
