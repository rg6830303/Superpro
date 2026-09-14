async (page) => {
  return await page.evaluate(async()=>{
    const root=document.querySelector('#superpro-smash-preview'),canvas=root?.querySelector('canvas'),gl=canvas?.getContext('webgl2');
    const result={mode:window.superproIntro?.mode,playing:window.superproIntro?.playing,duration:window.superproIntro?.duration,stats:window.superproIntro?.stats,time:root?.dataset.time,display:root?.style.display,visibility:document.querySelector('header img')?.style.visibility,documentVisibility:document.visibilityState,webglLost:gl?.isContextLost(),webglError:gl?.getError(),canvasSize:canvas?[canvas.width,canvas.height]:null,now:performance.now()};
    result.raf=await Promise.race([new Promise(resolve=>requestAnimationFrame(t=>resolve(t))),new Promise(resolve=>setTimeout(()=>resolve('timeout'),1500))]);
    return result;
  });
}
