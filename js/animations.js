// Subtle view transitions; the separate monitor module handles the CRT effect.
export function enterView(element) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap) return;
  window.gsap.fromTo(element, { opacity: .65 }, { opacity: 1, duration: .16, clearProps: 'opacity' });
}


// Layout transitions: measure the current visual positions, change document flow,
// then ease each row into its new position. One timeline prevents stale callbacks
// when a user switches dropdowns quickly.
let dropdownMotion;
export function animateDropdown(dropdown, opening, change = () => {}) {
  const gsap = window.gsap;
  const rows = [...document.querySelectorAll('.control-row, .submit-row, #save-status')];
  const before = rows.map(row => row.getBoundingClientRect().top);
  // Finish prior cleanup only after capturing its current on-screen positions.
  dropdownMotion?.progress(1);
  dropdownMotion = null;
  const list = dropdown.list;
  const cleanList = () => {
    for (const prop of ['position', 'top', 'left', 'width', 'clip-path', 'pointer-events', 'will-change']) list.style.removeProperty(prop);
    list.hidden = !dropdown.opened;
    list.inert = !dropdown.opened;
  };
  list.hidden = false;
  list.inert = !opening;
  if (!opening) {
    // Keep the closing menu visible without reserving its final layout space.
    Object.assign(list.style, {position:'absolute', top:'100%', left:'0', width:'100%', pointerEvents:'none'});
  }
  change();
  if (!gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cleanList();
    return;
  }
  const after = rows.map(row => row.getBoundingClientRect().top);
  const moving = rows.map((row,i) => ({row, offset:before[i]-after[i]})).filter(item => Math.abs(item.offset) > .5);
  const duration = opening ? .42 : .32;
  dropdownMotion = gsap.timeline({onComplete: () => {
    cleanList();
    dropdownMotion = null;
  }});
  list.style.willChange = 'clip-path';
  dropdownMotion.fromTo(list,
    {clipPath: opening ? 'inset(0 0 100% 0)' : 'inset(0 0 0% 0)'},
    {clipPath: opening ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)', duration, ease:'power3.out'}, 0);
  moving.forEach(({row,offset},index) => {
    dropdownMotion.fromTo(row, {y:offset}, {
      y:0, duration:opening ? .48 : .4, ease:'power3.out', clearProps:'transform'
    }, .035 + index * .035);
  });
}
