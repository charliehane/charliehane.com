// art-loader.js
//
// Loads SVG art from the /assets folder into placeholder elements, so you
// can swap art without touching HTML.
//
// Two patterns:
//
//   1. Single placeholder:
//      <div data-art="gravestone"></div>
//      → fetched from assets/gravestone.svg, inlined.
//
//   2. JS-rendered list (clouds, birds): expose globals on window.ART_CACHE
//      so other scripts (production.js, postproduction-dig.js) can grab the
//      SVG markup synchronously after content:loaded fires.
//
// To add a new swappable art piece:
//   • drop the SVG into assets/<name>.svg
//   • add `<div data-art="<name>"></div>` where it should appear
//   • or: read window.ART_CACHE['<name>'] from another script

(() => {
  window.ART_CACHE = window.ART_CACHE || {};

  // every art name we need to make available globally (preloaded so other
  // scripts can read them without async juggling)
  const PRELOAD = [
    'cloud', 'bird', 'gravestone', 'boot', 'tree',
    'bike-with-rider', 'car', 'launched-figure', 'worm', 'coffin',
    'skeleton', 'charlie-figure', 'stick-figure', 'smushed-body',
  ];

  const fetchArt = (name) =>
    fetch(`assets/${name}.svg`, { cache: 'no-cache' })
      .then(r => r.ok ? r.text() : null)
      .then(svg => { if (svg) window.ART_CACHE[name] = svg; });

  // sweep the DOM (or a subtree) and inline any data-art placeholders that
  // haven't been filled yet. idempotent — safe to call multiple times.
  const inlineArt = (root = document) => {
    root.querySelectorAll('[data-art]').forEach(el => {
      if (el.dataset.artFilled === '1') return;
      const name = el.dataset.art;
      const svg = window.ART_CACHE[name];
      if (svg) {
        el.innerHTML = svg;
        el.dataset.artFilled = '1';
      }
    });
  };
  // expose so other scripts can manually trigger a re-sweep
  window.inlineArt = inlineArt;

  let artReady = false;
  Promise.all(PRELOAD.map(fetchArt)).then(() => {
    artReady = true;
    inlineArt();
    document.dispatchEvent(new CustomEvent('art:loaded'));
  });

  // content-loader injects template-rendered nodes that may contain new
  // [data-art] placeholders. Re-sweep when content is ready (whichever event
  // fires last triggers the actual fill, since inlineArt is idempotent).
  document.addEventListener('content:loaded', () => {
    if (artReady) inlineArt();
  });
})();
