(() => {

  // 90s arrow cursor
  const cursor = document.createElement('div');
  cursor.className = 'cursor-90s';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = `
    <svg viewBox="0 0 14 18" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <path d="M2 1 L2 14 L5.5 11 L8 16 L10.5 15 L8 10 L13 10 Z"
        fill="#ffffff" stroke="#000000" stroke-width="1.2" stroke-linejoin="miter"/>
    </svg>`;
  document.body.appendChild(cursor);
  window.addEventListener('mousemove', (e) => {
    cursor.style.transform = `translate3d(${e.clientX - 4}px, ${e.clientY - 4}px, 0)`;
  }, { passive: true });
  window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
  window.addEventListener('mouseup',   () => cursor.classList.remove('is-down'));


  // ============================================================
  // WORLD — pin-and-pan; car is a STILL element inside Night scene
  // ============================================================

  const section    = document.getElementById('worldSection');
  const track      = document.getElementById('worldTrack');
  const bar        = document.getElementById('worldProgressBar');
  const bikePos    = document.getElementById('worldBikePos');
  const bikeEl     = document.getElementById('worldBike');
  const launchedEl = document.getElementById('launchedFigure');
  const bgVideo    = document.getElementById('worldBgVideo');
  const fgVideo    = document.getElementById('worldFgVideo');

  // Scrub-friendly state for the background + foreground videos. We avoid
  // setting currentTime until loadedmetadata has fired (otherwise NaN errors).
  let bgVideoDuration = 0;
  let fgVideoDuration = 0;
  const primeVideo = (video, setDuration) => {
    if (!video) return;
    video.addEventListener('loadedmetadata', () => {
      setDuration(video.duration || 0);
      // Make sure the video is paused — even without the `autoplay`
      // attribute, some browsers will start playback on metadata load.
      // We're scrubbing it manually via currentTime, so it must stay paused.
      try { video.pause(); } catch (e) { /* swallow */ }
      // iOS Safari quirk: a video at currentTime=0 with preload may not
      // paint a first frame until something seeks. Nudge it to 0.001 to
      // force the first frame to render so the page isn't blank on iOS.
      try { video.currentTime = 0.001; } catch (e) { /* swallow */ }
    });
  };
  primeVideo(bgVideo, d => { bgVideoDuration = d; });
  primeVideo(fgVideo, d => { fgVideoDuration = d; });

  // iOS Safari refuses to render scrubbed-video frames until the user
  // interacts with the page in a way that "unlocks" media. The dance:
  // play() inside a user-gesture handler (allowed because muted +
  // playsinline), then immediately pause(). After that, currentTime
  // sets actually paint frames. Runs once on first scroll OR touchstart.
  // NOTE: we do NOT use the `autoplay` HTML attribute because it'd make
  // desktop browsers play the video continuously instead of waiting to be
  // scrubbed by scroll.
  let videosUnlocked = false;
  const unlockVideos = () => {
    if (videosUnlocked) return;
    videosUnlocked = true;
    [bgVideo, fgVideo].forEach(v => {
      if (!v) return;
      const p = v.play();
      if (p && p.then) p.then(() => v.pause()).catch(() => { /* iOS may reject; that's OK */ });
    });
  };
  document.addEventListener('touchstart', unlockVideos, { once: true, passive: true });
  document.addEventListener('scroll',     unlockVideos, { once: true, passive: true });
  window.addEventListener('load',         unlockVideos, { once: true });
  // bike rider lives inside the inlined SVG (loaded async by art-loader),
  // so look it up lazily each time it's needed
  const getBikeRider = () => document.querySelector('.bike-rider');
  let sceneCar     = null;

  // car placeholder — actual SVG is loaded from assets/car.svg by art-loader.
  // we just need a positioned div that the layout/measure code can target.
  const CAR_PLACEHOLDER = `
    <div class="scene-car" id="sceneCar" data-art="car" data-art-fit="aspect" aria-hidden="true"></div>
  `;

  // after content loads, mark the last templated scene as Night (wider) and
  // drop the car placeholder into it so the crash sequence still works.
  // The art-loader fills the placeholder with the actual SVG either via its
  // own art:loaded sweep (if art arrives later) or by us manually invoking
  // window.inlineArt (if art is already cached).
  function setupNightScene() {
    const scenes = document.querySelectorAll('.scene');
    if (!scenes.length) return;
    const last = scenes[scenes.length - 1];
    last.classList.add('scene--night');
    last.insertAdjacentHTML('beforeend', CAR_PLACEHOLDER);
    sceneCar = document.getElementById('sceneCar');
    if (window.inlineArt) window.inlineArt(last);
    measure();
    update();
  }

  let maxX = 0, scrollableH = 0;
  let crashProgress = 1;
  let trackXAtCrash = 0;

  const measure = () => {
    if (!section || !track) return;
    maxX = Math.max(0, track.scrollWidth - window.innerWidth);
    scrollableH = section.offsetHeight - window.innerHeight;

    if (sceneCar && bikeEl) {
      // park the car so its LEFT edge meets the bike's RIGHT edge at crash
      const carLeftInTrack = sceneCar.offsetParent
        ? sceneCar.offsetLeft + sceneCar.parentElement.offsetLeft
        : 0;
      const bikeRightScreenX = window.innerWidth / 2 + (bikeEl.offsetWidth / 2);
      trackXAtCrash = Math.max(100, Math.min(maxX, carLeftInTrack - bikeRightScreenX));
      crashProgress = 0.90; // reserve last 10% for the launch
    }
  };

  const update = () => {
    if (!section || !track) return;
    const rect = section.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, scrollableH)));
    if (bar) bar.style.width = `${progress * 100}%`;

    // Pre-crash progress: maps the [0, crashProgress] slice of scroll into
    // a [0, 1] range. Used to drive both the horizontal track AND the
    // BG/FG video scrubs. Once scroll passes crashProgress, tp clamps to 1
    // — so the world stops moving and the videos freeze at their final
    // frame. After that, post-crash scroll only animates the launched
    // figure flying offscreen.
    const tp = Math.min(progress, crashProgress) / Math.max(0.001, crashProgress);

    // Scrub the BG + FG videos to match FULL scroll progress (NOT tp).
    // The new v4 video has the crash + aftermath baked into its final ~3
    // seconds, so we want the scroll to advance the video all the way
    // through. The launched-figure animation still triggers at the
    // existing crashProgress (0.9) and overlays the video's crash content.
    // Three guards:
    //   1. !video.seeking — skip if a prior seek is still decoding so we
    //      don't pile up abandoned seeks.
    //   2. delta >= 1/30s — skip sub-frame updates from micro-scrolls.
    //   3. pause defensively — a playing video resumes from each
    //      currentTime set, so we explicitly stop it.
    const scrub = (video, duration) => {
      if (!video || duration <= 0 || video.seeking) return;
      const target = progress * duration;
      const delta = Math.abs(target - video.currentTime);
      if (delta >= (1 / 30)) {           // 1 frame at 30fps
        if (!video.paused) {
          try { video.pause(); } catch (e) { /* swallow */ }
        }
        try { video.currentTime = target; } catch (e) { /* swallow */ }
      }
    };
    scrub(bgVideo, bgVideoDuration);
    scrub(fgVideo, fgVideoDuration);

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // pre-crash: track translates from 0 → trackXAtCrash (car centered).
    // post-crash: track stays at trackXAtCrash so bike & car remain visible centered.
    // (tp was computed earlier alongside the video scrubs so the world and
    // videos all freeze in lockstep at crash.)
    track.style.transform = `translate3d(${-tp * trackXAtCrash}px, 0, 0)`;

    if (progress < crashProgress) {
      // pre-crash: bike centered on viewport, no rotation, rider on bike
      if (bikePos) bikePos.style.setProperty('--exitX', `0px`);
      if (bikeEl)  bikeEl.style.setProperty('--crashRot', '0deg');
      const r = getBikeRider(); if (r) r.style.opacity = '1';
      if (launchedEl) launchedEl.style.opacity = '0';
    } else {
      // post-crash phase
      const t = (progress - crashProgress) / Math.max(0.01, 1 - crashProgress);

      // bike+car stay where they crashed. minor rotation on bike.
      if (bikeEl) bikeEl.style.setProperty('--crashRot', `-12deg`);
      if (bikePos) bikePos.style.setProperty('--exitX', `0px`);

      // hide on-bike rider, show launched figure
      const rider = getBikeRider(); if (rider) rider.style.opacity = '0';
      if (launchedEl) {
        launchedEl.style.opacity = '1';
        // arc from crash point (vw/2, vh*0.7) up and to the right; exits offscreen quickly
        const startX = vw * 0.5;
        const startY = vh * 0.72;
        const targetX = vw + 200;     // offscreen right
        const targetY = -180;          // offscreen top
        const ease = Math.pow(t, 0.85);
        const lx = startX + (targetX - startX) * ease;
        const ly = startY + (targetY - startY) * ease - Math.sin(ease * Math.PI) * 80;
        const rot = ease * 380;
        launchedEl.style.transform = `translate(${lx - 40}px, ${ly - 55}px) rotate(${rot}deg)`;
      }
    }
  };

  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { update(); raf = 0; });
  };
  // wait for content-loader to render the scenes, then mark Night + add car
  if (document.querySelectorAll('.scene').length > 0) setupNightScene();
  else document.addEventListener('content:loaded', setupNightScene, { once: true });
  // safety re-measure on full load
  window.addEventListener('load', () => { measure(); update(); });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });


  // ============================================================
  // BIKE GIF SPRITE — frame index advances based on scroll velocity.
  // Faster scroll = faster pedaling. No scroll = bike freezes on a frame.
  // 14 frames horizontally; each frame is 240px wide in the sprite.
  // ============================================================
  const BIKE_FRAMES = 14;
  const BIKE_FRAME_W = 240;
  const SCROLL_PER_FRAME = 60;   // tune: smaller = faster pedaling per scroll
  let bikeFrameAccum = 0;
  let lastBikeScroll = window.scrollY;

  const updateBikeFrame = () => {
    if (!bikeEl) return;
    const dy = Math.abs(window.scrollY - lastBikeScroll);
    lastBikeScroll = window.scrollY;
    if (dy === 0) return;
    bikeFrameAccum += dy;
    const frameIdx = Math.floor(bikeFrameAccum / SCROLL_PER_FRAME) % BIKE_FRAMES;
    bikeEl.style.backgroundPositionX = `${-frameIdx * BIKE_FRAME_W}px`;
  };
  // hook into the existing scroll handler via a separate raf-throttled listener
  let bikeTicking = false;
  window.addEventListener('scroll', () => {
    if (!bikeTicking) {
      bikeTicking = true;
      requestAnimationFrame(() => {
        updateBikeFrame();
        bikeTicking = false;
      });
    }
  }, { passive: true });


  // ============================================================
  // BRICK / BIKE-JUMP collision (only fires before crash)
  // ============================================================

  let interactionLocked = false;
  const COLLISION_DELAY = 320;
  const MAX_AIM = 110;

  function explodeBrick(brick) {
    const r = brick.getBoundingClientRect();
    brick.dataset.exploded = '1';
    const halfW = r.width / 2, halfH = r.height / 2;
    const corners = [
      { cls: 'tl', x: r.left,         y: r.top         },
      { cls: 'tr', x: r.left + halfW, y: r.top         },
      { cls: 'bl', x: r.left,         y: r.top + halfH },
      { cls: 'br', x: r.left + halfW, y: r.top + halfH },
    ];
    for (const c of corners) {
      const piece = document.createElement('div');
      piece.className = `brick-piece brick-piece--${c.cls}`;
      piece.style.left = `${c.x}px`;
      piece.style.top  = `${c.y}px`;
      piece.style.width  = `${halfW}px`;
      piece.style.height = `${halfH}px`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1100);
    }
    setTimeout(() => { delete brick.dataset.exploded; }, 5200);
  }

  function showProjectPopup(brick) {
    // popup lives inside the same .scene as the brick — works for any number of films
    const scene = brick.closest('.scene');
    const popup = scene && scene.querySelector('.brick-popup');
    if (!popup) return;
    section.querySelectorAll('.brick-popup.is-shown').forEach(p => p.classList.remove('is-shown'));
    popup.classList.remove('is-shown');
    void popup.offsetWidth;
    popup.classList.add('is-shown');
    clearTimeout(popup._hideTimer);
    popup._hideTimer = setTimeout(() => popup.classList.remove('is-shown'), 4000);
  }

  if (section && bikeEl) {
    section.addEventListener('click', () => {
      if (interactionLocked) return;
      const rect = section.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, scrollableH)));
      if (progress >= crashProgress) return;

      interactionLocked = true;
      const bikeRect = bikeEl.getBoundingClientRect();
      const bikeCx = bikeRect.left + bikeRect.width / 2;
      const bricks = [...section.querySelectorAll('.brick:not([data-exploded])')];
      let target = null, minD = Infinity;
      for (const b of bricks) {
        const r = b.getBoundingClientRect();
        const bcx = r.left + r.width / 2;
        const d = Math.abs(bcx - bikeCx);
        if (d < minD) { minD = d; target = b; }
      }
      let aimX = 0;
      if (target) {
        const r = target.getBoundingClientRect();
        const tCx = r.left + r.width / 2;
        aimX = Math.max(-MAX_AIM, Math.min(MAX_AIM, tCx - bikeCx));
      }
      bikeEl.style.setProperty('--aimX', `${aimX}px`);

      bikeEl.classList.remove('is-jumping');
      void bikeEl.offsetWidth;
      bikeEl.classList.add('is-jumping');

      setTimeout(() => {
        if (!target) return;
        const r = target.getBoundingClientRect();
        if (!r.width) return;
        const peakTop    = bikeRect.top - window.innerHeight * 0.44;
        const peakBottom = peakTop + bikeRect.height;
        const peakCenter = bikeCx + aimX;
        const peakLeft   = peakCenter - bikeRect.width / 2;
        const peakRight  = peakCenter + bikeRect.width / 2;
        const overlapV = peakBottom > r.top && peakTop < r.bottom;
        const overlapH = peakRight > r.left && peakLeft < r.right;
        if (overlapV && overlapH) {
          explodeBrick(target);
          showProjectPopup(target);
        }
      }, COLLISION_DELAY);

      setTimeout(() => { interactionLocked = false; }, 800);
    });
  }

})();
