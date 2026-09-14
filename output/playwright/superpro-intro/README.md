# SuperPro smash entrance — design preview

Review prototype only. Nothing in this folder is imported by the Next.js app.
No page-load, refresh, login, or signup behavior has been changed. Those triggers
are pending approval of this animation.

## Sequence (6.5 seconds desktop / 4.8 seconds mobile)

- 0–1.9 s: stadium lighting, branded athlete, overhead jump and paddle wind-up.
- 1.91 s: the paddle strikes a 3D, 40-hole pickleball.
- 1.91–2.9 s: ball accelerates toward the camera, grows, and fills the screen.
- 2.9–4.6 s: original SuperPro logo appears with a short spring and depth rotation.
- 4.6–6.2 s: logo follows an arc into the measured location of the live header logo.
- 6.5 s: overlay is gone and the home page is fully visible.

The prototype uses Three.js 0.180.0 with an original procedural athlete, court,
paddle, lighting, and ball. Logo PNGs come from this repository. All geometry is
local, with no external model or image service required.

Mobile uses the same sequence at a shorter duration, a 1.25 pixel-ratio cap,
512px shadows, and a lighter net. Slow devices drop to pixel ratio 1 with shadows
disabled. The minified bundle is approximately 581 KiB / 176 KiB with gzip.
Dynamic viewport height, safe-area positioning, portrait/landscape framing, a
skip button, Escape, reduced-motion handling, and a non-WebGL logo fallback are
included in the preview. A wall-clock timeout restores the page if rendering
slows down. Rendering stops after the 3D segment. The prototype retains its scene
for replay; application integration should dispose it after completion.

## Build and review

```powershell
npm.cmd ci --prefix output/playwright/superpro-intro
npm.cmd run build --prefix output/playwright/superpro-intro
npx.cmd --yes --package @playwright/cli playwright-cli -s=superpro-preview open https://superpro.vercel.app --browser chrome
npx.cmd --yes --package @playwright/cli playwright-cli -s=superpro-preview run-code --filename output/playwright/superpro-intro/inspect.cjs
```

The inspection script loads the preview bundle in the local browser session over
the actual live home page. It changes no server files or account data. Dismiss the
site's welcome dialog in the browser before capturing the home page. Use
`inspect-mobile.cjs` for the 390 × 844 layout.

The browser exposes `window.superproIntro.play()`, `.seek(seconds)`, and `.dispose()`.
Reloading the live page removes the preview entirely.

Open `http://127.0.0.1:4178/?mobile` while `node server.mjs` is running to review
the compact mobile MP4. The video is H.264, muted, and plays inline. Desktop and
mobile recordings are selectable in the viewer. `seek()` uses the original
6.5-second design timeline; `play()` automatically uses the shorter mobile timing.

## Integration after approval

Move the accepted scene into a lazily loaded client component. Replace the old
BallIntro, trigger on hard page loads and successful login/signup, coordinate the
existing welcome dialog, honor reduced motion, add skip/Escape handling, and let
the website remain available if WebGL cannot initialize. Dispose render resources
after each play. Keep unrelated assessment work untouched.

Three.js API reference: https://threejs.org/docs/pages/CapsuleGeometry.html
