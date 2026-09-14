# Preview checks — 2026-09-14

The website was not changed. The isolated bundle was loaded into local browser
sessions over https://superpro.vercel.app/.

| Check | Result |
| --- | --- |
| Desktop Chrome, 1440 × 900 | Recorded full 6.5-second sequence and header return |
| Chrome with Pixel 7 emulation, 412 × 839 | Pass: full viewport, no horizontal overflow, logo alignment within 1px, completion, skip, reduced motion, and fallback |
| WebKit with iPhone 13 emulation, 390 × 664 | Pass: full viewport, no horizontal overflow, logo alignment within 1px, completion, skip, reduced motion, and fallback |
| Landscape, 844 × 390 | Captured for both Chromium and WebKit |
| Firefox | Not verified: downloaded browser could not launch on this Windows host, in either headless or headed mode |
| Physical Android/iPhone devices | Not tested; emulator checks do not certify all devices or browser versions |

Mobile rendering uses 1.25 pixel ratio, 512px shadows, approximately 114–116 draw
calls, and 46,874 triangles in the sampled scene. Slow frames trigger a lower
rendering quality. The clip is 4.8 seconds, while the review video also includes
the home page before and after the intro.

The timed completion guard was added after WebKit's slow frame delivery delayed
the initial playback check. Final functional checks passed with no captured
JavaScript errors. The live site separately returned 404 for manifest.json in
WebKit; this preview did not alter that existing resource.

WebKit's standard screenshots on this Windows host omitted the WebGL canvas;
the renderer reported valid draw calls, an active context, and no WebGL error.
Canvas readback is included as an additional visual check. This is a known class
of browser automation screenshot limitation, and actual iPhone visual testing
is still required: https://github.com/microsoft/playwright/issues/586

Outputs: superpro-smash-desktop.mp4 and superpro-smash-mobile.mp4. Both are H.264
MP4 files; the local review player uses muted inline playback and native controls.
