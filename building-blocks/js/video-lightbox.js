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
// And Vimeo:
//   https://vimeo.com/ID
//   https://vimeo.com/ID/HASH        ← unlisted/private with hash
//   https://vimeo.com/channels/<any>/ID
//   https://player.vimeo.com/video/ID(?h=HASH)
// Non-YouTube / non-Vimeo URLs fall through to the default anchor
// behavior (opens in the same tab or new tab depending on target).

(() => {
  let overlay = null;
  let iframe = null;

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const m = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{6,})/
    );
    return m ? m[1] : null;
  };

  const extractVimeo = (url) => {
    if (!url) return null;
    // player.vimeo.com/video/ID?h=HASH
    let m = url.match(/player\.vimeo\.com\/video\/(\d+)(?:\?.*?[?&]h=([A-Za-z0-9]+))?/);
    if (m) return { id: m[1], hash: m[2] || null };
    // vimeo.com/ID or vimeo.com/ID/HASH or vimeo.com/channels/<any>/ID(/HASH)
    m = url.match(/vimeo\.com\/(?:channels\/[^\/]+\/)?(\d+)(?:\/([A-Za-z0-9]+))?/);
    if (m) return { id: m[1], hash: m[2] || null };
    return null;
  };

  const extractInstagram = (url) => {
    if (!url) return null;
    // instagram.com/(username/)?(p|reel|tv)/CODE — the username segment is
    // optional (e.g. instagram.com/p/CODE and instagram.com/jai.gil/reel/CODE
    // both work). The /p/, /reel/, /tv/ token is what /embed/ hangs off of.
    const m = url.match(/instagram\.com\/(?:[A-Za-z0-9_.-]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return m ? { kind: m[1], code: m[2] } : null;
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
    // Try YouTube → Vimeo → Instagram in order. Each produces an
    // autoplay-friendly embed URL. Instagram doesn't autoplay video —
    // its /embed view shows the post with a native play control.
    const ytId = extractYouTubeId(url);
    const vim  = ytId ? null : extractVimeo(url);
    const ig = (ytId || vim) ? null : extractInstagram(url);
    if (!ytId && !vim && !ig) return false;
    if (!overlay) build();
    if (ytId) {
      iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    } else if (vim) {
      const q = new URLSearchParams({ autoplay: '1', title: '0', byline: '0', portrait: '0', playsinline: '1' });
      if (vim.hash) q.set('h', vim.hash);
      iframe.src = `https://player.vimeo.com/video/${vim.id}?${q.toString()}`;
    } else {
      // Instagram embed URLs always use /p/CODE/embed/ regardless of
      // whether the original was a /p/, /reel/, or /tv/ link.
      iframe.src = `https://www.instagram.com/p/${ig.code}/embed/`;
    }
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

  // Global click delegation — one listener catches every WATCH-style
  // trigger on every page: the preproduction thumbnail card
  // (.popup-video), the production work thumbnail (.work-thumb),
  // and the postproduction coffin WATCH chip (.coffin-watch). Works
  // fine with content-loader's template render since the elements
  // exist by the time any user click happens.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.popup-video, .work-thumb, .coffin-video, .coffin-watch, .popup-watch, .work-watch');
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

  // After content:loaded (content-loader fires this once the JSON is
  // in and templates are rendered), paint YouTube thumbnails onto
  // every card that carries a href. Each YouTube URL yields a
  // predictable thumbnail image at img.youtube.com/vi/<id>/hqdefault.jpg
  // (480x360, always exists for a valid ID; no API key required).
  // Elements without a href just stay as their static placeholder
  // (colored gradient for .work-thumb, hidden for .popup-video).
  const paintThumbs = () => {
    document.querySelectorAll('.popup-video, .work-thumb, .coffin-video').forEach((el) => {
      const url = el.getAttribute('href');
      if (!url) return;
      const ytId = extractYouTubeId(url);
      if (ytId) {
        el.style.backgroundImage = `url("https://i.ytimg.com/vi/${ytId}/hqdefault.jpg")`;
        el.classList.add('has-video');
        return;
      }
      // Vimeo / Instagram: no predictable thumbnail URL (Vimeo needs
      // oEmbed API; Instagram needs their embed script). Still mark
      // as has-video so the play-button overlay + hover treatment
      // render — card falls back to its base color instead of a
      // background image.
      if (extractVimeo(url) || extractInstagram(url)) el.classList.add('has-video');
    });
  };
  document.addEventListener('content:loaded', paintThumbs);
  // Fallback in case content:loaded already fired before this script
  // parsed (rare but possible with browser-cached JSON).
  if (window.__CONTENT__) paintThumbs();

  window.VideoLightbox = { open, close };
})();
