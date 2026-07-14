(() => {

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 90s arrow cursor
  const cursor = document.createElement('div');
  cursor.className = 'cursor-90s';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = `
    <svg viewBox="0 0 14 18" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <path d="M2 1 L2 14 L5.5 11 L8 16 L10.5 15 L8 10 L13 10 Z"
        fill="#ffffff" stroke="#000000" stroke-width="1.2" stroke-linejoin="miter"/>
    </svg>
  `;
  document.body.appendChild(cursor);

  window.addEventListener('mousemove', (e) => {
    cursor.style.transform = `translate3d(${e.clientX - 4}px, ${e.clientY - 4}px, 0)`;
  }, { passive: true });
  window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
  window.addEventListener('mouseup',   () => cursor.classList.remove('is-down'));


  // ============================================================
  // PORTAL — hero is a 20-frame foot-smush sprite sheet, scroll-scrubbed.
  // Scroll progress through .portal maps to background-position-x on the
  // sprite (0% = frame 1, 100% = frame 20). The ornate C is a separate
  // 4-frame sprite overlaid on top so it keeps its own independent loop.
  // ============================================================
  const portal      = document.getElementById('portal');
  const portalHero  = document.getElementById('portalHero');
  const portalC     = document.getElementById('portalC');

  // Signal to the loading overlay that the hero is ready — as soon as
  // the 3.1MB foot-smush sprite sheet has decoded, everything else is
  // lightweight enough to render immediately.
  if (window.PageLoading) {
    const heroImg = new Image();
    heroImg.onload = () => window.PageLoading.hide();
    heroImg.onerror = () => window.PageLoading.hide();
    heroImg.src = 'assets/foot-smush-sprite.png';
  }

  const SMUSH_FRAMES = 20;
  // Frames 0..SMUSH_LAST_HOLD are the "smush" (foot slamming down).
  // Frames SMUSH_LAST_HOLD+1..SMUSH_FRAMES-1 are the "blood" drip out.
  const SMUSH_LAST_HOLD = 14;
  // Scroll fraction where blood starts. Smush spans t=[0..SMUSH_SPLIT],
  // blood spans t=[SMUSH_SPLIT..1]. With portal 360vh (sticky range
  // 260vh), 140/260 ≈ 0.538 puts blood in the last ~120vh of scroll.
  const SMUSH_SPLIT = 140 / 260;

  if (portalC && portalC.classList.contains('portal-c--sprite')) {
    const dur = 0.45 + Math.random() * 0.40;
    portalC.style.animationDuration = `${dur.toFixed(2)}s`;
    portalC.style.animationDelay = `-${(Math.random() * dur).toFixed(2)}s`;
  }

  const updatePortal = () => {
    if (!portal || !portalHero) return;
    const rect = portal.getBoundingClientRect();
    const stickyRange = Math.max(1, portal.offsetHeight - window.innerHeight);
    const t = Math.max(0, Math.min(1, -rect.top / stickyRange));

    let frameIdx;
    if (t < SMUSH_SPLIT) {
      // Smush zone: map t=[0..SMUSH_SPLIT] → frames [0..SMUSH_LAST_HOLD]
      const smushT = t / SMUSH_SPLIT;
      frameIdx = Math.min(SMUSH_LAST_HOLD, Math.floor(smushT * (SMUSH_LAST_HOLD + 1)));
    } else {
      // Blood zone: map t=[SMUSH_SPLIT..1] → frames [SMUSH_LAST_HOLD+1..SMUSH_FRAMES-1]
      const bloodT = (t - SMUSH_SPLIT) / (1 - SMUSH_SPLIT);
      const bloodFrames = SMUSH_FRAMES - 1 - SMUSH_LAST_HOLD;
      frameIdx = Math.min(SMUSH_FRAMES - 1, SMUSH_LAST_HOLD + 1 + Math.floor(bloodT * bloodFrames));
    }

    const posPct = (frameIdx / (SMUSH_FRAMES - 1)) * 100;
    portalHero.style.backgroundPositionX = `${posPct}%`;
  };

  // ============================================================
  // FOREST — cinema scrub + interactive sign hotspots
  // ============================================================
  // The forest is a pre-rendered After Effects clip. As the user scrolls
  // through the .forest section, we set the video's currentTime to match
  // their scroll progress. Three "sign" hotspots become clickable as their
  // configured scroll windows hit; clicking opens a modal with the full
  // quote text and (optionally) an embedded video.

  const forestEl    = document.getElementById('forest');
  const cineVideo   = document.getElementById('forestCineVideo');
  const cinePending = document.getElementById('forestCinePending');
  const hotspotsEl  = document.getElementById('forestHotspots');

  // Modal refs
  const modalEl       = document.getElementById('signModal');
  const modalBackdrop = document.getElementById('signModalBackdrop');
  const modalClose    = document.getElementById('signModalClose');
  const modalRole     = document.getElementById('signModalRole');
  const modalQuote    = document.getElementById('signModalQuote');
  const modalBy       = document.getElementById('signModalBy');
  const modalFilm     = document.getElementById('signModalFilm');
  const modalVideo    = document.getElementById('signModalVideo');

  // Sign data is read from window.__CONTENT__ (populated by content-loader.js
  // from "Editable Text Content.json"). If content hasn't loaded yet, we
  // retry once the page-content event fires. Each sign has scrollIn /
  // scrollOut / hotspot.{x,y,w,h} and the modal text fields.
  let signs = [];

  const buildHotspots = () => {
    if (!hotspotsEl || !signs.length) return;
    hotspotsEl.innerHTML = '';
    signs.forEach((sign, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sign-hotspot';
      if (sign.kind === 'bio') btn.classList.add('sign-hotspot--bio');
      btn.id = `signHotspot-${i}`;
      const ariaLabel = sign.kind === 'bio'
        ? `Read about ${sign.title || 'Charlie'}`
        : `Read ${sign.role || ''} testimonial`;
      btn.setAttribute('aria-label', ariaLabel.trim());
      btn.dataset.signIndex = i;
      // Position from sign.hotspot
      const h = sign.hotspot || { x: '40%', y: '40%', w: '20%', h: '25%' };
      btn.style.left   = h.x;
      btn.style.top    = h.y;
      btn.style.width  = h.w;
      btn.style.height = h.h;
      // Inner label that fades in when active. Bio sign is full-viewport
      // click target — its label sits in the bottom-right corner as plain
      // text (no arrow). Quote signs keep the ↗ arrow as an affordance.
      const label = sign.labelShort || (sign.kind === 'bio' ? 'click the sign' : 'tap to read');
      const arrow = sign.kind === 'bio' ? '' : '↗ ';
      btn.innerHTML = `<span class="sign-hotspot-pill">${arrow}${label}</span>`;
      btn.addEventListener('click', () => openModal(sign));
      hotspotsEl.appendChild(btn);
    });
  };

  // Read signs from CONTENT once available
  const tryLoadSigns = () => {
    const c = window.__CONTENT__;
    if (!c || !c.forest || !Array.isArray(c.forest.quotes)) return false;
    // Build signs list. Bio signs (if present) go FIRST so they appear
    // earliest in the scroll. Quote signs follow.
    // Accepts either forest.bios (array of bio entries — preferred) or
    // legacy forest.bio (single bio object) for backward compatibility.
    signs = [];
    const bios = Array.isArray(c.forest.bios)
      ? c.forest.bios
      : (c.forest.bio && typeof c.forest.bio === 'object' ? [c.forest.bio] : []);
    bios.forEach(b => {
      signs.push({
        kind:       'bio',
        role:       b.role || 'About',
        title:      b.title || '',
        paragraphs: Array.isArray(b.paragraphs) ? b.paragraphs : [],
        scrollIn:   typeof b.scrollIn  === 'number' ? b.scrollIn  : 0,
        scrollOut:  typeof b.scrollOut === 'number' ? b.scrollOut : 1,
        hotspot:    b.hotspot || null,
        labelShort: b.labelShort || 'click the sign',
      });
    });
    c.forest.quotes.forEach(q => {
      signs.push({
        kind:       'quote',
        role:       q.role || '',
        text:       q.text || '',
        by:         q.by || '',
        film:       q.film || '',
        scrollIn:   typeof q.scrollIn  === 'number' ? q.scrollIn  : 0,
        scrollOut:  typeof q.scrollOut === 'number' ? q.scrollOut : 1,
        hotspot:    q.hotspot || null,
        video:      q.video || '',
        labelShort: q.labelShort || 'tap to read',
      });
    });
    // Set video source(s) if provided. videoSrc can be:
    //   - a string (single URL, used as-is on cineVideo.src)
    //   - an object { webm, mp4 } — added as multiple <source> children
    //     so browsers pick the best format they support. WebM VP9 renders
    //     smooth gradients dramatically better than H.264 (no diagonal
    //     compression banding on the night sky). MP4 is the fallback for
    //     browsers that don't support WebM.
    if (cineVideo && c.forest.videoSrc) {
      const src = c.forest.videoSrc;
      if (typeof src === 'string') {
        cineVideo.src = src;
      } else if (src && typeof src === 'object') {
        cineVideo.removeAttribute('src');
        // Clear any existing <source> children before appending fresh ones
        [...cineVideo.querySelectorAll('source')].forEach(s => s.remove());
        if (src.webm) {
          const s = document.createElement('source');
          s.src = src.webm;
          s.type = 'video/webm';
          cineVideo.appendChild(s);
        }
        if (src.mp4) {
          const s = document.createElement('source');
          s.src = src.mp4;
          s.type = 'video/mp4';
          cineVideo.appendChild(s);
        }
      }
      cineVideo.load();
    }
    buildHotspots();
    return true;
  };

  if (!tryLoadSigns()) {
    document.addEventListener('content:loaded', tryLoadSigns, { once: true });
    // Fallback: poll briefly in case the event fires before our listener
    let tries = 0;
    const poll = setInterval(() => {
      if (tryLoadSigns() || ++tries > 20) clearInterval(poll);
    }, 100);
  }

  // ───────── Cinema scrub ─────────
  // Video may not be loaded when scroll fires. Track readiness so we don't
  // throw NaN at currentTime. Show the pending overlay until the video is
  // playable.
  let videoReady = false;
  let videoDuration = 0;

  if (cineVideo) {
    cineVideo.addEventListener('loadedmetadata', () => {
      videoReady = true;
      videoDuration = cineVideo.duration || 0;
      if (cinePending) cinePending.classList.add('is-hidden');
      updateForest();
    });
    cineVideo.addEventListener('error', () => {
      if (cinePending) {
        cinePending.querySelector('p').textContent = 'forest sequence unavailable';
      }
    });
    // If there's no src after a beat, keep the pending placeholder visible
    setTimeout(() => {
      if (cinePending && !videoReady && !cineVideo.src) {
        cinePending.querySelector('p').textContent = 'forest sequence pending';
      }
    }, 800);
  }

  let lastProgress = -1;

  const updateForest = () => {
    if (!forestEl) return;
    const rect = forestEl.getBoundingClientRect();
    const scrollableH = Math.max(1, forestEl.offsetHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / scrollableH));

    // Scrub video — only when ready and progress actually changed
    if (videoReady && Math.abs(progress - lastProgress) > 0.0005) {
      const t = progress * videoDuration;
      // Avoid setting NaN or invalid values
      if (isFinite(t) && t >= 0 && t <= videoDuration) {
        try { cineVideo.currentTime = t; } catch (e) { /* iOS sometimes throws */ }
      }
    }
    lastProgress = progress;

    // Show/hide hotspots based on scroll window
    if (hotspotsEl && signs.length) {
      signs.forEach((sign, i) => {
        const el = hotspotsEl.children[i];
        if (!el) return;
        const inWindow = progress >= sign.scrollIn && progress <= sign.scrollOut;
        if (inWindow !== el.classList.contains('is-active')) {
          el.classList.toggle('is-active', inWindow);
        }
      });
    }
  };

  // ───────── Modal ─────────
  let lastFocus = null;

  const modalCard  = modalEl?.querySelector('.sign-modal-card');
  const modalCite  = document.getElementById('signModalCite');
  const modalTitle = document.getElementById('signModalTitle');
  const modalBody  = document.getElementById('signModalBody');

  const openModal = (sign) => {
    if (!modalEl) return;
    lastFocus = document.activeElement;

    // Tag the modal with the sign kind so CSS can adjust layout
    // (bio = bigger card, no italic quote marks, columnar paragraphs).
    if (modalCard) {
      modalCard.classList.toggle('sign-modal-card--bio',   sign.kind === 'bio');
      modalCard.classList.toggle('sign-modal-card--quote', sign.kind !== 'bio');
    }

    modalRole.textContent  = sign.role || '';

    // Title (used by bio; hidden for quotes)
    if (modalTitle) {
      modalTitle.textContent = sign.title || '';
      modalTitle.hidden = !sign.title;
    }

    if (sign.kind === 'bio') {
      // Hide quote/cite, render paragraphs into body
      if (modalQuote) modalQuote.hidden = true;
      if (modalCite)  modalCite.hidden  = true;
      if (modalBody) {
        modalBody.hidden = false;
        modalBody.innerHTML = '';
        (sign.paragraphs || []).forEach(p => {
          const el = document.createElement('p');
          // paragraphs may contain inline <em> markup — set as HTML
          el.innerHTML = p;
          modalBody.appendChild(el);
        });
      }
    } else {
      // Quote layout — restore default visibility, fill quote+cite
      if (modalQuote) { modalQuote.hidden = false; modalQuote.textContent = sign.text || ''; }
      if (modalCite)  modalCite.hidden = false;
      if (modalBody)  modalBody.hidden = true;
      modalBy.textContent    = sign.by   || '';
      modalFilm.textContent  = sign.film || '';
    }

    modalVideo.innerHTML = '';
    if (sign.video) {
      // YouTube/Vimeo embed if URL looks like an embed URL; otherwise <video>
      const url = sign.video;
      const isEmbeddable = /(?:youtube\.com\/embed|player\.vimeo\.com)/i.test(url);
      if (isEmbeddable) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('frameborder', '0');
        modalVideo.appendChild(iframe);
      } else {
        const v = document.createElement('video');
        v.src = url;
        v.controls = true;
        v.playsInline = true;
        modalVideo.appendChild(v);
      }
    }
    modalEl.hidden = false;
    requestAnimationFrame(() => modalEl.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  };

  const closeModal = () => {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
    // Stop any embedded video by clearing the container
    setTimeout(() => {
      modalEl.hidden = true;
      modalVideo.innerHTML = '';
    }, 220);
    document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  };

  if (modalClose)    modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal();
  });

  // ───────── Scroll wiring ─────────
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      updatePortal();
      updateForest();
      raf = 0;
    });
  };

  updatePortal();
  updateForest();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    updatePortal();
    updateForest();
  });

})();
