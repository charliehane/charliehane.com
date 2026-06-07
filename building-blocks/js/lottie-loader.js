// Loads Lottie animations into [data-lottie="<name>"] placeholders.
//
// Pattern:
//   <div data-lottie="wind-streak">
//     <!-- optional fallback content shown if the JSON isn't found -->
//     <svg>...</svg>
//   </div>
//
// On page load, this script scans every [data-lottie] placeholder, fetches
// lotties/<name>.json, and (if successful) replaces the fallback contents
// with the playing Lottie. If the JSON 404s, the fallback stays visible —
// so the site never breaks while you're still drawing your animation in AE.
//
// Optional attributes on the placeholder:
//   data-lottie-loop="false"       → play once and stop (default: loop)
//   data-lottie-autoplay="false"   → don't autoplay (default: autoplay)
//   data-lottie-speed="1.5"        → playback speed multiplier (default: 1)
//
// Instances are stored on window.LOTTIE_INSTANCES[<name>] so other scripts
// can pause/play/restart them on user events (e.g. play the bike-jump
// Lottie when a brick is clicked).

(() => {
  if (typeof lottie === 'undefined') {
    console.error('[lottie-loader] lottie-web library is not loaded — check that lottie.min.js is included before lottie-loader.js');
    return;
  }

  window.LOTTIE_INSTANCES = window.LOTTIE_INSTANCES || {};

  const loadOne = async (el) => {
    if (el.dataset.lottieLoaded === '1') return;
    const name = el.dataset.lottie;
    if (!name) return;

    try {
      const response = await fetch(`lotties/${name}.json`, { cache: 'no-cache' });
      if (!response.ok) return; // fallback content stays as-is
      const animationData = await response.json();

      el.innerHTML = ''; // clear fallback before mounting

      const anim = lottie.loadAnimation({
        container: el,
        animationData,
        renderer: 'svg',
        loop: el.dataset.lottieLoop !== 'false',
        autoplay: el.dataset.lottieAutoplay !== 'false',
      });

      const speed = parseFloat(el.dataset.lottieSpeed);
      if (!isNaN(speed) && speed > 0) anim.setSpeed(speed);

      window.LOTTIE_INSTANCES[name] = anim;
      el.dataset.lottieLoaded = '1';
    } catch (err) {
      // 404 / parse error / network failure — fallback content stays visible
      console.warn(`[lottie-loader] ${name}.json not loaded — keeping fallback content. (${err.message})`);
    }
  };

  const sweep = (root = document) => {
    root.querySelectorAll('[data-lottie]').forEach(loadOne);
  };

  window.loadLotties = sweep;

  // initial sweep
  sweep();

  // re-sweep when content-loader injects template-rendered nodes
  document.addEventListener('content:loaded', () => sweep());
})();
