(() => {

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
  }


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
    skeletonCoffin.addEventListener('mouseenter', () => {
      skullL.setAttribute('fill', '#ff1a14');
      skullR.setAttribute('fill', '#ff1a14');
      skullL.style.filter = 'drop-shadow(0 0 8px rgba(255, 30, 24, 0.95))';
      skullR.style.filter = 'drop-shadow(0 0 8px rgba(255, 30, 24, 0.95))';
    });
    skeletonCoffin.addEventListener('mouseleave', () => {
      skullL.setAttribute('fill', '#1a0a08');
      skullR.setAttribute('fill', '#1a0a08');
      skullL.style.filter = 'none';
      skullR.style.filter = 'none';
    });
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
  // CLOUDS in the sky
  // ============================================================
  const cloudHost = document.getElementById('digClouds');
  const FALLBACK_CLOUD_DIG = '<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg"><ellipse cx="48" cy="68" rx="42" ry="28" fill="white" opacity="0.95"/><ellipse cx="92" cy="50" rx="48" ry="34" fill="white" opacity="0.95"/><ellipse cx="148" cy="58" rx="50" ry="34" fill="white" opacity="0.95"/><ellipse cx="190" cy="72" rx="34" ry="22" fill="white" opacity="0.95"/><ellipse cx="118" cy="76" rx="60" ry="20" fill="white" opacity="0.95"/></svg>';
  const buildClouds = () => {
    if (!cloudHost) return;
    const CLOUD_SVG = (window.ART_CACHE && window.ART_CACHE.cloud) || FALLBACK_CLOUD_DIG;
    const conf = [
      { top: '4%',  scale: 1.0,  dur: 95,  delay: 0 },
      { top: '11%', scale: 0.7,  dur: 125, delay: -30 },
      { top: '6%',  scale: 1.3,  dur: 80,  delay: -65 },
      { top: '16%', scale: 0.85, dur: 110, delay: -10 },
      { top: '20%', scale: 0.6,  dur: 140, delay: -88 },
    ];
    for (const c of conf) {
      const el = document.createElement('div');
      el.className = 'sky-cloud';
      el.style.top = c.top;
      el.style.transform = `scale(${c.scale})`;
      el.style.animationDuration = `${c.dur}s`;
      el.style.animationDelay = `${c.delay}s`;
      el.innerHTML = CLOUD_SVG;
      cloudHost.appendChild(el);
    }
  };
  if (window.ART_CACHE && window.ART_CACHE.cloud) buildClouds();
  else document.addEventListener('art:loaded', buildClouds, { once: true });


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

})();
