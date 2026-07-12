// Reusable loading overlay — visible on page entry only if the page's
// heavy assets take more than SHOW_DELAY ms to become ready. On cached
// visits (assets already decoded) the overlay never renders — no flash
// of loading state for a quick reload or back-navigation.
//
// Also cleans up centerpiece + text animations once hidden so the
// paint doesn't keep churning behind the actual page.
//
// Usage on any page:
//   1. Include this script BEFORE the page-specific script.
//   2. Add markup near the top of <body>:
//        <div class="page-loading" id="pageLoading" aria-hidden="true">
//          <div class="page-loading-texture" id="pageLoadingTexture"></div>
//          <div class="page-loading-content">
//            <span class="page-loading-text" id="pageLoadingText">LOADING</span>
//            <div class="page-loading-centerpiece" id="pageLoadingCenterpiece"></div>
//          </div>
//        </div>
//   3. Page CSS supplies the centerpiece background-image + animation
//      (see .page-loading-centerpiece--bike / --foot).
//   4. Page-specific script calls window.PageLoading.hide() when its
//      heavy assets are ready.
(() => {
  const overlay = document.getElementById('pageLoading');
  if (!overlay) return;

  const textEl = document.getElementById('pageLoadingText');
  const texEl  = document.getElementById('pageLoadingTexture');

  // If hide() is called before SHOW_DELAY ms elapses, the overlay
  // never becomes visible at all — bypassing the "flash of loading
  // state" on cached visits.
  const SHOW_DELAY = 300;

  // Start invisible so we can decide whether to reveal.
  overlay.style.opacity = '0';
  overlay.style.visibility = 'hidden';

  let shown  = false;
  let hidden = false;
  let showTimer   = 0;
  let textTimer   = 0;
  let jitterTimer = 0;

  const startTextCycle = () => {
    if (!textEl) return;
    const STATES = [
      'LOADING',
      'LOADING.',
      'LOADING..',
      'LOADING...',
      'STILL LOADING....',
      'DANG, STILL LOADING....',
    ];
    let idx = 0;
    const advance = () => {
      textEl.textContent = STATES[idx];
      idx = (idx + 1) % STATES.length;
    };
    advance();
    textTimer = setInterval(advance, 500);
  };

  const startJitter = () => {
    if (!texEl) return;
    const rots = [0, 90, 180, 270];
    let inverted = false;
    const tick = () => {
      const rot = rots[Math.floor(Math.random() * rots.length)];
      const bx = (Math.random() * 60).toFixed(1);
      const by = (Math.random() * 60).toFixed(1);
      if (Math.random() < 0.35) inverted = !inverted;
      texEl.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
      texEl.style.backgroundPosition = `${bx}vmax ${by}vmax`;
      texEl.style.filter = inverted ? 'invert(1)' : 'none';
      jitterTimer = setTimeout(tick, 260 + Math.random() * 100);
    };
    tick();
  };

  const show = () => {
    if (hidden || shown) return;
    shown = true;
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';
    startTextCycle();
    startJitter();
  };

  const hide = () => {
    if (hidden) return;
    hidden = true;
    clearTimeout(showTimer);
    if (!shown) {
      // Never showed — pull it out of the layout entirely so nothing
      // (including cached centerpiece pixels) can flash over the page.
      overlay.style.display = 'none';
      return;
    }
    // Clear the inline show() styles so the .is-loaded CSS rule (with
    // its opacity: 0 + visibility: hidden transition) actually wins.
    overlay.style.opacity = '';
    overlay.style.visibility = '';
    overlay.classList.add('is-loaded');
    if (textTimer)   clearInterval(textTimer);
    if (jitterTimer) clearTimeout(jitterTimer);
  };

  // Delay before showing — if the page-script calls hide() first, the
  // overlay stays invisible and gets pulled from the layout entirely.
  showTimer = setTimeout(show, SHOW_DELAY);

  // Hard fallback: hide after 5s regardless so a stalled network
  // doesn't leave visitors stuck (in that case, the overlay WILL show
  // because we're past SHOW_DELAY).
  setTimeout(hide, 5000);

  window.PageLoading = {
    hide,
    hideWhenReady: (...promises) => {
      Promise.allSettled(promises).then(hide);
    },
  };
})();
