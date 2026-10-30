/* Native links work without JavaScript; no video autoplays. */
(() => {
 const panels = [...document.querySelectorAll('.theme-panel')];
 const links = [...document.querySelectorAll('[data-theme]')];
 function select() {
  const selected = panels.find(p => p.id === location.hash.slice(1)) || panels[0];
  for (const panel of panels) {
   panel.hidden = panel !== selected;
   if (panel.hidden) panel.querySelector('video').pause();
  }
  for (const link of links) {
   if (link.dataset.theme === selected.id) link.setAttribute('aria-current', 'true');
   else link.removeAttribute('aria-current');
  }
 }
 addEventListener('hashchange', select);
 document.addEventListener('visibilitychange', () => {
  if (document.hidden) panels.forEach(p => p.querySelector('video').pause());
 });
 select();
})();
