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

  // Loading overlay — text cycle + texture jitter + fallback timeout
  // are all handled by the shared loading-overlay.js module (loaded
  // before this script). We just need to signal readiness once both
  // videos are buffered enough to scrub smoothly.
  const hideLoading = () => window.PageLoading && window.PageLoading.hide();


  const section    = document.getElementById('worldSection');
  const stage      = document.getElementById('worldStage');
  const track      = document.getElementById('worldTrack');
  const bar        = document.getElementById('worldProgressBar');
  const bikePos    = document.getElementById('worldBikePos');
  const bikeEl     = document.getElementById('worldBike');
  const launchedEl = document.getElementById('launchedFigure');
  const bgVideo    = document.getElementById('worldBgVideo');
  const fgVideo    = document.getElementById('worldFgVideo');

  // ============================================================
  // EXPLICIT SOURCE SELECTION FOR PORTRAIT iPHONE
  // ------------------------------------------------------------
  // <source media="..."> inside <video> is unreliable on iOS Safari
  // (Charlie reports "sometimes horizontal, sometimes vertical" on
  // successive reloads). Reset both videos' sources here based on
  // the actual current viewport so the choice is deterministic.
  // ============================================================
  const R2 = 'https://pub-3feaceb432134076b4773fdc45eba874.r2.dev';
  const isPortraitPhone = () =>
    window.matchMedia('(orientation: portrait) and (max-width: 500px)').matches;
  const setBgSrc = () => {
    if (!bgVideo) return;
    // Portrait iPhone: use the pre-composited flat video (BG + FG
    // baked into a single H.264 MP4). Halves the data + decoder work
    // vs the dual-video setup, eliminates all alpha edge artifacts,
    // and locks scene transitions frame-perfect. Desktop keeps the
    // horizontal dual-video setup for the FG parallax richness.
    const url = isPortraitPhone()
      ? `${R2}/bike-scene-portrait-flat.mp4`
      : `${R2}/bike-scene-bg.mp4`;
    if (bgVideo.currentSrc !== url) {
      [...bgVideo.querySelectorAll('source')].forEach(s => s.remove());
      bgVideo.src = url;
      bgVideo.load();
    }
  };
  const setFgSrc = () => {
    if (!fgVideo) return;
    const portrait = isPortraitPhone();
    [...fgVideo.querySelectorAll('source')].forEach(s => s.remove());
    if (portrait) {
      // No FG on portrait — the flat composite handled by setBgSrc()
      // already has FG baked in. Leave fgVideo element in DOM but
      // with no src; the scrub() function no-ops on 0-duration
      // videos so this is harmless.
      fgVideo.removeAttribute('src');
      return;
    }
    // Desktop: existing dual-video FG (webm + HEVC mov)
    const webm = document.createElement('source');
    webm.src  = `${R2}/bike-scene-fg.webm`;
    webm.type = 'video/webm';
    fgVideo.appendChild(webm);
    const mov = document.createElement('source');
    mov.src  = `${R2}/bike-scene-fg.mov`;
    mov.type = 'video/mp4; codecs="hvc1"';
    fgVideo.appendChild(mov);
    fgVideo.removeAttribute('src');
    fgVideo.load();
  };
  setBgSrc();
  setFgSrc();

  /* All positional math uses the STAGE box (a fixed 1.89:1 window centered
     in the viewport with black letterbox above/below on portrait phones)
     rather than raw window dimensions. Otherwise the bike + launched figure
     drift out of alignment with the AE video on non-16:9 windows. */
  const getStageBox = () => {
    if (!stage) return { w: window.innerWidth, h: window.innerHeight, left: 0, top: 0 };
    const r = stage.getBoundingClientRect();
    return { w: r.width, h: r.height, left: r.left, top: r.top };
  };

  // ============================================================
  // AUTO-SCALE — .world-section height is fixed in CSS at 500vh for
  // the original 4 scenes (125vh/scene). When Charlie adds more films
  // to preproduction.films in the JSON, more .scene blocks render and
  // the horizontal track (width: max-content) grows — so we need
  // proportionally more vertical scroll to pan through them at the
  // same speed. The bike-jump click handler already works for any
  // count (querySelectorAll('.brick')). Brick + popup positions cycle
  // through the 5 scene--01..scene--05 CSS presets automatically via
  // content-loader's modulo modifier.
  // ============================================================
  const VH_PER_SCENE = 500;
  const scaleSectionToSceneCount = () => {
    if (!section) return;
    const count = document.querySelectorAll('.scene').length;
    if (!count) return;
    // 4-scene baseline is 2000vh (500vh × 4). Scroll → animation runs
    // at one-quarter the original speed so viewers have four times as
    // long to enjoy each scene.
    const vh = Math.max(2000, count * VH_PER_SCENE);
    section.style.height = `${vh}vh`;
  };
  if (document.querySelectorAll('.scene').length) scaleSectionToSceneCount();
  document.addEventListener('content:loaded', () => {
    scaleSectionToSceneCount();
    // Trigger a re-measure so maxX / scrollableH are recomputed
    // against the new section height.
    if (typeof measure === 'function') { measure(); update(); }
  });

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

  // Hide loading overlay once BOTH videos have enough buffered data
  // to scrub smoothly (canplaythrough fires when the browser thinks
  // it can play through without pausing). Wired here (right after
  // primeVideo) so both handlers are attached before any events fire.
  {
    let bgReady = false, fgReady = false;
    const check = () => { if (bgReady && fgReady) hideLoading(); };
    if (bgVideo) {
      const onBg = () => { bgReady = true; check(); };
      bgVideo.addEventListener('canplaythrough', onBg);
      bgVideo.addEventListener('loadeddata', () => {
        if (bgVideo.readyState >= 3) onBg();
      });
    } else { bgReady = true; }
    if (fgVideo) {
      const onFg = () => { fgReady = true; check(); };
      fgVideo.addEventListener('canplaythrough', onFg);
      fgVideo.addEventListener('loadeddata', () => {
        if (fgVideo.readyState >= 3) onFg();
      });
    } else { fgReady = true; }
    check();   // both may already be ready if cached
  }

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

  // Procedural .scene-car SVG removed — the crash is now in the FG video.
  // Charlie's AE comp draws the green Porsche hitting the bike directly;
  // overlaying a second car-SVG would just sit awkwardly behind it.
  function setupNightScene() {
    const scenes = document.querySelectorAll('.scene');
    if (!scenes.length) return;
    const last = scenes[scenes.length - 1];
    last.classList.add('scene--night');
    measure();
    update();
  }

  let maxX = 0, scrollableH = 0;
  // crashProgress lines up with the visual contact moment in the AE
  // crash render. Nudged 4 frames earlier than 0.90 so the JS impact
  // beat slightly leads the video — feels more reactive.
  let crashProgress = 0.90 - (4 / (30 * 27));   // ≈ 0.8951
  let trackXAtCrash = 0;

  const measure = () => {
    if (!section || !track) return;
    // Track pans within the STAGE box (not the viewport). The stage width
    // is what defines a "scene" of horizontal travel, since scenes are
    // sized as calc(0.78 * --stage-w).
    const sw = getStageBox().w;
    maxX = Math.max(0, track.scrollWidth - sw);
    scrollableH = section.offsetHeight - window.innerHeight;
    // No procedural car to align against any more, so translate the
    // horizontal track all the way to maxX by crashProgress. The visual
    // impact happens entirely in the scrub video.
    trackXAtCrash = maxX;
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

    const stageBox = getStageBox();
    // Legacy names kept — but they now reference the STAGE, not the
    // window. Everything derived from these (launched-figure arc, exit
    // trajectories) stays inside the visible stage on portrait phones.
    const vw = stageBox.w;
    const vh = stageBox.h;
    const stageLeft = stageBox.left;
    const stageTop  = stageBox.top;

    // pre-crash: track translates from 0 → trackXAtCrash (car centered).
    // post-crash: track stays at trackXAtCrash so bike & car remain visible centered.
    // (tp was computed earlier alongside the video scrubs so the world and
    // videos all freeze in lockstep at crash.)
    track.style.transform = `translate3d(${-tp * trackXAtCrash}px, 0, 0)`;

    // -----------------------------------------------------------------
    // Bike rotation — independent timeline from rider/launched-figure:
    //   Before [crashProgress - 4f]:        upright (0deg)
    //   [crashProgress - 4f → crashProgress]: ramp 0 → +12deg
    //                                       (impact — BACK of bike lifts up,
    //                                        positive = clockwise on a bike
    //                                        facing right)
    //   [crashProgress → crashProgress + 1f]: hold at +12deg
    //   [crashProgress + 1f → +UNROTATE]:    ease back to 0 (bike falls back)
    //   After: upright (0deg)
    // -----------------------------------------------------------------
    const FRAME_AS_PROGRESS = (1 / 30) / Math.max(1, bgVideoDuration || 27);
    const ROT_PEAK_DEG = 12;
    const ROT_RAMP_START = crashProgress - 4 * FRAME_AS_PROGRESS;  // start 1 frame earlier (was -3f)
    const ROT_HOLD_END   = crashProgress + 1 * FRAME_AS_PROGRESS;  // shorter hold (was +3f)
    const ROT_FALL_END   = ROT_HOLD_END + 0.02;                    // ~16 frames unrotate (was 0.04)
    let crashRot = 0;
    if (progress < ROT_RAMP_START)         crashRot = 0;
    else if (progress < crashProgress) {
      const t = (progress - ROT_RAMP_START) / Math.max(1e-6, crashProgress - ROT_RAMP_START);
      crashRot = t * ROT_PEAK_DEG;
    } else if (progress < ROT_HOLD_END)    crashRot = ROT_PEAK_DEG;
    else if (progress < ROT_FALL_END) {
      const t = (progress - ROT_HOLD_END) / Math.max(1e-6, ROT_FALL_END - ROT_HOLD_END);
      const ease = 1 - Math.pow(1 - t, 2);          // ease-out quadratic
      crashRot = ROT_PEAK_DEG * (1 - ease);
    } else                                  crashRot = 0;
    // Apply rotation on the parent so BOTH the moving bike sprite AND
    // the crashed-bike sibling inherit it via CSS custom-property cascade.
    if (bikePos) bikePos.style.setProperty('--crashRot', `${crashRot}deg`);

    // Toggle which bike is visible: moving sprite pre-crash, crashed
    // PNG once we hit crashProgress. The crossfade is handled by CSS.
    if (bikePos) {
      if (progress >= crashProgress) bikePos.classList.add('is-crashed');
      else                            bikePos.classList.remove('is-crashed');
    }

    if (progress < crashProgress) {
      // pre-crash: bike centered on viewport, rider on bike
      if (bikePos) bikePos.style.setProperty('--exitX', `0px`);
      const r = getBikeRider(); if (r) r.style.opacity = '1';
      if (launchedEl) launchedEl.style.opacity = '0';
    } else {
      // post-crash phase — bike rotation is now handled by the timeline
      // block above; here we just trigger the rider/launched-figure swap.
      const t = (progress - crashProgress) / Math.max(0.01, 1 - crashProgress);

      if (bikePos) bikePos.style.setProperty('--exitX', `0px`);

      // hide on-bike rider, show launched figure
      const rider = getBikeRider(); if (rider) rider.style.opacity = '0';
      if (launchedEl) {
        launchedEl.style.opacity = '1';
        // arc starts right above the front bike seat — where the front
        // rider's torso/head was before getting launched. Subtle nudges
        // from the previous spot (was +30/0.75): a touch left + a touch
        // lower so the figure pops out exactly over the seat.
        // Coords are viewport-relative (launched-figure is position:fixed),
        // so add the stage's offset from the viewport top-left.
        const startX = stageLeft + vw * 0.5 + 15;  // slight right of center
        const startY = stageTop  + vh * 0.77;      // above the bike
        const targetX = window.innerWidth + 200;   // offscreen right (full viewport)
        const targetY = -180;                       // offscreen top
        const ease = Math.pow(t, 0.85);
        const lx = startX + (targetX - startX) * ease;
        const ly = startY + (targetY - startY) * ease - Math.sin(ease * Math.PI) * 80;
        // Two rotations layered: the sprite frames cycle (in-plane spin
        // of the character's body), and a CSS rotate that tumbles the
        // whole figure around its belly center (transform-origin set in
        // .launched-figure CSS to 50% 55%, roughly the figure's middle).
        // rot = ease * 380 → slightly more than one full tumble across
        // the arc, same as the original stick-figure animation.
        const rot = ease * 380;
        launchedEl.style.transform = `translate(${lx - 55}px, ${ly - 75}px) rotate(${rot}deg)`;
        // Advance the sprite frame to spin through the arc. ~2 full
        // sprite cycles across the launch. Offset by +7 so the very
        // first visible frame is frame 7 (the 3rd-to-last in the 10-frame
        // sequence) — Charlie's preferred starting pose with the head
        // already tilted back and ready to launch.
        // Frame width is 110px in CSS pixels (sprite scaled to 1100px wide).
        const sprite = document.getElementById('launchedFigureSprite');
        if (sprite) {
          const frame = (Math.floor(ease * 20) + 7) % 10;
          sprite.style.backgroundPositionX = `${-frame * 110}px`;
        }
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
  // 14 frames horizontally. Sprite is rendered at background-size: 1400% 100%
  // (each frame = container width), so frame stepping is a percentage:
  //   frame N (0-indexed) → bg-position-x = 100N/(14-1) %
  // This lets the bike element's actual width scale with --stage-w without
  // needing to know a pixel value here.
  // ============================================================
  const BIKE_FRAMES = 14;
  const BIKE_STEP_PCT = 100 / (BIKE_FRAMES - 1);   // 7.6923%
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
    bikeEl.style.backgroundPositionX = `${frameIdx * BIKE_STEP_PCT}%`;
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
