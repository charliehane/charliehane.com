(() => {

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

  const cloudHost = document.getElementById('skyClouds');
  const birdHost  = document.getElementById('skyBirds');

  // SVG strings come from window.ART_CACHE (loaded by art-loader.js from
  // assets/cloud.svg and assets/bird.svg). Hardcoded fallbacks used if the
  // asset folder is missing or hasn't loaded yet.
  const FALLBACK_CLOUD = '<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg"><ellipse cx="48" cy="68" rx="42" ry="28" fill="white"/><ellipse cx="92" cy="50" rx="48" ry="34" fill="white"/><ellipse cx="148" cy="58" rx="50" ry="34" fill="white"/><ellipse cx="190" cy="72" rx="34" ry="22" fill="white"/><ellipse cx="118" cy="76" rx="60" ry="20" fill="white"/></svg>';
  const FALLBACK_BIRD  = '<svg viewBox="0 0 60 28" xmlns="http://www.w3.org/2000/svg"><path d="M2 18 Q14 4 28 16 Q42 4 58 18" stroke="#1a1614" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';

  const clouds = [];
  const birds  = [];

  const buildSky = () => {
    const CLOUD_SVG = (window.ART_CACHE && window.ART_CACHE.cloud) || FALLBACK_CLOUD;
    const BIRD_SVG  = (window.ART_CACHE && window.ART_CACHE.bird)  || FALLBACK_BIRD;

    // Production-page clouds use the puffy PNGs from assets/scenery/cloud-1-3.
    // Each cloud div picks one of the 3 sources at random for variety.
    const PUFFY_CLOUDS = [
      'assets/scenery/cloud-1.png',
      'assets/scenery/cloud-2.png',
      'assets/scenery/cloud-3.png',
    ];

    if (cloudHost) {
    cloudHost.style.position = 'absolute';
    cloudHost.style.height = '100%';
    cloudHost.style.top = '0';
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('div');
      el.className = 'sky-cloud sky-cloud--puffy';
      el.style.position = 'absolute';
      el.style.top = `${Math.random() * 100}%`;
      el.style.animation = 'none';
      el.dataset.x = (Math.random() * window.innerWidth).toString();
      el.dataset.speed = (0.3 + Math.random() * 0.7).toString();
      el.dataset.scale = (0.5 + Math.random() * 0.7).toString();
      el.style.transform = `translateX(${el.dataset.x}px) scale(${el.dataset.scale})`;
      const src = PUFFY_CLOUDS[i % PUFFY_CLOUDS.length];
      el.innerHTML = `<img src="${src}" alt="" draggable="false">`;
      cloudHost.appendChild(el);
      clouds.push(el);
    }
  }

    if (birdHost) {
    birdHost.style.position = 'absolute';
    birdHost.style.height = '100%';
    birdHost.style.top = '0';
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'sky-bird';
      el.style.position = 'absolute';
      el.style.top = `${Math.random() * 100}%`;
      el.style.animation = 'none';
      el.dataset.x = (Math.random() * window.innerWidth).toString();
      el.dataset.speed = (1.2 + Math.random() * 1.5).toString();
      el.dataset.scale = (0.6 + Math.random() * 0.5).toString();
      el.style.transform = `translateX(${el.dataset.x}px) scale(${el.dataset.scale})`;
      el.innerHTML = BIRD_SVG;
      birdHost.appendChild(el);
      birds.push(el);
    }
  }
  };  // /buildSky

  // run buildSky once art is ready (or immediately if already cached)
  if (window.ART_CACHE && window.ART_CACHE.cloud) buildSky();
  else document.addEventListener('art:loaded', buildSky, { once: true });

  // Off-screen buffers — must be ≥ visible width of each sprite so the
  // element is FULLY off-screen before it gets teleported to the other side.
  // Puffy cloud is 360px wide + drop-shadow ≈ 400px total.
  const CLOUD_OFF = 420;
  const BIRD_OFF  = 100;

  let lastScroll = window.scrollY;
  window.addEventListener('scroll', () => {
    const dy = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    for (const el of clouds) {
      let x = parseFloat(el.dataset.x);
      x -= dy * parseFloat(el.dataset.speed);
      // Wrap only AFTER the cloud is fully off the viewport, and teleport
      // it to a position that's also fully off the opposite edge — so it
      // SLIDES into view rather than popping in mid-screen.
      if (x < -CLOUD_OFF)              x = window.innerWidth + 20;
      else if (x > window.innerWidth)  x = -CLOUD_OFF + 20;
      el.dataset.x = x.toString();
      el.style.transform = `translateX(${x}px) scale(${el.dataset.scale})`;
    }
    for (const el of birds) {
      let x = parseFloat(el.dataset.x);
      x -= dy * parseFloat(el.dataset.speed);
      if (x < -BIRD_OFF)               x = window.innerWidth + 10;
      else if (x > window.innerWidth)  x = -BIRD_OFF + 10;
      el.dataset.x = x.toString();
      el.style.transform = `translateX(${x}px) scale(${el.dataset.scale})`;
    }
  }, { passive: true });


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
    let ticking = false;
    const updateSkyline = () => {
      const concreteRect = concreteEl.getBoundingClientRect();
      const bottomFromViewport = window.innerHeight - concreteRect.top;
      skylineHost.style.bottom = `${bottomFromViewport}px`;

      const sinkProgress = Math.max(0, Math.min(1,
        (window.innerHeight - concreteRect.top) / window.innerHeight
      ));
      for (const el of buildings) {
        const ySpeed = parseFloat(el.dataset.ySpeed);
        const py = sinkProgress * ySpeed * MAX_SINK;
        el.style.setProperty('--py', `${py}px`);
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

})();
