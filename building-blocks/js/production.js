(() => {

  // ============================================================
  // AUTO-SCALE — the sky background is `position: fixed` so it
  // already covers however tall the page grows; adding more works
  // just extends the page naturally. What we DO scale explicitly:
  //   1. Top padding on .works — more works get more sky-headroom
  //      at the top so the eyebrow/title/lede breathe as the pile
  //      gets deeper (extends the blue sky at the top first).
  //   2. Bottom sky-buffer — keeps the same visual gap between the
  //      last work and the city skyline no matter how many works
  //      Charlie adds.
  // Work-thumb color modifiers cycle through 12 presets in
  // content-loader (data-modifier-count="12"), so any count works.
  // ============================================================
  const SKY_HEADROOM_PER_EXTRA_WORK_PX = 60;
  const scaleSkyForWorks = () => {
    const worksEl = document.querySelector('.works');
    if (!worksEl) return;
    const count = worksEl.querySelectorAll('.work').length;
    if (!count) return;
    // Add extra sky-headroom at the top only when Charlie exceeds the
    // original 4-work count — small counts keep the tuned baseline.
    const extras = Math.max(0, count - 4);
    const topPad = 60 + extras * SKY_HEADROOM_PER_EXTRA_WORK_PX;
    worksEl.style.paddingTop = `${topPad}px`;
  };
  if (document.querySelectorAll('.work').length) scaleSkyForWorks();
  document.addEventListener('content:loaded', scaleSkyForWorks);


  // ============================================================
  // STICK FIGURE CURSOR — always head-down (perpendicular),
  // very fast corkscrew with motion blur, looping wind streaks
  // ============================================================

  const wrap = document.createElement('div');
  wrap.className = 'stick-cursor';
  wrap.setAttribute('aria-hidden', 'true');
  // Wind streaks: drop a file at lotties/wind-streak.json to replace the
  // inline SVG below. Until that file exists, the SVG + CSS animation is
  // what plays. Spec: Assets_Specs/wind-streak.lottie.todo.
  wrap.innerHTML = `
    <div class="stick-wind-lottie" data-lottie="wind-streak">
      <svg class="stick-wind-svg" viewBox="0 0 80 70" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#1a1614" stroke-linecap="round" fill="none">
          <line class="wind-line wind-line--1" x1="30" y1="6"  x2="50" y2="6"  stroke-width="2.2"/>
          <line class="wind-line wind-line--2" x1="26" y1="18" x2="54" y2="18" stroke-width="2"/>
          <line class="wind-line wind-line--3" x1="30" y1="30" x2="50" y2="30" stroke-width="1.8"/>
          <line class="wind-line wind-line--4" x1="26" y1="42" x2="54" y2="42" stroke-width="2"/>
          <line class="wind-line wind-line--5" x1="30" y1="54" x2="50" y2="54" stroke-width="2.2"/>
        </g>
      </svg>
    </div>
    <div class="stick-spin" id="stickSpin"></div>
  `;
  document.body.appendChild(wrap);

  // The cursor figure is a 10-frame sprite (assets/you-sprite.png) — CSS
  // cycles the background-position via steps() animation to "rotate" through
  // the frames. See .stick-cursor .stick-spin in style.css.
  // (To revert to the old SVG stick figure, restore the inline svg above
  // and delete the sprite-related CSS.)

  // 90s arrow takes over once Charlie splats on the concrete
  const arrow = document.createElement('div');
  arrow.className = 'cursor-90s';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.style.display = 'none';
  arrow.innerHTML = `
    <svg viewBox="0 0 14 18" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <path d="M2 1 L2 14 L5.5 11 L8 16 L10.5 15 L8 10 L13 10 Z"
        fill="#ffffff" stroke="#000000" stroke-width="1.2" stroke-linejoin="miter"/>
    </svg>`;
  document.body.appendChild(arrow);

  const concrete = document.getElementById('directorConcrete');
  const smushed  = document.getElementById('smushedBody');
  let stuck = false;
  let lastClientX = null;
  let lastClientY = null;

  function smushAt(clientX) {
    if (!concrete || !smushed) return;
    stuck = true;
    wrap.style.display = 'none';
    const r = concrete.getBoundingClientRect();
    const localX = clientX - r.left;
    smushed.style.position = 'absolute';
    smushed.style.left = `${localX}px`;
    smushed.style.bottom = '100%';
    smushed.style.top = 'auto';
    smushed.style.transform = 'translate(-50%, 0)';
    concrete.appendChild(smushed);
    smushed.classList.add('is-shown');
    arrow.style.display = 'block';
  }

  // bulletproof: any time the cursor is at or below the concrete strip top
  // (whether from movement OR scroll), the splat fires
  function maybeSmush(currX, currY) {
    if (!concrete || stuck || currY === null) return;
    const r = concrete.getBoundingClientRect();
    if (currY >= r.top) {
      smushAt(currX !== null ? currX : window.innerWidth / 2);
    }
  }

  window.addEventListener('mousemove', (e) => {
    if (!stuck) maybeSmush(e.clientX, e.clientY);
    if (stuck) {
      arrow.style.transform = `translate3d(${e.clientX - 4}px, ${e.clientY - 4}px, 0)`;
    } else {
      wrap.style.transform =
        `translate3d(${e.clientX - 40}px, ${e.clientY - 55}px, 0) rotate(180deg)`;
    }
    lastClientX = e.clientX;
    lastClientY = e.clientY;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    if (!stuck) maybeSmush(lastClientX, lastClientY);
  }, { passive: true });


  // ============================================================
  // SKY DRESSING — clouds + birds throughout, scroll-driven
  // ============================================================

  // ------------------------------------------------------------
  // Sky as ONE composition (tiled + speed-banded).
  //
  // Original: 22 sprites, each with an inline scroll-driven transform
  // per event. iPhone stuttered because that's ~22 style writes per
  // scroll event × many events per frame during a fast swipe.
  //
  // New: sprites live inside 3 SPEED BAND containers (slow / medium /
  // fast). Each band gets ONE transform per scroll frame instead of
  // per-sprite. Parallax variety preserved (3 speeds instead of 22
  // random speeds), but transform work drops from 22-per-scroll to
  // 3-per-scroll-per-tile. rAF-throttled so many scroll events fold
  // into one update.
  //
  // As the page grows with more works, the whole sky comp scales up.
  // When it would hit 2x scale, we double the tile count and reset
  // scale to 1x, tiling the same layout vertically. The invariant:
  // (# tiles) * (base height) * (scale) == page height, with scale
  // always ∈ [1, 2]. This means cloud DENSITY stays roughly constant
  // as Charlie adds films, without needing a runaway sprite count.
  // ------------------------------------------------------------

  const skyHost = document.getElementById('sky');

  const FALLBACK_BIRD  = '<svg viewBox="0 0 60 28" xmlns="http://www.w3.org/2000/svg"><path d="M2 18 Q14 4 28 16 Q42 4 58 18" stroke="#1a1614" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';
  const PUFFY_CLOUDS = [
    'assets/scenery/cloud-1.png',
    'assets/scenery/cloud-2.png',
    'assets/scenery/cloud-3.png',
  ];

  // Speed bands. Numbers are "pixels of horizontal drift per pixel of
  // vertical scroll" — tuned to match the previous random 0.3-1.0 clouds
  // and 1.2-2.7 birds. Same order as visual back-to-front.
  const BANDS = [
    { name: 'slow',   speed: 0.35 },
    { name: 'medium', speed: 0.75 },
    { name: 'fast',   speed: 1.60 },
  ];

  // How many clouds + birds go in each band per tile. Totals across
  // bands: 14 clouds + 8 birds — same as before.
  const BAND_CONTENTS = {
    slow:   { clouds: 5, birds: 1 },
    medium: { clouds: 6, birds: 3 },
    fast:   { clouds: 3, birds: 4 },
  };

  // Deterministic sprite layout, generated once. Every tile renders the
  // same layout, so tiling gives EXACT copies (as Charlie described:
  // 'double and tile vertically the comp together').
  let layoutCache = null;
  const getLayout = () => {
    if (layoutCache) return layoutCache;
    const BIRD_SVG = (window.ART_CACHE && window.ART_CACHE.bird) || FALLBACK_BIRD;
    layoutCache = { BIRD_SVG, bands: {} };
    for (const band of BANDS) {
      const c = BAND_CONTENTS[band.name];
      const sprites = [];
      for (let i = 0; i < c.clouds; i++) {
        sprites.push({
          type: 'cloud',
          src: (i + (band.name === 'medium' ? 1 : band.name === 'fast' ? 2 : 0)) % PUFFY_CLOUDS.length,
          xPct: Math.random() * 100,
          yPct: Math.random() * 100,
          scale: 0.5 + Math.random() * 0.7,
        });
      }
      for (let i = 0; i < c.birds; i++) {
        sprites.push({
          type: 'bird',
          xPct: Math.random() * 100,
          yPct: Math.random() * 100,
          scale: 0.6 + Math.random() * 0.5,
        });
      }
      layoutCache.bands[band.name] = sprites;
    }
    return layoutCache;
  };

  // Per-band accumulated horizontal drift. Preserved across rebuilds
  // (window resize / content:loaded) so the sky doesn't snap when the
  // page height changes mid-session.
  const dxByBand = { slow: 0, medium: 0, fast: 0 };

  const buildTile = () => {
    const layout = getLayout();
    const tile = document.createElement('div');
    tile.className = 'sky-tile';
    for (const band of BANDS) {
      const bandEl = document.createElement('div');
      bandEl.className = 'sky-band sky-band--' + band.name;
      bandEl.dataset.speed = band.speed;
      bandEl.dataset.band  = band.name;
      // Apply current drift immediately so new tiles inherit position.
      bandEl.style.transform = `translate3d(${dxByBand[band.name]}px, 0, 0)`;
      for (const sprite of layout.bands[band.name]) {
        const el = document.createElement('div');
        if (sprite.type === 'cloud') {
          el.className = 'sky-cloud sky-cloud--puffy';
          const src = PUFFY_CLOUDS[sprite.src];
          el.innerHTML = `<img src="${src}" alt="" decoding="async" draggable="false">`;
        } else {
          el.className = 'sky-bird';
          el.innerHTML = layout.BIRD_SVG;
        }
        el.style.position = 'absolute';
        el.style.left     = `${sprite.xPct}%`;
        el.style.top      = `${sprite.yPct}%`;
        el.style.transform = `scale(${sprite.scale})`;
        el.style.animation = 'none';   // opt out of the default cloudDrift keyframe
        bandEl.appendChild(el);
      }
      tile.appendChild(bandEl);
    }
    return tile;
  };

  // Compute N + S from page height, ensure DOM matches, position + scale
  // each tile. Runs at load, whenever the content-loader injects works,
  // and (throttled) on resize.
  const layoutSky = () => {
    if (!skyHost) return;
    const baseH = window.innerHeight;
    const pageH = Math.max(document.documentElement.scrollHeight, baseH);
    const ratio = pageH / baseH;
    const k = Math.max(0, Math.floor(Math.log2(ratio)));
    const N = Math.pow(2, k);
    const S = Math.min(2, ratio / N);

    // Ensure exactly N tiles in the DOM.
    while (skyHost.children.length < N) skyHost.appendChild(buildTile());
    while (skyHost.children.length > N) skyHost.removeChild(skyHost.lastElementChild);

    // Each tile is naturally baseH tall; scale(S) makes it visually
    // baseH*S. Position tiles so they touch visually (no gaps, no
    // overlap) by using scaled top.
    const tileVisualH = baseH * S;
    [...skyHost.children].forEach((tile, i) => {
      tile.style.top    = `${i * tileVisualH}px`;
      tile.style.height = `${baseH}px`;
      tile.style.transform = `scale(${S})`;
    });
  };

  // Shared drift helper — updates dxByBand for a delta and schedules
  // ONE rAF write. Called from both the scroll listener AND the Phase 1
  // scroll-lock character handlers below, so cloud/bird motion tracks
  // finger input even when window.scrollY is frozen.
  let skyTicking = false;
  const writeSkyBands = () => {
    for (const bandEl of skyHost.querySelectorAll('.sky-band')) {
      const name = bandEl.dataset.band;
      bandEl.style.transform = `translate3d(${dxByBand[name]}px, 0, 0)`;
    }
    skyTicking = false;
  };
  // Expose so Phase 1 can call it.
  window.__applySkyDelta = (dy) => {
    if (!skyHost) return;
    for (const band of BANDS) dxByBand[band.name] -= dy * band.speed;
    if (skyTicking) return;
    skyTicking = true;
    requestAnimationFrame(writeSkyBands);
  };

  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const dy = y - lastScrollY;
    lastScrollY = y;
    window.__applySkyDelta(dy);
  }, { passive: true });

  // Initial build + re-layout hooks.
  const initSky = () => {
    if (!skyHost) return;
    layoutSky();
  };
  if (window.ART_CACHE && window.ART_CACHE.bird) initSky();
  else document.addEventListener('art:loaded', initSky, { once: true });

  document.addEventListener('content:loaded', () => {
    // wait a frame for scaleSkyForWorks (above) to update paddings first
    requestAnimationFrame(layoutSky);
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutSky, 150);
  });


  // ============================================================
  // CITY SKYLINE — 12 buildings hand-placed for a consistent layout.
  // The skyline container is `position: fixed` with overflow:hidden;
  // its bottom edge tracks the concrete strip's top edge each frame,
  // so building feet are always clipped by the concrete line.
  //
  // Buildings are FULLY OPAQUE — depth is conveyed by size, brightness
  // (CSS filters), and the smoke fog layers between bands.
  // ============================================================
  const skylineHost = document.getElementById('directorSkyline');
  const concreteEl = document.getElementById('directorConcrete');
  const buildings = [];

  if (skylineHost && concreteEl) {
    const BUILDING_SRCS = [
      'assets/scenery/building-1.png',
      'assets/scenery/building-2.png',
      'assets/scenery/building-3.png',
      'assets/scenery/building-4.png',
    ];

    // Hand-tuned layout — same skyline every time, no randomness.
    //   src:  index into BUILDING_SRCS
    //   band: 'far' / 'mid' / 'near' — controls z-index + filter + sink
    //   cx:   horizontal CENTER position as % of viewport (0-100)
    //   w:    width in pixels
    //   mh:   max-height in vh
    //   flip: horizontal mirror
    //   ySpd: per-building sink speed multiplier (close = larger)
    // Heights vary 28-92vh + EVERY building has a unique parallax speed
    // (no two buildings drift at the same rate) so they feel separated in
    // depth, not like a single rigid skyline moving as one.
    const layout = [
      // ── FAR band (z:1, smallest, slowest sink) ───────────────────────
      { src: 0, band: 'far',  cx:  6, w: 210, mh: 42, flip: false, ySpd: 0.05 },
      { src: 2, band: 'far',  cx: 28, w: 180, mh: 32, flip: true,  ySpd: 0.18 },
      { src: 0, band: 'far',  cx: 38, w: 165, mh: 50, flip: false, ySpd: 0.09 },
      { src: 3, band: 'far',  cx: 46, w: 200, mh: 40, flip: false, ySpd: 0.22 },
      { src: 1, band: 'far',  cx: 56, w: 175, mh: 36, flip: false, ySpd: 0.07 },
      { src: 3, band: 'far',  cx: 64, w: 215, mh: 52, flip: true,  ySpd: 0.15 },
      { src: 3, band: 'far',  cx: 78, w: 195, mh: 45, flip: true,  ySpd: 0.12 },

      // ── MID band (z:3, medium) ───────────────────────────────────────
      { src: 1, band: 'mid',  cx: 14, w: 290, mh: 62, flip: true,  ySpd: 0.30 },
      { src: 2, band: 'mid',  cx: 30, w: 260, mh: 48, flip: true,  ySpd: 0.55 },
      { src: 0, band: 'mid',  cx: 72, w: 295, mh: 55, flip: true,  ySpd: 0.38 },
      { src: 2, band: 'mid',  cx: 88, w: 275, mh: 66, flip: false, ySpd: 0.48 },

      // ── NEAR band (z:5, biggest) — only at edges, framing the scene ──
      { src: 2, band: 'near', cx: 10, w: 390, mh: 82, flip: false, ySpd: 0.78 },
      { src: 1, band: 'near', cx: 90, w: 395, mh: 78, flip: true,  ySpd: 1.10 },
    ];

    // Render in order, inserting fog layers between bands so they haze
    // whatever's behind them (z-indexed via CSS classes).
    let lastBand = null;
    for (const item of layout) {
      // when the band changes, drop a fog layer for the band we just left
      if (lastBand && lastBand !== item.band) {
        const fog = document.createElement('div');
        fog.className = `fog-layer fog-layer--${lastBand}`;
        skylineHost.appendChild(fog);
      }
      lastBand = item.band;

      const el = document.createElement('img');
      el.src = BUILDING_SRCS[item.src];
      el.className = `building building--${item.band}`;
      el.alt = '';
      el.draggable = false;
      el.style.left = `${item.cx}%`;
      el.style.width = `${item.w}px`;
      el.style.maxHeight = `${item.mh}vh`;
      if (item.flip) el.classList.add('is-flipped');
      el.dataset.ySpeed = String(item.ySpd);

      skylineHost.appendChild(el);
      buildings.push(el);
    }

    // Skyline is `position: fixed` with overflow:hidden. Each frame, we
    // set its `bottom` so the clip's bottom edge aligns with the concrete
    // strip's TOP — anything translated below that line is hidden.
    //
    // VISIBILITY is handled by IntersectionObserver on the sky-buffer
    // element. This is rock-solid against layout-timing bugs (no chance
    // of buildings flashing on first paint) and works regardless of page
    // height. Buildings appear only when the sky-buffer is approaching
    // the viewport — i.e., the user has scrolled past the works content.
    const MAX_SINK = 220;
    // Portrait iPhone: skip the per-building parallax sink entirely.
    // Charlie flagged it as a source of the scroll stutter on phone.
    // Buildings sit anchored to the concrete strip (their default
    // bottom:0 position); no per-frame transform on each of the 12
    // building imgs. Desktop keeps the full depth-band parallax.
    const isPortraitPhone = () =>
      window.matchMedia('(orientation: portrait) and (max-width: 500px)').matches;
    let ticking = false;
    const updateSkyline = () => {
      const concreteRect = concreteEl.getBoundingClientRect();
      const bottomFromViewport = window.innerHeight - concreteRect.top;
      skylineHost.style.bottom = `${bottomFromViewport}px`;

      if (!isPortraitPhone()) {
        const sinkProgress = Math.max(0, Math.min(1,
          (window.innerHeight - concreteRect.top) / window.innerHeight
        ));
        for (const el of buildings) {
          const ySpeed = parseFloat(el.dataset.ySpeed);
          const py = sinkProgress * ySpeed * MAX_SINK;
          el.style.setProperty('--py', `${py}px`);
        }
      }

      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateSkyline);
      }
    }, { passive: true });
    window.addEventListener('resize', updateSkyline);
    // Defer the first update until after first layout pass to avoid
    // measuring before the page is fully positioned.
    requestAnimationFrame(updateSkyline);

    // ── Visibility: IntersectionObserver on the sky-buffer ─────────────
    // Buildings are HIDDEN by default (CSS bottom: -200vh + opacity: 0).
    // They only become visible when the sky buffer enters the viewport
    // (with a 600px lead margin so fast scrolls still catch the fade-in).
    const skyBufferEl = document.querySelector('.director-sky-buffer');
    if (skyBufferEl && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          skylineHost.classList.toggle('is-visible', entry.isIntersecting);
        }
      }, {
        // expand the trigger zone 600px below viewport so the fade-in
        // starts BEFORE the buffer is actually visible
        rootMargin: '0px 0px 600px 0px',
      });
      observer.observe(skyBufferEl);
    }
  }


  // ============================================================
  // FALLING CHARACTER — portrait iPhone only
  // ------------------------------------------------------------
  // Replaces the desktop stick-cursor with a scroll-driven falling
  // character on the right side of the page. Three phases:
  //   1. LOCKED SCROLL — page is frozen (body.director-fall-locked
  //      disables scrolling). We capture wheel + touchmove deltas
  //      manually and use them to bring the character from
  //      offscreen-top down to viewport vertical center.
  //   2. Character sticks at viewport vertical center while user
  //      scrolls the page normally through the works section.
  //   3. When the top of .director-concrete reaches the character's
  //      head Y position, we trigger the existing .smushed-body SVG
  //      on the concrete (same asset the desktop cursor uses) and
  //      hide the falling sprite.
  // ============================================================
  const isPortraitPhone = () =>
    window.matchMedia('(orientation: portrait) and (max-width: 500px)').matches;

  if (isPortraitPhone()) {
    // Build the character node — sprite + trailing wind streaks (same
    // inline SVG the desktop stick-cursor uses so the aesthetic matches).
    const fallEl = document.createElement('div');
    fallEl.className = 'director-fall-character';
    fallEl.setAttribute('aria-hidden', 'true');
    // data-lottie="wind-streak" — lottie-loader.js scans on page-load
    // and swaps the fallback SVG for the real Lottie animation from
    // lotties/wind-streak.json (same effect the desktop stick-cursor uses).
    fallEl.innerHTML = `
      <div class="director-fall-wind" data-lottie="wind-streak">
        <svg viewBox="0 0 80 70" xmlns="http://www.w3.org/2000/svg">
          <g stroke="#1a1614" stroke-linecap="round" fill="none">
            <line class="wind-line wind-line--1" x1="30" y1="6"  x2="50" y2="6"  stroke-width="2.2"/>
            <line class="wind-line wind-line--2" x1="26" y1="18" x2="54" y2="18" stroke-width="2"/>
            <line class="wind-line wind-line--3" x1="30" y1="30" x2="50" y2="30" stroke-width="1.8"/>
            <line class="wind-line wind-line--4" x1="26" y1="42" x2="54" y2="42" stroke-width="2"/>
            <line class="wind-line wind-line--5" x1="30" y1="54" x2="50" y2="54" stroke-width="2.2"/>
          </g>
        </svg>
      </div>
      <div class="director-fall-sprite"></div>
    `;
    document.body.appendChild(fallEl);

    const concreteEl = document.getElementById('directorConcrete');
    const smushedEl  = document.getElementById('smushedBody');
    let charH = fallEl.offsetHeight || 110;
    const measure = () => { charH = fallEl.offsetHeight || 110; };
    window.addEventListener('resize', measure);
    measure();

    // ─────────── Phase 1: scroll-lock while character falls in ───────────
    // Freeze the page and consume wheel + touch input to animate the
    // character. Very forgiving threshold + sqrt easing so even the
    // shortest iOS flick lands the character in one gesture. Sqrt
    // amplification means visual progress reaches ~70% at 50% of the
    // delta threshold — a quick flick doesn't feel like it "underruns".
    let phaseLocked = true;
    let fallDelta = 0;
    // 'One comfortable swipe' — any natural finger flick is ~200-400px
    // so 160 completes on a normal flick without feeling accidental.
    // Higher threshold = the character requires more swipe input to
    // reach the center, which reads as him moving slower during the
    // reveal. Charlie: 'can he generally move a bit slower when
    // entering the scene via the swipe'.
    const fallThreshold = () => Math.max(160, window.innerHeight * 0.20);

    const applyPhase1 = () => {
      const p = Math.min(1, fallDelta / fallThreshold());
      // Ease-out cubic on the STOP — more pronounced deceleration than
      // quad. Character advances quickly early on, then really settles
      // into the center. Charlie asked for 'a little more' bezier on
      // top of the quad we had before.
      const eased = 1 - Math.pow(1 - p, 3);
      const centerY = window.innerHeight / 2 - charH / 2;
      const startTop = -charH - 20;
      const endTop = centerY;
      fallEl.style.position = 'fixed';
      fallEl.style.top = `${startTop + (endTop - startTop) * eased}px`;
      if (p >= 1) releaseLock();
    };
    applyPhase1();
    document.body.classList.add('director-fall-locked');

    // Advance both the character animation and the sky drift by dy.
    // Called from wheel, touchmove, AND the touchend momentum decay so
    // all three input paths share the same forward-motion code.
    const advancePhase1 = (dy) => {
      if (dy <= 0) return;
      fallDelta += dy;
      if (window.__applySkyDelta) window.__applySkyDelta(dy);
      applyPhase1();
    };

    const onWheel = (e) => {
      if (!phaseLocked) return;
      e.preventDefault();
      advancePhase1(Math.max(0, e.deltaY));
    };

    // Momentum: track finger velocity during drag, kick off an
    // exponential-decay rAF after touchend so lifting your finger
    // doesn't kill motion instantly. iOS native scroll has this built
    // in; preventDefault() on touchmove removes it, and Charlie noticed
    // the resulting 'staccato' feel here vs Phase 2's normal scroll.
    let touchStartY = null;
    let lastTouchY  = null;
    let lastTouchT  = 0;
    let velocity    = 0;   // px per ms (swipe-up positive)
    let momentumRAF = 0;

    const stopMomentum = () => {
      if (momentumRAF) { cancelAnimationFrame(momentumRAF); momentumRAF = 0; }
      velocity = 0;
    };

    const runMomentum = () => {
      // Tuned for real finger flicks. 2.5% loss per 16ms frame during
      // Phase 1 = long enough tail to actually feel; low MIN_V so gentle
      // flicks still glide.
      const FRICTION_PER_FRAME = 0.975;
      const MIN_V = 0.005;
      // At the Phase 1 → scroll handoff we cut velocity way down so
      // Charlie's requested 'hair of scroll' really is a hair, not a
      // full glide down the page. Applied once, on the frame Phase 1
      // ends (or immediately if Phase 1 was already done at touchend).
      let handoffApplied = false;
      let lastT = performance.now();
      const tick = () => {
        if (Math.abs(velocity) < MIN_V) {
          momentumRAF = 0;
          velocity = 0;
          return;
        }
        const now = performance.now();
        const dt = now - lastT;
        lastT = now;
        velocity *= Math.pow(FRICTION_PER_FRAME, dt / 16);
        const dy = velocity * dt;
        if (phaseLocked) {
          advancePhase1(dy);
        } else {
          if (!handoffApplied) {
            velocity *= 0.3;
            handoffApplied = true;
          }
          // window.scrollBy fires a scroll event, which drives the sky
          // comp drift too (via __applySkyDelta in the scroll listener).
          window.scrollBy(0, dy);
        }
        momentumRAF = requestAnimationFrame(tick);
      };
      momentumRAF = requestAnimationFrame(tick);
    };

    const onTouchStart = (e) => {
      if (!phaseLocked) return;
      stopMomentum();
      const y = e.touches[0].clientY;
      touchStartY = y;
      lastTouchY  = y;
      lastTouchT  = performance.now();
    };
    const onTouchMove = (e) => {
      if (touchStartY === null) return;
      e.preventDefault();
      const y  = e.touches[0].clientY;
      const now = performance.now();
      const dt = Math.max(1, now - lastTouchT);
      // Instantaneous velocity, EMA-smoothed so bumpy touchmove samples
      // don't spike the release velocity.
      const instant = (lastTouchY - y) / dt;
      velocity = velocity * 0.6 + instant * 0.4;
      const dy = touchStartY - y;
      if (dy > 0) {
        if (phaseLocked) {
          advancePhase1(dy);
        } else {
          // Phase 1 already completed on an earlier touchmove but the
          // finger is still on the screen and moving. Route the dy
          // straight into page scroll so there's no pause between the
          // character landing and the page starting to move.
          window.scrollBy(0, dy);
        }
      }
      touchStartY = y;
      lastTouchY  = y;
      lastTouchT  = now;
    };
    const onTouchEnd = () => {
      touchStartY = null;
      // Boost the release velocity a touch — matches the 'kick' feel of
      // iOS native scroll momentum, and gives short/gentle finger flicks
      // enough energy to actually glide instead of stopping cold.
      velocity *= 1.4;
      // Kick off momentum regardless of phase — if Phase 1 is still
      // locked, runMomentum's tick uses advancePhase1; if Phase 1
      // completed mid-swipe (strong flick), the tick auto-routes to
      // window.scrollBy so the SAME swipe that landed the character
      // also nudges the page a hair further. Without this, iOS's
      // captured-gesture behavior means the post-Phase-1 touchmoves
      // never trigger native scroll either, so no tail at all.
      if (velocity > 0.005) runMomentum();
    };
    const onKey = (e) => {
      if (!phaseLocked) return;
      const advance =
        e.key === 'ArrowDown' ? window.innerHeight * 0.1 :
        e.key === 'PageDown'  ? window.innerHeight * 0.4 :
        e.key === ' '         ? window.innerHeight * 0.4 : 0;
      if (advance > 0) {
        e.preventDefault();
        fallDelta += advance;
        applyPhase1();
      }
    };
    window.addEventListener('wheel',      onWheel,     { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true  });
    window.addEventListener('touchmove',  onTouchMove,  { passive: false });
    window.addEventListener('touchend',   onTouchEnd,   { passive: true  });
    window.addEventListener('touchcancel',onTouchEnd,   { passive: true  });
    window.addEventListener('keydown',    onKey);

    const releaseLock = () => {
      if (!phaseLocked) return;
      phaseLocked = false;
      // DON'T call stopMomentum here — we WANT the momentum RAF to keep
      // running and transfer residual velocity into window.scrollBy so
      // a hard swipe lands the character AND nudges the page a hair
      // further. runMomentum's tick auto-switches its target now that
      // phaseLocked is false.
      document.body.classList.remove('director-fall-locked');
      window.removeEventListener('wheel',      onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('keydown',    onKey);
      // Keep touchmove/touchend/touchcancel attached for the rest of
      // this gesture. If Phase 1 completed mid-swipe, subsequent
      // touchmoves in the same gesture drive page scroll (via the
      // else branch in onTouchMove), so the finger stays connected
      // to motion — no dead zone. On touchend, touchStartY nulls
      // out and NEW gestures early-return through touchmove, letting
      // native scroll handle Phase 2 normally.
      updateFall();
    };

    // ─────────── Phase 2 + 3: normal scroll listener ───────────
    let splatted = false;
    let ticking = false;
    const updateFall = () => {
      ticking = false;
      if (phaseLocked) return;   // Phase 1 handles its own updates

      const vh = window.innerHeight;
      const centerY = vh / 2 - charH / 2;
      const concreteRect = concreteEl && concreteEl.getBoundingClientRect();

      // Phase 3 trigger: concrete top has descended to character's
      // head y-position (slightly below vertical center).
      if (concreteRect && concreteRect.top <= centerY + charH * 0.4) {
        if (!splatted) {
          splatted = true;
          fallEl.classList.add('is-splatted');
          // Move the existing smushed-body SVG onto the concrete at
          // roughly the character's X (right side of the viewport).
          if (concreteEl && smushedEl) {
            const rect = concreteEl.getBoundingClientRect();
            // localX inside .director-concrete, matching the character's
            // right-side column (~85% across the viewport)
            const localX = (window.innerWidth * 0.85) - rect.left;
            smushedEl.style.position = 'absolute';
            smushedEl.style.left = `${localX}px`;
            smushedEl.style.bottom = '100%';   // sit ON TOP of concrete
            smushedEl.style.top = 'auto';
            smushedEl.style.transform = 'translate(-50%, 0)';
            concreteEl.appendChild(smushedEl);
            smushedEl.classList.add('is-shown');
          }
        }
      } else {
        // Phase 2 — hovering at vertical center
        fallEl.style.position = 'fixed';
        fallEl.style.top = `${centerY}px`;
        if (splatted) {
          splatted = false;
          fallEl.classList.remove('is-splatted');
          if (smushedEl) smushedEl.classList.remove('is-shown');
        }
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateFall);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

})();
