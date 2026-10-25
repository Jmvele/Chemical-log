# Monitor effect

Inspired by the CRT glass in https://www.shader.se/ and the supplied screenshot.

The screen uses three layers:
- Three.js draws the original five-stop gradient with subtle animated grain, scanlines and darker edges.
- An SVG color filter separates red/cyan channels by 0.242px in each direction (10% above the previous setting). It applies no curvature or blur to text and controls, keeping borders straight. The outer glass edge stays outside this filter.
- CSS adds rounded glass corners, text glow and a static texture fallback. The native delete dialog keeps its normal focus handling and receives matching glow/color shadows.

Edit `MONITOR` at the top of `js/monitor.js` to adjust color separation, grain, scanlines and vignette. Edit the CRT section at the end of `css/styles.css` for corner radius, title glow and screen margin.

The effect does not capture the form into an image or send its contents anywhere. Inputs remain native HTML. Three.js 0.170.0 loads from jsDelivr; loading it is independent of initializing the form. If it cannot load or WebGL is unavailable, the CSS/SVG treatment remains. Reduced motion freezes the grain; background tabs stop rendering. Render resolution is capped at 1.5 device pixels per CSS pixel and animation at 24 fps.

For a comparison without effects, open `preview.html?effects=off#new-log`. Remove `?effects=off` to restore them. After editing source files, run `node prepare-preview.mjs` to rebuild the double-clickable preview.

Verification: original form/data tests pass; browser appearance still needs local visual review because the agent's inspection browser could not reach the local HTTP preview. Production Firestore permissions and deployment are unaffected.
