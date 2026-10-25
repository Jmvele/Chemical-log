// CRT glass. Real HTML controls remain accessible and editable.
// Tune the look here. Text and control geometry stay undistorted.
const MONITOR = {
  colorOffset: 0.242, // 10% more than the previous 0.22px separation
  grain: 0.008, scanlines: 0.012, vignette: 0.16,
  framesPerSecond: 24, pixelRatio: 1.5
};

export function initMonitor({ loadThree = () => import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js') } = {}) {
  const screen = document.querySelector('.monitor-screen');
  if (!screen || new URLSearchParams(location.search).get('effects') === 'off') return;
  document.documentElement.classList.add('monitor-on');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'monitor-filter');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  // Separate colors uniformly without warping or blurring the source.
  svg.innerHTML = `<defs><filter id="monitor-glass" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
    <feOffset in="red" dx="-${MONITOR.colorOffset}" result="redShift"/>
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cyan"/>
    <feOffset in="cyan" dx="${MONITOR.colorOffset}" result="cyanShift"/>
    <feBlend in="redShift" in2="cyanShift" mode="screen"/>
  </filter></defs>`;
  document.body.append(svg);
  screen.classList.add('monitor-fringing');
  let renderer, scene, camera, material, geometry, animationFrame = 0, lastFrame = -Infinity;
  let disposed = false, contextLost = false;

  function resize() {
    const { width, height } = screen.getBoundingClientRect();
    if (!width || !height) return;
    if (renderer && !contextLost) {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MONITOR.pixelRatio));
      renderer.setSize(width, height, false);
      material.uniforms.uResolution.value.set(width, height);
      render(0);
    }
  }
  function render(time) {
    if (!renderer || contextLost || disposed) return;
    material.uniforms.uTime.value = reducedMotion.matches ? 0 : time / 1000;
    renderer.render(scene, camera);
  }
  function tick(time) {
    if (disposed || document.hidden || reducedMotion.matches || contextLost) return;
    if (time - lastFrame >= 1000 / MONITOR.framesPerSecond) {
      render(time);
      lastFrame = time;
    }
    animationFrame = requestAnimationFrame(tick);
  }
  function resume() {
    cancelAnimationFrame(animationFrame);
    if (!renderer || document.hidden || disposed || contextLost) return;
    render(performance.now());
    if (!reducedMotion.matches) animationFrame = requestAnimationFrame(tick);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(screen);
  document.addEventListener('visibilitychange', resume);
  reducedMotion.addEventListener('change', resume);
  resize();

  // Independent, pinned dependency: an unavailable CDN/GPU must not block the form.
  // Dynamic import also works in the self-contained file:// preview.
  loadThree().then(THREE => {
    if (disposed) return;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
      renderer.domElement.className = 'monitor-canvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(animationFrame);
        screen.classList.remove('monitor-webgl');
      });
      renderer.domElement.addEventListener('webglcontextrestored', () => {
        contextLost = false;
        resize();
        screen.classList.add('monitor-webgl');
        resume();
      });
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      material = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: {
          uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(1, 1) },
          uGrain: { value: MONITOR.grain }, uScanlines: { value: MONITOR.scanlines },
          uVignette: { value: MONITOR.vignette }
        },
        vertexShader: `varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `precision highp float;
          varying vec2 vUv;
          uniform vec2 uResolution;
          uniform float uTime, uGrain, uScanlines, uVignette;
          float noise(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
          }
          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float y = clamp(1.0 - vUv.y, 0.0, 1.0);
            // All five stops from the original Figma gradient.
            vec3 col = mix(vec3(8.,3.,22.), vec3(12.,8.,41.), clamp(y/.25,0.,1.));
            col = mix(col, vec3(17.,18.,63.), clamp((y-.25)/.23,0.,1.));
            col = mix(col, vec3(28.,49.,92.), clamp((y-.48)/.24,0.,1.));
            col = mix(col, vec3(54.,91.,139.), clamp((y-.72)/.28,0.,1.));
            col /= 255.0;
            float grain = noise(floor(vUv * uResolution) + floor(uTime*24.0)) - .5;
            col += grain * uGrain;
            col *= 1.0 - uScanlines * (.5 + .5*cos(vUv.y*uResolution.y*3.14159265));
            col *= 1.0 - uVignette * pow(clamp(dot(p,p)/2.0,0.,1.),1.3);
            col += .008 * exp(-3.0*dot(p-vec2(-.3,.6),p-vec2(-.3,.6)));
            gl_FragColor = vec4(col, 1.0);
          }`
      });
      geometry = new THREE.PlaneGeometry(2, 2);
      scene.add(new THREE.Mesh(geometry, material));
      screen.prepend(renderer.domElement);
      resize();
      screen.classList.add('monitor-webgl');
      resume();
    } catch (error) {
      renderer?.domElement.remove();
      renderer?.dispose();
      renderer = null;
      console.info('Using the CSS monitor effect; WebGL is unavailable.', error);
    }
  }).catch(() => {
    console.info('Using the CSS monitor effect; Three.js could not load.');
  });

  window.addEventListener('pagehide', event => {
    cancelAnimationFrame(animationFrame);
    if (event.persisted) return;
    disposed = true;
    observer.disconnect();
    document.removeEventListener('visibilitychange', resume);
    reducedMotion.removeEventListener('change', resume);
    geometry?.dispose();
    material?.dispose();
    renderer?.dispose();
  });
  window.addEventListener('pageshow', resume);
}

