// Reusable loading overlay — visible on page entry until the caller
// signals ready (via a readiness check or an explicit hideLoading()
// call), or after a 5s hard timeout so a stalled network doesn't hang
// the page forever.
//
// Usage on any page:
//   1. Include this script BEFORE the page-specific script.
//   2. Add markup near the top of <body>:
//        <div class="page-loading" id="pageLoading" aria-hidden="true">
//          <div class="page-loading-texture" id="pageLoadingTexture"></div>
//          <div class="page-loading-content">
//            <span class="page-loading-text" id="pageLoadingText">LOADING</span>
//            <!-- centerpiece — any sprite/element you want -->
//            <div class="page-loading-centerpiece" id="pageLoadingCenterpiece"></div>
//          </div>
//        </div>
//   3. Page CSS supplies the centerpiece background-image + sprite animation
//      (see .preprod-loading-bike or .home-loading-foot for examples).
//   4. Page-specific script calls window.PageLoading.hideWhenReady(readyPromise)
//      or window.PageLoading.hide() when everything's decoded.
//
// The overlay's LOADING text auto-cycles and the paper-texture layer
// auto-jitters as long as the overlay is visible.
(() => {
  const overlay = document.getElementById('pageLoading');
  if (!overlay) return;

  const textEl = document.getElementById('pageLoadingText');
  const texEl  = document.getElementById('pageLoadingTexture');

  // Text state cycle — escalates from casual to exasperated.
  const STATES = [
    'LOADING',
    'LOADING.',
    'LOADING..',
    'LOADING...',
    'STILL LOADING....',
    'DANG, STILL LOADING....',
  ];
  let stateIdx = 0;
  let textTimer = 0;
  if (textEl) {
    const advance = () => {
      textEl.textContent = STATES[stateIdx];
      stateIdx = (stateIdx + 1) % STATES.length;
    };
    advance();
    textTimer = setInterval(advance, 500);
  }

  // Texture jitter — rotate 0/90/180/270°, random position shift, ~35%
  // chance to toggle invert on each tick. Runs every 260-360ms so the
  // grain shift reads as intentional rather than frantic.
  let jitterTimer = 0;
  if (texEl) {
    const rots = [0, 90, 180, 270];
    let inverted = false;
    const jitter = () => {
      const rot = rots[Math.floor(Math.random() * rots.length)];
      const bx = (Math.random() * 60).toFixed(1);
      const by = (Math.random() * 60).toFixed(1);
      if (Math.random() < 0.35) inverted = !inverted;
      texEl.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
      texEl.style.backgroundPosition = `${bx}vmax ${by}vmax`;
      texEl.style.filter = inverted ? 'invert(1)' : 'none';
      jitterTimer = setTimeout(jitter, 260 + Math.random() * 100);
    };
    jitter();
  }

  let hidden = false;
  const hide = () => {
    if (hidden) return;
    hidden = true;
    overlay.classList.add('is-loaded');
    // Stop timers — no need to keep cycling once hidden.
    if (textTimer)   clearInterval(textTimer);
    if (jitterTimer) clearTimeout(jitterTimer);
  };

  // Hard fallback: hide after 5s regardless of readiness.
  const fallbackT = setTimeout(hide, 5000);

  // Public API for page-specific scripts.
  window.PageLoading = {
    hide,
    // Convenience: hide when all promises resolve (or reject).
    hideWhenReady: (...promises) => {
      Promise.allSettled(promises).then(hide);
    },
  };
})();
