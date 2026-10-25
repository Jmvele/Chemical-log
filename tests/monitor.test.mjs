import test from 'node:test';
import assert from 'node:assert/strict';
import { initMonitor } from '../js/monitor.js';

// Exercise lifecycle and failures without requiring a GPU or contacting Firestore.
function environment(t, { reduced = false, width = 1280, search = '' } = {}) {
  const events = () => ({
    listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    removeEventListener(name) { delete this.listeners[name]; }
  });
  const element = () => ({
    ...events(), attrs: {}, classList: new Set(),
    setAttribute(name, value) { this.attrs[name] = value; },
    remove() {}
  });
  const screen = element();
  screen.classList.remove = screen.classList.delete.bind(screen.classList);
  screen.getBoundingClientRect = () => ({ width, height: 800 });
  screen.prepend = canvas => { screen.canvas = canvas; };
  const primitives = new Map(['feImage', 'feDisplacementMap'].map(name => [name, element()]));
  const svg = { ...element(), querySelector: name => primitives.get(name) };
  const media = { ...events(), matches: reduced };
  const windowStub = events();
  const doc = {
    ...events(), hidden: false,
    documentElement: { classList: new Set() },
    body: { append() {} },
    querySelector: () => screen,
    createElementNS: () => svg,
    createElement: () => ({
      getContext: () => ({ createImageData: (w,h) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData() {} }),
      toDataURL: () => 'data:image/png;base64,test'
    })
  };
  const frames = new Map();
  let frameId = 0, draws = 0, disposed = false, observerStopped = false;
  const install = {
    document: doc, window: windowStub, location: { search }, devicePixelRatio: 3,
    matchMedia: () => media,
    ResizeObserver: class { observe() {} disconnect() { observerStopped = true; } },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id)
  };
  for (const [name, value] of Object.entries(install)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
  }
  let renderer;
  const THREE = {
    WebGLRenderer: class {
      constructor() { renderer = this; this.domElement = element(); }
      setPixelRatio(value) { this.ratio = value; }
      setSize(w,h) { this.size = [w,h]; }
      render() { draws++; }
      dispose() { disposed = true; }
    },
    Scene: class { add() {} }, OrthographicCamera: class {},
    Vector2: class { set() {} },
    ShaderMaterial: class { constructor(options) { Object.assign(this, options); } dispose() {} },
    PlaneGeometry: class { dispose() {} }, Mesh: class {}
  };
  return { screen, doc, media, windowStub, primitives, frames, THREE,
    stats: () => ({ draws, disposed, observerStopped, renderer }) };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('effects=off keeps the original page and never loads Three.js', t => {
  const env = environment(t, { search: '?effects=off' });
  initMonitor({ loadThree: () => { throw new Error('Must not load'); } });
  assert.equal(env.doc.documentElement.classList.size, 0);
});

test('a failed CDN leaves the static monitor treatment and schedules no GPU frames', async t => {
  const env = environment(t);
  initMonitor({ loadThree: () => Promise.reject(new Error('Offline')) });
  await settle();
  assert.ok(env.screen.classList.has('monitor-fringing'));
  assert.ok(!env.screen.classList.has('monitor-webgl'));
  assert.equal(env.frames.size, 0);
});

test('reduced motion renders a static mobile screen with capped resolution', async t => {
  const env = environment(t, { reduced: true, width: 390 });
  initMonitor({ loadThree: () => Promise.resolve(env.THREE) });
  await settle();
  assert.ok(env.screen.classList.has('monitor-webgl'));
  assert.ok(env.stats().draws > 0);
  assert.equal(env.frames.size, 0);
  assert.equal(env.stats().renderer.ratio, 1.5);

});

test('hidden tabs and context loss suspend rendering; restoration resumes and exit disposes', async t => {
  const env = environment(t);
  initMonitor({ loadThree: () => Promise.resolve(env.THREE) });
  await settle();
  assert.equal(env.frames.size, 1);
  env.doc.hidden = true;
  env.doc.listeners.visibilitychange();
  assert.equal(env.frames.size, 0);
  env.doc.hidden = false;
  env.doc.listeners.visibilitychange();
  assert.equal(env.frames.size, 1);
  env.screen.canvas.listeners.webglcontextlost({ preventDefault() {} });
  assert.equal(env.frames.size, 0);
  assert.ok(!env.screen.classList.has('monitor-webgl'));
  env.screen.canvas.listeners.webglcontextrestored();
  assert.ok(env.screen.classList.has('monitor-webgl'));
  assert.equal(env.frames.size, 1);
  env.windowStub.listeners.pagehide({ persisted: false });
  assert.equal(env.frames.size, 0);
  assert.ok(env.stats().disposed);
  assert.ok(env.stats().observerStopped);
});
