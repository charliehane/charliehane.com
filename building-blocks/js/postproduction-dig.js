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
  // Underground dig-canvas is desktop-only. Charlie: 'make it so the
   // iphone can't dig' — the shovel-cursor mechanic is a computer
   // interaction, and on touch devices a single tap fires a synthetic
   // mousemove that would spray a random dark scribble into the
   // underground. Gate on (hover: hover) so pointer-only devices skip
   // the entire block (worm-tunnel painting AND chest cover both go
   // dark on iPhone).
  const underground = document.getElementById('digUnderground');
  if (underground && window.matchMedia('(hover: hover)').matches) {
    const canvas = document.createElement('canvas');
    canvas.className = 'dig-canvas';
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '2',
    });
    underground.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // Cap DPR at 1 for the underground canvas — it's HUGE (grows to
    // ~2880x16000+ CSS px as the coffin list expands), and 2x DPR
    // there means a 190MB backing store per allocation. Perf tanked
    // after the 2-column / bigger-coffin refactor. Shovel + worm
    // paint reads fine at 1x on retina since strokes are wide.
    const dpr = 1;

    const resize = () => {
      const r = underground.getBoundingClientRect();
      const newW = Math.max(1, Math.round(r.width  * dpr));
      const newH = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width === newW && canvas.height === newH) return;
      canvas.width  = newW;
      canvas.height = newH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    // Underground grows AFTER content:loaded (placeUnpinnedCoffins can
    // extend digWorldHost by another viewport whenever coffins don't
    // fit). Without a size-sync here the canvas backing stayed at the
    // initial small size and CSS stretched it to fit, offsetting every
    // paint stroke — Charlie: 'the dig effect is really low compared
    // to the shovel/cursor… the worm tunnel no longer aligns.'
    // placeUnpinnedCoffins fires this custom event after each extension.
    underground.addEventListener('dig-underground-resized', resize);
    document.addEventListener('content:loaded', () => setTimeout(resize, 0));

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
  const COFFIN_W_PX     = 500;   // matches .coffin { width: 500px }
  const COFFIN_H_PX     = 800;   // matches .coffin { height: 800px }
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

    // Charlie: 'I want them to always be equidistant from one another.'
    // Ignore any inline pinned positions from the JSON `position` field
    // — force ALL coffins onto the same grid so the spacing is uniform.
    coffins.forEach(el => {
      el.style.top = '';
      el.style.left = '';
      el.style.right = '';
      el.style.removeProperty('--rot');
    });

    // MOBILE fast path: on narrow viewports the desktop nudge algorithm
    // leaves wildly uneven gaps between coffins (single column can't
    // dodge collisions without huge Y shifts). Bypass it entirely and
    // stack coffins in a straight column with fixed even spacing, then
    // size the dig-world to fit exactly. Simple, predictable, no giant
    // empty scroll stretches between coffins.
    if (window.innerWidth < 640) {
      const measured = coffins[0].getBoundingClientRect();
      const cofH = measured.height || COFFIN_H_PX;
      const N = coffins.length;
      const GAP = 60;                     // vertical air between coffins
      const TOP_PAD = 80;                 // grass-line breathing room
      const BOTTOM_PAD = 120;             // room for Charlie-in-Hell below
      const stackH = TOP_PAD + N * cofH + (N - 1) * GAP + BOTTOM_PAD;
      digWorldHost.style.height = stackH + 'px';
      void digWorldHost.offsetHeight;
      const ugRectM = undergroundHost.getBoundingClientRect();
      const ugH = ugRectM.height || stackH;
      const ugW = ugRectM.width;
      const cofW = measured.width || COFFIN_W_PX;
      // Coffin has no CSS transform-based centering; use % of the actual
      // (ugW - cofW)/2 offset so it sits centered horizontally.
      const centerLeftPct = ((ugW - cofW) / 2 / ugW * 100).toFixed(2);
      coffins.forEach((el, i) => {
        const y = TOP_PAD + i * (cofH + GAP);
        el.style.top  = `${(y / ugH * 100).toFixed(2)}%`;
        el.style.left = `${centerLeftPct}%`;
        el.style.setProperty('--rot', `${(i % 2 === 0 ? -6 : 6).toFixed(1)}deg`);
      });
      undergroundHost.dispatchEvent(
        new CustomEvent('dig-underground-resized', { bubbles: false })
      );
      return;
    }

    let extensionVh = 0;
    const attemptRound = () => {
      const ugRect = undergroundHost.getBoundingClientRect();
      // Skeleton coffin (structural, not in the JSON coffins list).
      const obstacles = [];
      const skeleton = undergroundHost.querySelector('#coffinSkeleton');
      if (skeleton) obstacles.push(localRect(skeleton, ugRect));
      // Chest dig zone off-limits. Charlie: 'a coffin is never set
      // overtop of the hidden videos dirt.'
      const chest = document.getElementById('digChest');
      if (chest && chest.offsetParent !== null) {
        const cr = chest.getBoundingClientRect();
        obstacles.push({
          x: cr.left - ugRect.left - 50,
          y: cr.top  - ugRect.top  - 50,
          w: cr.width  + 100,
          h: cr.height + 100,
        });
      }

      // Measure a coffin's actual rendered size (CSS scales them down on
      // mobile — hardcoded desktop constants would go negative on iPhone
      // and skip placement entirely, stacking every coffin at (0,0)).
      const measured = coffins[0].getBoundingClientRect();
      const cofW = measured.width  || COFFIN_W_PX;
      const cofH = measured.height || COFFIN_H_PX;
      const usableW = ugRect.width  - cofW - 2 * COFFIN_PAD_PX;
      const usableH = ugRect.height - cofH - 2 * COFFIN_PAD_PX;
      if (usableW <= 0 || usableH <= 0) return false;

      // Column count adapts to viewport width. On narrow screens
      // (iPhone) a two-column layout tries to fit two coffins side by
      // side that can't actually fit, and the fallback nudges leave big
      // gaps of empty dirt between rows. Single column stacks cleanly.
      const isNarrow = ugRect.width < 640;
      const COL_CENTERS_FRAC = isNarrow ? [0.5] : [0.25, 0.75];
      const N = coffins.length;
      // Bigger top pad on mobile so the first coffin doesn't sit
      // right up against the grass line (Charlie: 'the first coffin
      // is WAY too close to the top').
      const EDGE_PAD_PX = isNarrow ? 80 : 12;
      const stepFrac = N > 1 ? 1 / (N - 1) : 0;
      const usableHEdge = ugRect.height - cofH - 2 * EDGE_PAD_PX;
      const placedCoffins = [];   // includes each accepted coffin so
                                  // later coffins dodge earlier ones,
                                  // not just skeleton/chest.
      let anyForced = false;
      for (let idx = 0; idx < N; idx++) {
        const el = coffins[idx];
        const col = idx % COL_CENTERS_FRAC.length;
        const baseY = EDGE_PAD_PX + (N > 1 ? idx * stepFrac : 0.5) * usableHEdge;
        const baseX = COFFIN_PAD_PX + COL_CENTERS_FRAC[col] * usableW;
        const otherX = COFFIN_PAD_PX + COL_CENTERS_FRAC[(col + 1) % COL_CENTERS_FRAC.length] * usableW;
        const rowH = usableHEdge / Math.max(1, N - 1);
        const yNudges = [0, -rowH * 0.25, rowH * 0.25, -rowH * 0.5, rowH * 0.5];
        let x = baseX, y = baseY, placed = false;
        for (const xTry of [baseX, otherX]) {
          for (const dy of yNudges) {
            const cand = {
              x: xTry,
              y: Math.max(EDGE_PAD_PX, Math.min(EDGE_PAD_PX + usableHEdge, baseY + dy)),
              w: cofW, h: cofH,
            };
            const hits = obstacles.some(o => overlaps(cand, o)) ||
                         placedCoffins.some(p => overlaps(cand, p));
            if (!hits) { x = cand.x; y = cand.y; placed = true; break; }
          }
          if (placed) break;
        }
        // CRITICAL: never leave a coffin unplaced. Charlie's bug —
        // 'the first two coffins overlap, this can NEVER happen' —
        // was that a failed round cleared all inline positions and
        // exited, stacking every coffin at (0,0). If nudges can't
        // dodge the obstacle, force the base slot so at least the
        // grid layout stands. Signal for a retry via anyForced so
        // the outer loop extends the underground and gives a real
        // clean layout on the next attempt.
        if (!placed) { anyForced = true; }
        placedCoffins.push({ x, y, w: COFFIN_W_PX, h: COFFIN_H_PX });
        const rotDeg = ((idx % 2 === 0) ? -6 : 6).toFixed(1);
        el.style.top  = `${(y / ugRect.height * 100).toFixed(2)}%`;
        el.style.left = `${(x / ugRect.width  * 100).toFixed(2)}%`;
        el.style.setProperty('--rot', `${rotDeg}deg`);
      }

      // Coverage check + no-force check: only accept the round as
      // fully successful if placement never had to force-through a
      // collision AND coffin area is under threshold. Failure returns
      // false → outer loop extends the underground and tries again,
      // BUT positions are already set on every coffin, so a final-
      // round bail doesn't leave anything at (0,0).
      const coffinArea = N * cofW * cofH;
      const totalArea  = ugRect.width * ugRect.height;
      const coverageOK = (coffinArea / totalArea) <= COVERAGE_MAX;
      return coverageOK && !anyForced;
    };

    // Try to place; each failure extends .dig-world by another viewport
    // of underground and retries. Cap at 8 extensions so we can't loop
    // forever if the viewport is impossibly small.
    for (let round = 0; round < 8; round++) {
      coffins.forEach(el => { el.style.top = ''; el.style.left = ''; el.style.right = ''; el.style.removeProperty('--rot'); });
      if (attemptRound()) break;

      extensionVh += 100;
      digWorldHost.style.height = `calc(320vh + ${extensionVh}vh)`;
      // Force layout so the next getBoundingClientRect sees the new size.
      void digWorldHost.offsetHeight;
    }
    // Only notify AFTER the loop settles — firing inside the loop
    // reallocated the ~2880xNNN dig-canvas backing store on every
    // extension iteration (up to 8x per load), which tanked perf.
    undergroundHost.dispatchEvent(
      new CustomEvent('dig-underground-resized', { bubbles: false })
    );
  };

  if (document.querySelector('.dig-underground .coffin')) placeUnpinnedCoffins();
  document.addEventListener('content:loaded', placeUnpinnedCoffins);
  // Re-run on resize with a debounce so proportions stay sensible when
  // viewport changes. iOS Safari fires `resize` every time the address
  // bar shows/hides, which was collapsing the extended dig-world back
  // to baseline mid-scroll and snapping the user up. Skip re-placement
  // when only the viewport HEIGHT changed — coffin layout depends on
  // width, not height.
  let coffinResizeT = 0;
  let lastReplacementW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastReplacementW) return;
    clearTimeout(coffinResizeT);
    coffinResizeT = setTimeout(() => {
      lastReplacementW = window.innerWidth;
      placeUnpinnedCoffins();
    }, 250);
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
    const spriteEl = chestEl.querySelector('.dig-chest-sprite');
    // URLs come from postproduction.chestVideoUrls in Editable Text
    // Content.json (labeled "Secrete Videos - Post production" in
    // Pages CMS). ONE is picked at random per unburial so repeat
    // visitors get variety. Read lazily at click time so CMS edits
    // take effect without a code change, and fall back to the demo
    // video if the content hasn't loaded yet. Also honors the legacy
    // singular `chestVideoUrl` field so an older JSON keeps working.
    const CHEST_VIDEO_URL_FALLBACK = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    const getChestVideoUrl = () => {
      const post = window.__CONTENT__ && window.__CONTENT__.postproduction;
      const list = post && post.chestVideoUrls;
      if (Array.isArray(list) && list.length) {
        return list[Math.floor(Math.random() * list.length)];
      }
      return (post && post.chestVideoUrl) || CHEST_VIDEO_URL_FALLBACK;
    };
    const COLS = 4, ROWS = 2, TOTAL_FRAMES = COLS * ROWS, FRAME_MS = 90;

    // Chest sits under a canvas cover filled with the SAME gradient
    // the .dig-underground uses, aligned so the gradient stripe
    // inside the cover matches the stripe outside — no visible
    // rectangle. Shovel motion erases the cover with the same 3-pass
    // stroke spec the global underground dig-canvas paints with,
    // so the dig feels identical. At CLEAR_THRESHOLD (60%) erased,
    // the cover hides and the chest is clickable.
    const CLEAR_THRESHOLD  = 0.60;
    const CHECK_EVERY_N    = 5;
    // Same stroke widths + alphas as the global underground dig
    // (see draw() in the underground block above) — this is what
    // makes the chest dig FEEL like the rest of the page.
    const STROKES = [
      { w: 88, a: 0.55 },
      { w: 64, a: 0.75 },
      { w: 42, a: 0.97 },
    ];
    // Underground gradient stops — mirrors the CSS at .dig-underground.
    const UG_STOPS = [
      { p: 0.00, c: [0x6a, 0x4a, 0x2a] },
      { p: 0.12, c: [0x5a, 0x3a, 0x20] },
      { p: 0.28, c: [0x4a, 0x30, 0x18] },
      { p: 0.44, c: [0x3a, 0x25, 0x16] },
      { p: 0.60, c: [0x2a, 0x18, 0x10] },
      { p: 0.78, c: [0x1a, 0x0e, 0x08] },
      { p: 1.00, c: [0x05, 0x03, 0x02] },
    ];
    const undergroundEl = document.getElementById('digUnderground');
    const coverEl       = document.getElementById('digChestCover');
    const ctx           = coverEl.getContext('2d');

    const colorAt = (frac) => {
      const f = Math.max(0, Math.min(1, frac));
      for (let i = 1; i < UG_STOPS.length; i++) {
        const a = UG_STOPS[i - 1], b = UG_STOPS[i];
        if (f <= b.p) {
          const t = (f - a.p) / (b.p - a.p);
          const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * t);
          const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * t);
          const bl= Math.round(a.c[2] + (b.c[2] - a.c[2]) * t);
          return `rgb(${r}, ${g}, ${bl})`;
        }
      }
      const last = UG_STOPS[UG_STOPS.length - 1].c;
      return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
    };

    let isOpening   = false;
    let isFullyDug  = false;
    let lastX = null, lastY = null;
    let movesSinceCheck = 0;

    const sizeAndFill = () => {
      if (!undergroundEl) return;
      const cRect = coverEl.getBoundingClientRect();
      const uRect = undergroundEl.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      coverEl.width  = Math.max(1, Math.round(cRect.width  * dpr));
      coverEl.height = Math.max(1, Math.round(cRect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The underground gradient spans uRect.height; the cover occupies
      // Y = (cRect.top - uRect.top) → (cRect.bottom - uRect.top) within it.
      const topFrac    = (cRect.top    - uRect.top) / uRect.height;
      const bottomFrac = (cRect.bottom - uRect.top) / uRect.height;
      const grad = ctx.createLinearGradient(0, 0, 0, cRect.height);
      // Interpolate stops across the covered slice so the gradient
      // matches the underground continuously (top and bottom edges
      // land on the exact color the underground has there).
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ugF = topFrac + (bottomFrac - topFrac) * t;
        grad.addColorStop(t, colorAt(ugF));
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cRect.width, cRect.height);
      // Sprinkle the same dark-dot speckle pattern the underground's
      // ::before pseudo-element has, so the cover blends into its
      // surroundings — Charlie: 'the gradient of dirt hiding the
      // secret video message is easily seen.' Semi-random dots seeded
      // by position so re-fills give the same pattern.
      const seed = Math.floor(cRect.left * 1000 + cRect.top);
      let s = seed;
      const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      const dotCount = Math.round((cRect.width * cRect.height) / 900);
      for (let i = 0; i < dotCount; i++) {
        const dx = rand() * cRect.width;
        const dy = rand() * cRect.height;
        const rad = 3 + rand() * 5;
        ctx.fillStyle = `rgba(0,0,0,${0.30 + rand() * 0.10})`;
        ctx.beginPath(); ctx.arc(dx, dy, rad, 0, Math.PI * 2); ctx.fill();
      }
      // Carve the whole rect into a rough oval blob. Charlie: 'still
      // too square, not oval enough.' Build a MASK on a temp canvas
      // by drawing one main ellipse plus several offset ellipses at
      // deterministic positions around it — that produces an irregular
      // bulging silhouette. Then apply the mask with destination-in
      // so the corners of the rectangle vanish and the fill only
      // shows inside the blob's soft edge.
      const w = cRect.width, h = cRect.height;
      const cx = w / 2, cy = h / 2;
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width  = coverEl.width;
      maskCanvas.height = coverEl.height;
      const mctx = maskCanvas.getContext('2d');
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Main oval — 90% of the shorter side across, more like an
      // ellipse than a circle so it doesn't fill the corners.
      const drawSoftEllipse = (ex, ey, rx, ry, coreStop) => {
        // Radial gradient (in a scaled space so it's oval-shaped).
        mctx.save();
        mctx.translate(ex, ey);
        mctx.scale(1, ry / rx);
        mctx.translate(-ex, -ey);
        const g = mctx.createRadialGradient(ex, ey, 0, ex, ey, rx);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(coreStop, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = g;
        mctx.fillRect(0, 0, w, h);
        mctx.restore();
      };
      const shortSide = Math.min(w, h);
      drawSoftEllipse(cx, cy, shortSide * 0.42, shortSide * 0.34, 0.55);
      // Deterministic offset bulges (5 of them around the perimeter)
      s = seed + 7919;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + rand() * 0.6;
        const dist = shortSide * (0.20 + rand() * 0.10);
        const bx = cx + Math.cos(angle) * dist;
        const by = cy + Math.sin(angle) * dist * 0.75;   // vertical squash
        const br = shortSide * (0.22 + rand() * 0.10);
        drawSoftEllipse(bx, by, br, br * 0.85, 0.35);
      }
      // Apply mask to the fill.
      ctx.globalCompositeOperation = 'destination-in';
      ctx.setTransform(1, 0, 0, 1, 0, 0);       // reset to raw canvas coords for drawImage
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    };
    sizeAndFill();
    window.addEventListener('resize', () => { if (!isFullyDug) sizeAndFill(); });
    // Re-paint after underground extension (positions shift, gradient
    // stops change slightly). Only if the chest hasn't been dug yet.
    undergroundEl?.addEventListener('dig-underground-resized', () => {
      if (!isFullyDug) sizeAndFill();
    });

    const eraseSegment = (x0, y0, x1, y1) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap  = 'round';
      ctx.lineJoin = 'round';
      for (const s of STROKES) {
        ctx.strokeStyle = `rgba(0,0,0,${s.a})`;
        ctx.lineWidth   = s.w;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    };

    const erasedFraction = () => {
      const w = coverEl.width, h = coverEl.height;
      const step = 8;
      const data = ctx.getImageData(0, 0, w, h).data;
      let clear = 0, total = 0;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          if (data[(y * w + x) * 4 + 3] === 0) clear++;
          total++;
        }
      }
      return total ? clear / total : 0;
    };

    window.addEventListener('mousemove', (e) => {
      if (isFullyDug) return;
      const r = coverEl.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < -20 || y < -20 || x > r.width + 20 || y > r.height + 20) {
        lastX = null; lastY = null;
        return;
      }
      if (lastX !== null) {
        eraseSegment(lastX, lastY, x, y);
        if (++movesSinceCheck >= CHECK_EVERY_N) {
          movesSinceCheck = 0;
          if (erasedFraction() >= CLEAR_THRESHOLD) {
            isFullyDug = true;
            chestEl.classList.add('is-fully-dug');
            const hint = document.getElementById('digChestHint');
            if (hint) hint.textContent = 'Click';
          }
        }
      }
      lastX = x; lastY = y;
    }, { passive: true });

    const playOpenAnimation = () => {
      if (isOpening) return;
      isOpening = true;
      let frame = 0;
      const step = () => {
        const col = frame % COLS;
        const row = Math.floor(frame / COLS);
        spriteEl.style.backgroundPosition =
          `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;
        frame++;
        if (frame < TOTAL_FRAMES) {
          setTimeout(step, FRAME_MS);
        } else {
          setTimeout(() => {
            if (window.VideoLightbox) window.VideoLightbox.open(getChestVideoUrl());
          }, 380);
        }
      };
      step();
    };

    spriteEl.addEventListener('click', (e) => {
      if (!isFullyDug) return;
      e.stopPropagation();
      playOpenAnimation();
    });
  }

})();
