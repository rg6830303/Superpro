/**
 * The first thing painted on the visit that plays the entrance.
 *
 * The smash entrance cannot exist until React has hydrated and the Three.js
 * chunk has downloaded, which is a few hundred milliseconds during which the
 * home page would otherwise be plainly visible — the flash this removes. So the
 * cover is server-rendered, carries its own inline <style> rather than waiting
 * on the stylesheet, and is already on screen before a single line of our
 * JavaScript runs.
 *
 * On every visit that will NOT play the entrance it is never painted at all:
 * the entrance runs once per session, and a full-screen logo on the other
 * loads is just a delay wearing a brand. The decision is made by a blocking
 * script in <head> (see `IntroGate`), which marks the document before first
 * paint; the cover's own script then hides it before it can be seen.
 *
 * The cover is hidden rather than removed at that point because removing it
 * pre-hydration only has React put it straight back — the server HTML contains
 * it, so React restores what it expects to find. It is taken out of the DOM
 * afterwards, once hydration has settled.
 *
 * It clears three ways, in order of preference:
 *   1. The entrance calls `__superproBootClear()` after painting frame one.
 *   2. Failing that, an inline script removes it on a timer.
 *   3. Failing even that — JavaScript disabled or broken — a CSS animation
 *      fades it out on its own. The site is never left hidden behind it.
 */
export function BootCover() {
  return (
    <>
      <style
        // Inline: a stylesheet that arrives one round trip later is too late.
        dangerouslySetInnerHTML={{
          __html: `
/* Applied by the cover's own script before the browser paints, on the loads
   that are not going to play the entrance. */
#superpro-boot.is-skipped{display:none}
#superpro-boot{
  position:fixed;inset:0;z-index:2147483500;
  display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 68% 38%,#123e50 0%,#041c2c 48%,#010e18 100%);
  animation:superpro-boot-clear .45s ease-out 5.5s both;
}
#superpro-boot img{width:min(210px,42vw);height:auto;opacity:.92;
  animation:superpro-boot-pulse 1.6s ease-in-out infinite}
@keyframes superpro-boot-pulse{0%,100%{opacity:.55;transform:scale(.98)}50%{opacity:.95;transform:scale(1.02)}}
@keyframes superpro-boot-clear{to{opacity:0;visibility:hidden;pointer-events:none}}
#superpro-boot.is-done{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .25s ease-out}
/* While the entrance is genuinely on its way, the no-JS fade is pushed back so
   it cannot pull the cover out from under a scene that is about to paint. */
#superpro-boot.is-holding{animation-delay:9s}
@media(prefers-reduced-motion:reduce){
  #superpro-boot{animation-delay:.2s}
  #superpro-boot img{animation:none;opacity:.9}
}`,
        }}
      />
      <div id="superpro-boot">
        {/* Plain <img>: next/image would defer this behind the very hydration
            the cover exists to hide. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/superpro-logo-white.png" alt="" width={672} height={381} />
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
  var el=document.getElementById('superpro-boot');
  if(!el)return;
  var done=false,timer=0;
  function clear(){
    if(done)return;done=true;
    clearTimeout(timer);
    el.classList.add('is-done');
    setTimeout(function(){el.remove();},300);
  }
  window.__superproBootClear=clear;
  // The entrance calls this the moment it starts fetching, to say it is coming
  // and roughly how long it is worth waiting. Without it the cover would lift
  // on its own timer and let the page show just before the scene appears.
  window.__superproBootHold=function(budgetMs){
    if(done)return;
    clearTimeout(timer);
    el.classList.add('is-holding');
    timer=setTimeout(clear,budgetMs||3000);
  };
  // Decided by the gate script in <head>, which ran before this element was
  // parsed. Hidden now, dropped from the DOM once hydration has settled —
  // removing it any earlier only has React restore what it expects to find.
  if(window.__superproSkipIntro){
    el.classList.add('is-skipped');
    done=true;
    setTimeout(function(){el.remove();},1200);
    return;
  }
  // Failsafe: never hold the page behind the cover waiting on a scene that is
  // not coming.
  timer=setTimeout(clear,5200);
})();`,
        }}
      />
    </>
  );
}

/**
 * Decides, before the browser paints anything, whether this load plays the
 * entrance — and marks the document so the cover's own stylesheet can hide it
 * without a frame of logo appearing first.
 *
 * This is the no-flash pattern a theme switcher uses, and for the same reason:
 * the answer lives in sessionStorage, which only the client can read, so it has
 * to be read in a blocking script rather than rendered on the server.
 */
export function IntroGate() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){
  var seen=false;
  // Must match INTRO_SEEN_KEY in lib/intro-once.ts.
  try{seen=sessionStorage.getItem('superpro:intro-seen')==='1';}catch(e){}
  var celebrating=/[?&]welcome=(signup|login)\\b/.test(location.search);
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var noWebgl=typeof WebGLRenderingContext==='undefined';
  // A plain global, not an attribute on <html> or <body>: React reconciles
  // those during hydration and strips anything it did not itself render.
  window.__superproSkipIntro=!((!seen||celebrating)&&!reduced&&!noWebgl);
})();`,
      }}
    />
  );
}
