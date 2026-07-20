(() => {

  // ============================================================
  // EXPLICIT SOURCE SELECTION FOR THE HELL BG VIDEO
  // ------------------------------------------------------------
  // Same pattern preproduction.js uses. <source media="..."> inside
  // <video> is unreliable on iOS Safari — it will sometimes pick
  // the horizontal desktop MOV even on portrait phones. Reset the
  // <video>'s sources here based on the current viewport so the
  // choice is deterministic. Portrait phones get the purpose-built
  // vertical hell comp; everyone else gets the desktop WebM/MOV.
  // ============================================================
  {
    const hellVideo = document.getElementById('hellBgVideo');
    if (hellVideo) {
      const isPortraitPhone = () =>
        window.matchMedia('(orientation: portrait) and (max-width: 500px)').matches;
      const setHellSrc = () => {
        [...hellVideo.querySelectorAll('source')].forEach(s => s.remove());
        if (isPortraitPhone()) {
          const mp4 = document.createElement('source');
          mp4.src  = 'assets/charlie-in-hell-portrait.mp4';
          mp4.type = 'video/mp4';
          hellVideo.appendChild(mp4);
        } else {
          const webm = document.createElement('source');
          webm.src  = 'assets/charlie-in-hell.webm';
          webm.type = 'video/webm';
          hellVideo.appendChild(webm);
          const mov = document.createElement('source');
          mov.src  = 'assets/charlie-in-hell.mov';
          mov.type = 'video/mp4; codecs="hvc1"';
          hellVideo.appendChild(mov);
        }
        hellVideo.removeAttribute('src');
        hellVideo.load();
      };
      setHellSrc();
    }
  }

  // ============================================================
  // SHOVEL CURSOR
  // ============================================================
  const shovel = document.createElement('div');
  shovel.className = 'shovel-cursor';
  shovel.setAttribute('aria-hidden', 'true');
  shovel.innerHTML = `
    <svg viewBox="0 0 50 90" xmlns="http://www.w3.org/2000/svg">
      <!-- T-grip handle top -->
      <rect x="10" y="2" width="30" height="8" fill="#8a6a4a" stroke="#3a2618" stroke-width="1.5" rx="1"/>
      <!-- shaft -->
      <rect x="22" y="8" width="6" height="50" fill="#8a6a4a" stroke="#3a2618" stroke-width="1.5"/>
      <!-- shovel head connector -->
      <rect x="18" y="56" width="14" height="6" fill="#5a4030" stroke="#3a2618" stroke-width="1.5"/>
      <!-- shovel blade (curvy spade) -->
      <path d="M10 60 L40 60 L36 78 Q25 88 14 78 Z" fill="#9aa0a8" stroke="#1a1614" stroke-width="2"/>
      <line x1="25" y1="62" x2="25" y2="80" stroke="#5a5a5a" stroke-width="1.2"/>
    </svg>
  `;
  document.body.appendChild(shovel);

  let mx = -200, my = -200;
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    // shovel hot-spot at the tip of the blade (bottom-center of svg)
    shovel.style.transform = `translate3d(${mx - 25}px, ${my - 80}px, 0) rotate(-12deg)`;
  }, { passive: true });


  // ============================================================
  // GRASS — gets disturbed/holed when the cursor passes through it
  // ============================================================
  const grass = document.getElementById('digGrass');
  const grassCanvas = document.getElementById('digGrassCanvas');
  if (grassCanvas && grass) {
    const gctx = grassCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const sizeGrass = () => {
      const r = grass.getBoundingClientRect();
      grassCanvas.width  = Math.max(1, r.width  * dpr);
      grassCanvas.height = Math.max(1, r.height * dpr);
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeGrass();
    window.addEventListener('resize', sizeGrass);

    let lastGX = null, lastGY = null;
    window.addEventListener('mousemove', (e) => {
      const r = grassCanvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) {
        lastGX = null;
        return;
      }
      if (lastGX === null) { lastGX = x; lastGY = y; return; }
      // dig out a "hole" in the grass — paint a dark patch with kicked dirt
      gctx.lineCap = 'round';
      gctx.lineJoin = 'round';
      gctx.lineWidth = 36;
      gctx.strokeStyle = 'rgba(40, 24, 12, 0.95)';
      gctx.beginPath();
      gctx.moveTo(lastGX, lastGY);
      gctx.lineTo(x, y);
      gctx.stroke();
      // crumbled dirt dots around it
      for (let i = 0; i < 4; i++) {
        const px = x + (Math.random() - 0.5) * 30;
        const py = y + (Math.random() - 0.5) * 16;
        gctx.fillStyle = 'rgba(20, 12, 6, 0.85)';
        gctx.beginPath();
        gctx.arc(px, py, 1.5 + Math.random() * 2.5, 0, Math.PI * 2);
        gctx.fill();
      }
      lastGX = x; lastGY = y;
    }, { passive: true });
  }


  // ============================================================
  // UNDERGROUND — cavern tunnels with rocks, droplets, jagged bits
  // ============================================================
  const underground = document.getElementById('digUnderground');
  if (underground) {
    const canvas = document.createElement('canvas');
    canvas.className = 'dig-canvas';
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '2',
    });
    underground.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = underground.getBoundingClientRect();
      canvas.width  = Math.max(1, r.width  * dpr);
      canvas.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let lx = null, ly = null;

    const draw = (x, y) => {
      if (lx === null) { lx = x; ly = y; return; }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // outer cavern (rough wall)
      ctx.lineWidth = 88;
      ctx.strokeStyle = 'rgba(8, 4, 2, 0.55)';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke();

      // mid layer
      ctx.lineWidth = 64;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke();

      // inner pitch black
      ctx.lineWidth = 42;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.97)';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke();

      const segLen = Math.hypot(x - lx, y - ly);
      const segs = Math.max(1, Math.floor(segLen / 8));

      // rocks (medium grey rounded bumps along the cavern wall)
      for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const px = lx + (x - lx) * t + (Math.random() - 0.5) * 80;
        const py = ly + (y - ly) * t + (Math.random() - 0.5) * 80;
        if (Math.random() < 0.18) {
          ctx.fillStyle = `rgba(${50 + Math.random() * 30}, ${42 + Math.random() * 24}, ${36 + Math.random() * 20}, 0.9)`;
          ctx.beginPath();
          ctx.arc(px, py, 3 + Math.random() * 5, 0, Math.PI * 2);
          ctx.fill();
          // tiny highlight on the rock
          ctx.fillStyle = 'rgba(180, 160, 140, 0.5)';
          ctx.beginPath();
          ctx.arc(px - 1, py - 1, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // water droplets (small light blue circles with shine, sparingly)
      for (let i = 0; i < segs; i++) {
        if (Math.random() < 0.08) {
          const t = i / segs;
          const px = lx + (x - lx) * t + (Math.random() - 0.5) * 50;
          const py = ly + (y - ly) * t + (Math.random() - 0.5) * 50;
          ctx.fillStyle = 'rgba(120, 160, 180, 0.55)';
          ctx.beginPath();
          ctx.arc(px, py, 2 + Math.random() * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(220, 240, 255, 0.7)';
          ctx.beginPath();
          ctx.arc(px - 0.6, py - 0.6, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // loose dirt dots scattered across the path
      for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const px = lx + (x - lx) * t + (Math.random() - 0.5) * 60;
        const py = ly + (y - ly) * t + (Math.random() - 0.5) * 60;
        ctx.fillStyle = 'rgba(20, 12, 6, 0.4)';
        ctx.beginPath();
        ctx.arc(px, py, 1.2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      lx = x; ly = y;
    };

    window.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      if (cx < 0 || cy < 0 || cx > r.width || cy > r.height) {
        lx = null;
        return;
      }
      draw(cx, cy);
    }, { passive: true });

    // ============================================================
    // WORM TRAIL — worm chews out the same 3-layer black cavern the
    // mouse-driven shovel does, sized wider so the worm's body fits
    // inside its tunnel. Uses independent lastWX/Y state so it doesn't
    // fight the mouse trail's lx/ly closure vars.
    // ============================================================
    const wormEls = [...document.querySelectorAll('.dig-worm')];
    if (wormEls.length) {
      // Same paint spec as the mouse-driven draw() above but with wider
      // strokes so the ~100px-tall worm body fits inside the pitch-black
      // inner tunnel. Also skips scattering rocks / droplets / dust so far
      // outside the tunnel — the ranges are proportionally larger.
      const drawWormTunnel = (px0, py0, px1, py1) => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // outer cavern wall — 130 → 110
        ctx.lineWidth = 110;
        ctx.strokeStyle = 'rgba(8, 4, 2, 0.55)';
        ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke();
        // mid layer — 108 → 92
        ctx.lineWidth = 92;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke();
        // inner pitch black — 90 → 76
        ctx.lineWidth = 76;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.97)';
        ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke();

        const segLen = Math.hypot(px1 - px0, py1 - py0);
        const segs = Math.max(1, Math.floor(segLen / 8));
        // rocks
        for (let i = 0; i < segs; i++) {
          if (Math.random() < 0.18) {
            const t = i / segs;
            const rx = px0 + (px1 - px0) * t + (Math.random() - 0.5) * 140;
            const ry = py0 + (py1 - py0) * t + (Math.random() - 0.5) * 140;
            ctx.fillStyle = `rgba(${50 + Math.random() * 30}, ${42 + Math.random() * 24}, ${36 + Math.random() * 20}, 0.9)`;
            ctx.beginPath(); ctx.arc(rx, ry, 3 + Math.random() * 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(180, 160, 140, 0.5)';
            ctx.beginPath(); ctx.arc(rx - 1, ry - 1, 1, 0, Math.PI * 2); ctx.fill();
          }
        }
        // droplets
        for (let i = 0; i < segs; i++) {
          if (Math.random() < 0.08) {
            const t = i / segs;
            const rx = px0 + (px1 - px0) * t + (Math.random() - 0.5) * 90;
            const ry = py0 + (py1 - py0) * t + (Math.random() - 0.5) * 90;
            ctx.fillStyle = 'rgba(120, 160, 180, 0.55)';
            ctx.beginPath(); ctx.arc(rx, ry, 2 + Math.random() * 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(220, 240, 255, 0.7)';
            ctx.beginPath(); ctx.arc(rx - 0.6, ry - 0.6, 0.6, 0, Math.PI * 2); ctx.fill();
          }
        }
        // dirt
        for (let i = 0; i < segs; i++) {
          const t = i / segs;
          const rx = px0 + (px1 - px0) * t + (Math.random() - 0.5) * 110;
          const ry = py0 + (py1 - py0) * t + (Math.random() - 0.5) * 110;
          ctx.fillStyle = 'rgba(20, 12, 6, 0.4)';
          ctx.beginPath(); ctx.arc(rx, ry, 1.2 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
        }
      };

      // The tunnel is drawn with a round-cap stroke, so its round leading
      // edge extends outerLineWidth/2 = 55px past the point we draw to.
      // To make the visible tunnel front-edge line up with the worm's
      // actual face pixel, we set the draw point INSIDE the worm by:
      //   [sprite transparent-padding ≈ 30] + [round cap radius ≈ 55] = 85.
      // For the default (right→left) worm the face is on the LEFT of its
      // container, so headOffset from the container's LEFT edge = 85.
      // For the reversed (left→right) worm (scaleX(-1)) the face is on
      // the RIGHT of its container, so headOffset from the LEFT edge =
      //   container_width - 85 = 260 - 85 = 175.
      const HEAD_OFFSET_PX     = 85;
      const HEAD_OFFSET_PX_REV = 175;

      // One tracker per worm — each keeps its own lastWX/lastWY so
      // trails don't cross-connect when a worm exits/enters the canvas.
      const trackers = wormEls.map(el => ({
        el,
        headOffset: el.classList.contains('dig-worm--rev') ? HEAD_OFFSET_PX_REV : HEAD_OFFSET_PX,
        lastX: null,
        lastY: null,
      }));

      const trackWorms = () => {
        const cr = canvas.getBoundingClientRect();
        for (const t of trackers) {
          const wr = t.el.getBoundingClientRect();
          const headX = wr.left + t.headOffset - cr.left;
          const y = wr.top + wr.height / 2 - cr.top;
          if (headX >= 0 && headX <= cr.width && y >= 0 && y <= cr.height) {
            if (t.lastX !== null && (Math.abs(headX - t.lastX) > 0.5 || Math.abs(y - t.lastY) > 0.5)) {
              drawWormTunnel(t.lastX, t.lastY, headX, y);
            }
            t.lastX = headX; t.lastY = y;
          } else {
            t.lastX = null; t.lastY = null;
          }
        }
        requestAnimationFrame(trackWorms);
      };
      requestAnimationFrame(trackWorms);
    }
  }


  // ============================================================
  // COFFIN AUTO-PLACEMENT — coffins with an explicit `position` in
  // Editable Text Content.json stay pinned exactly where Charlie put
  // them. Any coffin WITHOUT a `position` (i.e., new ones Charlie adds
  // later) gets scattered randomly across .dig-underground with a
  // collision-avoidance sweep. If placed coffins would cover more than
  // 25% of the underground surface, .dig-world extends by another
  // viewport of underground so there's room to breathe (and for
  // visitors to explore the extra cavern).
  //
  // Runs on content:loaded (after content-loader has rendered the
  // coffin templates from JSON). Idempotent — safe to call again on
  // resize since we re-check for unplaced coffins.
  // ============================================================
  const undergroundHost = document.getElementById('digUnderground');
  const digWorldHost    = document.getElementById('digWorld');
  const COFFIN_W_PX     = 400;   // matches .coffin { width: 400px }
  const COFFIN_H_PX     = 640;   // matches .coffin { height: 640px }
  const COFFIN_PAD_PX   = 40;    // min gap between any two coffins
  const COVERAGE_MAX    = 0.25;  // trigger for extending underground
  const PLACE_ATTEMPTS  = 60;    // retries per unplaced coffin

  // Detect whether a coffin already has an explicit position (pinned by
  // JSON via data-style-from). content-loader writes `top:...; left:...`
  // as an inline style attribute — we look for that.
  const isPinned = (el) =>
    /\btop\s*:/i.test(el.getAttribute('style') || '') &&
    (/\bleft\s*:/i.test(el.getAttribute('style') || '') ||
     /\bright\s*:/i.test(el.getAttribute('style') || ''));

  // Turn a coffin element's on-screen box into underground-local coords.
  const localRect = (el, ugRect) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - ugRect.left, y: r.top - ugRect.top, w: r.width, h: r.height };
  };

  // Bounding-box overlap check with padding around each rect.
  const overlaps = (a, b) =>
    !(a.x + a.w + COFFIN_PAD_PX < b.x ||
      a.x - COFFIN_PAD_PX > b.x + b.w ||
      a.y + a.h + COFFIN_PAD_PX < b.y ||
      a.y - COFFIN_PAD_PX > b.y + b.h);

  const placeUnpinnedCoffins = () => {
    if (!undergroundHost || !digWorldHost) return;

    const coffins = [...undergroundHost.querySelectorAll('.coffin')]
      .filter(el => !el.classList.contains('coffin--skeleton') &&
                    !el.classList.contains('coffin--charlie'));
    if (!coffins.length) return;

    const unpinned = coffins.filter(el => !isPinned(el));
    if (!unpinned.length) return;   // nothing to do — every coffin is pinned

    // Reset any prior auto-placement so re-runs on resize start clean.
    unpinned.forEach(el => {
      el.style.top = '';
      el.style.left = '';
      el.style.removeProperty('--rot');
    });

    let extensionVh = 0;
    const attemptRound = () => {
      const ugRect = undergroundHost.getBoundingClientRect();
      // pinned coffins have already been laid out by CSS — read their
      // current pixel positions after any extension we've applied.
      const pinnedRects = coffins.filter(isPinned).map(el => localRect(el, ugRect));

      // Also count the skeleton/charlie coffins so they don't get
      // overlapped by random placement (they're structural, not in the
      // JSON list).
      const skeleton = undergroundHost.querySelector('#coffinSkeleton');
      if (skeleton) pinnedRects.push(localRect(skeleton, ugRect));

      const placed = [...pinnedRects];
      const usableW = ugRect.width  - COFFIN_W_PX - 2 * COFFIN_PAD_PX;
      const usableH = ugRect.height - COFFIN_H_PX - 2 * COFFIN_PAD_PX;
      if (usableW <= 0 || usableH <= 0) return false;   // underground too small

      for (const el of unpinned) {
        let ok = false;
        for (let i = 0; i < PLACE_ATTEMPTS; i++) {
          const x = COFFIN_PAD_PX + Math.random() * usableW;
          const y = COFFIN_PAD_PX + Math.random() * usableH;
          const candidate = { x, y, w: COFFIN_W_PX, h: COFFIN_H_PX };
          if (placed.every(p => !overlaps(candidate, p))) {
            const rotDeg = (Math.random() * 24 - 12).toFixed(1);
            el.style.top  = `${(y / ugRect.height * 100).toFixed(2)}%`;
            el.style.left = `${(x / ugRect.width  * 100).toFixed(2)}%`;
            el.style.setProperty('--rot', `${rotDeg}deg`);
            placed.push(candidate);
            ok = true;
            break;
          }
        }
        if (!ok) return false;      // couldn't fit — bail so we extend
      }

      // Coverage check: reject if total coffin area exceeds threshold.
      const coffinArea = placed.reduce((sum, r) => sum + r.w * r.h, 0);
      const totalArea  = ugRect.width * ugRect.height;
      return (coffinArea / totalArea) <= COVERAGE_MAX;
    };

    // Try to place; each failure extends .dig-world by another viewport
    // of underground and retries. Cap at 8 extensions so we can't loop
    // forever if the viewport is impossibly small.
    for (let round = 0; round < 8; round++) {
      // Reset positions for a clean attempt
      unpinned.forEach(el => { el.style.top = ''; el.style.left = ''; el.style.removeProperty('--rot'); });
      if (attemptRound()) return;

      extensionVh += 100;
      digWorldHost.style.height = `calc(320vh + ${extensionVh}vh)`;
      // Force layout so the next getBoundingClientRect sees the new size.
      void digWorldHost.offsetHeight;
    }
  };

  if (document.querySelector('.dig-underground .coffin')) placeUnpinnedCoffins();
  document.addEventListener('content:loaded', placeUnpinnedCoffins);
  // Re-run on resize with a debounce so proportions stay sensible when
  // viewport changes.
  let coffinResizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(coffinResizeT);
    coffinResizeT = setTimeout(placeUnpinnedCoffins, 250);
  });


  // ============================================================
  // SKELETON COFFIN — eyes glow red as you scroll deeper
  // CHARLIE COFFIN — scratch animation as you scroll deeper
  // ============================================================

  // ---- skeleton eyes glow red ONLY when cursor hovers the coffin ----
  // The skeleton SVG is loaded asynchronously by art-loader (it lives in
  // assets/skeleton.svg), so wait for art:loaded before wiring up the
  // hover listeners that target the IDs inside it.
  const wireSkeletonEyes = () => {
    const skullL = document.getElementById('skullEyeL');
    const skullR = document.getElementById('skullEyeR');
    const skeletonCoffin = document.getElementById('coffinSkeleton');
    if (!skeletonCoffin || !skullL || !skullR) return;
    skeletonCoffin.style.pointerEvents = 'auto';
    const setRed = () => {
      skullL.setAttribute('fill', '#ff1a14');
      skullR.setAttribute('fill', '#ff1a14');
      skullL.style.filter = 'drop-shadow(0 0 8px rgba(255, 30, 24, 0.95))';
      skullR.style.filter = 'drop-shadow(0 0 8px rgba(255, 30, 24, 0.95))';
    };
    const setDark = () => {
      skullL.setAttribute('fill', '#1a0a08');
      skullR.setAttribute('fill', '#1a0a08');
      skullL.style.filter = 'none';
      skullR.style.filter = 'none';
    };
    // Desktop: hover-driven. Unchanged.
    skeletonCoffin.addEventListener('mouseenter', setRed);
    skeletonCoffin.addEventListener('mouseleave', setDark);
    // iPhone: mouseenter/mouseleave don't fire predictably on touch, so
    // add explicit press-and-hold handlers. Feels the same as hover — the
    // eyes glow while your finger is on the coffin and go dark when you
    // lift it — but doesn't require the ambiguous tap-to-toggle model.
    skeletonCoffin.addEventListener('touchstart', setRed, { passive: true });
    skeletonCoffin.addEventListener('touchend', setDark);
    skeletonCoffin.addEventListener('touchcancel', setDark);
  };
  if (document.getElementById('skullEyeL')) wireSkeletonEyes();
  else document.addEventListener('art:loaded', wireSkeletonEyes, { once: true });

  // hide the fixed sky-text once the user reaches the hell section so the
  // red background gets to fully cover it (z-index alone isn't enough
  // because the text is position: fixed at top:14vh of the viewport)
  const skyText = document.querySelector('.dig-sky-text');
  const digWorldEl = document.getElementById('digWorld');
  const updateSkyTextVisibility = () => {
    if (!skyText || !digWorldEl) return;
    const r = digWorldEl.getBoundingClientRect();
    // when dig-world bottom passes the top of the viewport (= we're in hell)
    skyText.style.opacity = (r.bottom < window.innerHeight * 0.4) ? '0' : '1';
    skyText.style.transition = 'opacity 0.3s ease';
  };
  window.addEventListener('scroll', updateSkyTextVisibility, { passive: true });
  updateSkyTextVisibility();

  // ---- Charlie kicks legs (hands grip the walls — no arm animation) ----
  // The charlie figure SVG is loaded asynchronously by art-loader (it lives
  // in assets/charlie-figure.svg), so look up #charlieLegs lazily each frame
  // until it appears, then animate the .charlie-leg-l / .charlie-leg-r lines.
  let charlieLegsEl = null;
  const animateCharlie = () => {
    if (!charlieLegsEl) charlieLegsEl = document.getElementById('charlieLegs');
    if (charlieLegsEl) {
      const phase = performance.now() * 0.012;
      const legL = charlieLegsEl.querySelector('.charlie-leg-l');
      const legR = charlieLegsEl.querySelector('.charlie-leg-r');
      if (legL && legR) {
        const kick = Math.sin(phase * 2.6) * 8;
        legL.setAttribute('x2', String(26 + kick));
        legL.setAttribute('y2', String(98 + Math.sin(phase * 2.6 + 0.5) * 4));
        legR.setAttribute('x2', String(54 - kick));
        legR.setAttribute('y2', String(98 - Math.sin(phase * 2.6 + 0.5) * 4));
      }
    }
    requestAnimationFrame(animateCharlie);
  };
  requestAnimationFrame(animateCharlie);


  // ============================================================
  // CLOUDS in the sky — same puffy PNGs as the production page
  // (assets/scenery/cloud-1/2/3.png) so both pages share a look.
  // ============================================================
  const cloudHost = document.getElementById('digClouds');
  const buildClouds = () => {
    if (!cloudHost) return;
    const PUFFY_CLOUDS = [
      'assets/scenery/cloud-1.png',
      'assets/scenery/cloud-2.png',
      'assets/scenery/cloud-3.png',
    ];
    // Cloud top-positions shifted up ~4% (Charlie: 'move the clouds up
     // slightly') so they don't collide with the sky text/lede pushed
     // down below.
    const conf = [
      { top: '0%',  dur: 95,  delay: 0 },
      { top: '7%',  dur: 125, delay: -30 },
      { top: '2%',  dur: 80,  delay: -65 },
      { top: '12%', dur: 110, delay: -10 },
      { top: '16%', dur: 140, delay: -88 },
    ];
    for (let i = 0; i < conf.length; i++) {
      const c = conf[i];
      const el = document.createElement('div');
      // sky-cloud--puffy gives the same 360px wide, natural-aspect
      // display + <img> child styling that production uses.
      el.className = 'sky-cloud sky-cloud--puffy';
      el.style.top = c.top;
      el.style.animationDuration = `${c.dur}s`;
      el.style.animationDelay = `${c.delay}s`;
      const src = PUFFY_CLOUDS[i % PUFFY_CLOUDS.length];
      el.innerHTML = `<img src="${src}" alt="" draggable="false">`;
      cloudHost.appendChild(el);
    }
  };
  // No art-loader dependency any more (we're using direct PNG paths),
  // so build immediately — but keep listening for art:loaded too in case
  // this script runs before the DOM is fully attached.
  buildClouds();


  // ============================================================
  // SCROLL PARALLAX — hills and background trees move at different
  // speeds so the sky-portion feels three-dimensional as the user
  // scrolls. Each element has [data-parallax="0.x"] — lower = deeper.
  // ============================================================
  const parallaxItems = document.querySelectorAll('[data-parallax]');
  if (parallaxItems.length) {
    // Cache the speed value once instead of parseFloat every frame
    const items = Array.from(parallaxItems).map(el => ({
      el,
      speed: parseFloat(el.dataset.parallax) || 0,
    }));

    let ticking = false;
    const applyParallax = () => {
      const y = window.scrollY;
      for (const { el, speed } of items) {
        // positive translate = element "lags behind" the scroll
        // existing transforms (like scaleX(-1) on the mirrored tree)
        // are preserved by tucking parallax into a CSS custom property
        el.style.setProperty('--py', `${y * speed}px`);
      }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyParallax);
      }
    }, { passive: true });
    applyParallax();
  }


  // ============================================================
  // BURIED CHEST — desktop-only easter egg. Charlie: 'hide the first
  // image from this sprite sheet underneath the dirt… when a user
  // COMPLETELY unburies it and then CLICKS it, have the chest
  // animation happen of it opening, and then a new dialogue box with
  // a new video pops up.'
  //
  // Flow:
  //   1. Chest sits at right:22% top:62% in .dig-underground under
  //      a dirt patch. data-dig starts at 0.
  //   2. Every click on the dirt increments data-dig (CSS peels
  //      the dirt back a slice at a time). At data-dig=5 the dirt
  //      disappears entirely.
  //   3. Click on the fully-revealed chest steps the sprite through
  //      frames 1→8 (250ms/frame), then opens the video lightbox.
  //   4. If user clicks the sprite before it's fully dug, the click
  //      counts as another dig — so a chest never becomes 'stuck'.
  //
  // Touch devices are ruled out entirely via CSS display:none on
  // .dig-chest inside the (hover: none) media block.
  // ============================================================
  const chestEl = document.getElementById('digChest');
  if (chestEl && window.matchMedia('(hover: hover)').matches) {
    const dirtEl   = chestEl.querySelector('.dig-chest-dirt');
    const spriteEl = chestEl.querySelector('.dig-chest-sprite');
    const DIG_CLICKS_NEEDED = 5;
    const CHEST_VIDEO_URL   = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    // Sprite is 4 cols × 2 rows = 8 frames total.
    const COLS = 4;
    const ROWS = 2;
    const TOTAL_FRAMES = COLS * ROWS;
    const FRAME_MS = 90;

    let digCount = 0;
    let isOpening = false;

    const incrementDig = () => {
      digCount = Math.min(digCount + 1, DIG_CLICKS_NEEDED);
      chestEl.dataset.dig = String(digCount);
    };

    const playOpenAnimation = () => {
      if (isOpening) return;
      isOpening = true;
      let frame = 0;
      const step = () => {
        const col = frame % COLS;
        const row = Math.floor(frame / COLS);
        // With background-size: 400% 200%, background-position 0%..100%
        // moves the sheet by exactly one frame per (100/(cols-1))% or
        // (100/(rows-1))% — so col/(cols-1)*100% picks the right column
        // and row/(rows-1)*100% picks the right row.
        spriteEl.style.backgroundPosition =
          `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;
        frame++;
        if (frame < TOTAL_FRAMES) {
          setTimeout(step, FRAME_MS);
        } else {
          // Small beat after the last frame so the "fully open with
          // sparkles" pose registers before the lightbox blows in.
          setTimeout(() => {
            if (window.VideoLightbox) window.VideoLightbox.open(CHEST_VIDEO_URL);
          }, 380);
        }
      };
      step();
    };

    // Clicks anywhere on the chest container while it's still
    // buried count as a dig; clicks after it's fully dug play the
    // animation. Two separate elements (dirt + sprite) both listen
    // via delegation on the parent so no click is missed.
    chestEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (digCount < DIG_CLICKS_NEEDED) {
        incrementDig();
      } else {
        playOpenAnimation();
      }
    });
  }

})();
