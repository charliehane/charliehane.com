// Shared YouTube lightbox — click any .popup-watch / .work-watch /
// .coffin-watch (across all three pages) and the video plays IN the
// site, not in a new tab. Backdrop click / × button / ESC all close.
//
// Modifier-clicks (⌘/Ctrl/Shift/middle) fall through to the anchor's
// default behavior so power users can still pop the video open in a
// new tab if they want.
//
// URL parsing accepts every common YouTube shape:
//   https://www.youtube.com/watch?v=ID
//   https://youtu.be/ID
//   https://youtube.com/shorts/ID
//   https://www.youtube.com/embed/ID
//   https://www.youtube.com/v/ID
// Non-YouTube URLs fall through to the default anchor behavior
// (opens in the same tab or new tab depending on target).

(() => {
  let overlay = null;
  let iframe = null;

  const extractId = (url) => {
    if (!url) return null;
    const m = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{6,})/
    );
    return m ? m[1] : null;
  };

  const build = () => {
    overlay = document.createElement('div');
    overlay.className = 'video-lightbox';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<button class="video-lightbox-close" type="button" aria-label="Close video">&times;</button>' +
      '<div class="video-lightbox-frame">' +
        '<iframe allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>' +
      '</div>';
    document.body.appendChild(overlay);
    iframe = overlay.querySelector('iframe');

    overlay.addEventListener('click', (e) => {
      // click on backdrop OR the close button
      if (e.target === overlay || e.target.closest('.video-lightbox-close')) {
        close();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });
  };

  const open = (url) => {
    const id = extractId(url);
    if (!id) return false;
    if (!overlay) build();
    // youtube-nocookie for privacy; autoplay OK because this is inside
    // a user-gesture click handler (Safari's autoplay policy allows).
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    // Freeze page scroll while lightbox is up — otherwise iOS momentum
    // scrolls the underlying page during a tap on the backdrop.
    // Class-based (not inline style) so pages that manage their own
    // body overflow (production's director-fall-locked, etc.) don't
    // clobber this and vice versa.
    document.documentElement.classList.add('video-lightbox-open');
    return true;
  };

  const close = () => {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    // Clearing src stops the video's audio + tears down the player,
    // so no ghost audio if the user reopens quickly.
    iframe.src = 'about:blank';
    document.documentElement.classList.remove('video-lightbox-open');
  };

  // Global click delegation — one listener catches every WATCH chip
  // on every page (works fine with content-loader's template render
  // since the chips exist by the time any user click happens).
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.popup-watch, .work-watch, .coffin-watch');
    if (!link) return;
    // Respect modifier-clicks — let ⌘-click open in a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== undefined && e.button !== 0) return;
    const url = link.getAttribute('href');
    if (!url) return;
    if (open(url)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  window.VideoLightbox = { open, close };
})();
