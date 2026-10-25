// Subtle view transitions; the separate monitor module handles the CRT effect.
export function enterView(element) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap) return;
  window.gsap.fromTo(element, { opacity: .65 }, { opacity: 1, duration: .16, clearProps: 'opacity' });
}

