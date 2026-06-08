/* ============================================================
   HAYEE INTERIOR — script.js
   All Interactions, Three.js Hero, GSAP Animations, UI Logic
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────
   1. PRELOADER
───────────────────────────────────────── */
(function initPreloader() {
  const preloader = document.getElementById('preloader');
  const preFill   = document.getElementById('preFill');
  const prePercent = document.getElementById('prePercent');

  if (!preloader) return;

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 18 + 4;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(() => {
        preloader.classList.add('hidden');
        document.body.style.overflow = '';
        initAll(); // boot everything after preloader
      }, 300);
    }
    preFill.style.width = progress + '%';
    prePercent.textContent = Math.floor(progress) + '%';
  }, 90);

  document.body.style.overflow = 'hidden';
})();

/* ─────────────────────────────────────────
   2. MAIN INIT — called after preloader
───────────────────────────────────────── */
function initAll() {
  initHeroThreeJS();
  initNavbar();
  initMobileMenu();
  initCustomCursor();
  initScrollReveal();
  initTestimonials();
  initCounterAnimation();
  initContactForm();
  initSmoothScroll();

  // Try GSAP enhancements if loaded
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    initGSAPAnimations();
  }
}

/* ─────────────────────────────────────────
   3. THREE.JS HERO — Floating 3D furniture shapes
───────────────────────────────────────── */
function initHeroThreeJS() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas || typeof THREE === 'undefined') {
    // Fallback gradient background
    const hero = document.getElementById('home');
    if (hero) {
      hero.style.background = 'linear-gradient(135deg, #1a1814 0%, #2c2720 50%, #1a1510 100%)';
    }
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x1a1814, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  camera.position.set(0, 0, 30);

  // ── Lighting ──
  const ambientLight = new THREE.AmbientLight(0xfaf8f4, 0.4);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xc9a96e, 1.2);
  dirLight1.position.set(10, 20, 15);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xe8d4a8, 0.6);
  dirLight2.position.set(-15, -10, 10);
  scene.add(dirLight2);

  const pointLight = new THREE.PointLight(0xa07840, 1.5, 60);
  pointLight.position.set(0, 8, 12);
  scene.add(pointLight);

  // ── Particles (dust/stars) ──
  const particleCount = 280;
  const particleGeo   = new THREE.BufferGeometry();
  const positions      = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 10;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0xc9a96e,
    size: 0.18,
    transparent: true,
    opacity: 0.35,
    sizeAttenuation: true
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // ── 3D Shapes (abstract furniture-inspired forms) ──
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a96e,
    metalness: 0.3,
    roughness: 0.5
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x3d3730,
    metalness: 0.1,
    roughness: 0.7
  });

  const warmMat = new THREE.MeshStandardMaterial({
    color: 0x8b6b3d,
    metalness: 0.15,
    roughness: 0.6
  });

  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xe8e0d0,
    metalness: 0.05,
    roughness: 0.8
  });

  // Shape array: [geometry, material, x, y, z, rx, ry, rz, scale]
  const shapeDefs = [
    // Large box (sofa silhouette)
    { geo: new THREE.BoxGeometry(5, 2, 3),     mat: darkMat,  x:  12,  y: -4,  z: -8,  s: 1.0  },
    // Rounded box (table top)
    { geo: new THREE.BoxGeometry(6, 0.5, 3.5), mat: warmMat,  x: -14,  y:  2,  z: -12, s: 1.0  },
    // Torus (decorative ring)
    { geo: new THREE.TorusGeometry(2.5, 0.25, 16, 60), mat: goldMat, x: 18, y: 8, z: -15, s: 1.0 },
    // Cylinder (lamp base)
    { geo: new THREE.CylinderGeometry(0.4, 0.8, 4, 12), mat: goldMat, x: -18, y: -6, z: -10, s: 1.0 },
    // Sphere (decorative orb)
    { geo: new THREE.SphereGeometry(1.8, 24, 24),       mat: creamMat, x:  6, y:  8, z: -18, s: 1.0 },
    // Thin box (shelf)
    { geo: new THREE.BoxGeometry(8, 0.3, 1.5),           mat: warmMat,  x: -6, y: -8, z: -14, s: 1.0 },
    // Small torus knot (accent)
    { geo: new THREE.TorusKnotGeometry(1, 0.28, 80, 12), mat: goldMat, x: 22, y: -2, z: -20, s: 0.8 },
    // Box (picture frame)
    { geo: new THREE.BoxGeometry(3, 4, 0.2),              mat: darkMat,  x: -22, y:  4, z: -16, s: 1.0 },
    // Cone (plant/décor)
    { geo: new THREE.ConeGeometry(1.2, 3, 8),             mat: warmMat,  x:  0, y: -10, z: -12, s: 1.0 },
    // Small sphere
    { geo: new THREE.SphereGeometry(0.9, 16, 16),         mat: goldMat,  x: -8, y:  10, z: -16, s: 1.0 },
  ];

  const meshes = shapeDefs.map(def => {
    const mesh = new THREE.Mesh(def.geo, def.mat);
    mesh.position.set(def.x, def.y, def.z);
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    mesh.scale.setScalar(def.s);
    scene.add(mesh);
    return mesh;
  });

  // ── Mouse parallax ──
  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── Resize handler ──
  function onResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', onResize);

  // ── Render loop ──
  let time = 0;
  function animate() {
    requestAnimationFrame(animate);
    time += 0.008;

    // Smooth mouse follow
    targetX += (mouseX - targetX) * 0.04;
    targetY += (mouseY - targetY) * 0.04;

    // Rotate camera slightly with mouse
    camera.position.x = targetX * 3;
    camera.position.y = -targetY * 2;
    camera.lookAt(0, 0, 0);

    // Animate each mesh
    meshes.forEach((mesh, i) => {
      const speed = 0.003 + i * 0.0008;
      const offset = i * 0.6;
      mesh.rotation.x += speed * 0.8;
      mesh.rotation.y += speed;
      mesh.position.y += Math.sin(time * 0.7 + offset) * 0.006;
      mesh.position.x += Math.cos(time * 0.5 + offset) * 0.004;
    });

    // Drift particles
    particles.rotation.y += 0.0005;
    particles.rotation.x += 0.0002;

    // Pulse point light
    pointLight.intensity = 1.3 + Math.sin(time * 2) * 0.3;

    renderer.render(scene, camera);
  }

  animate();
}

/* ─────────────────────────────────────────
   4. NAVBAR
───────────────────────────────────────── */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link');

  function updateNavbar() {
    const scrolled = window.scrollY > 40;
    navbar.classList.toggle('scrolled', scrolled);
  }

  function updateActiveLink() {
    let currentId = '';
    sections.forEach(sec => {
      const top = sec.offsetTop - 120;
      if (window.scrollY >= top) currentId = sec.id;
    });

    navLinks.forEach(link => {
      const href = link.getAttribute('href')?.replace('#', '');
      link.classList.toggle('active', href === currentId);
    });
  }

  window.addEventListener('scroll', () => {
    updateNavbar();
    updateActiveLink();
  }, { passive: true });

  updateNavbar();
}

/* ─────────────────────────────────────────
   5. MOBILE MENU
───────────────────────────────────────── */
function initMobileMenu() {
  const burger    = document.getElementById('navBurger');
  const menu      = document.getElementById('mobileMenu');
  const closeBtn  = document.getElementById('mobileClose');
  const mobLinks  = document.querySelectorAll('.mob-link');

  if (!burger || !menu) return;

  function openMenu()  { menu.classList.add('open');  document.body.style.overflow = 'hidden'; }
  function closeMenu() { menu.classList.remove('open'); document.body.style.overflow = ''; }

  burger.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);
  mobLinks.forEach(link => link.addEventListener('click', closeMenu));

  // Close on outside click
  menu.addEventListener('click', e => { if (e.target === menu) closeMenu(); });
}

/* ─────────────────────────────────────────
   6. CUSTOM CURSOR
───────────────────────────────────────── */
function initCustomCursor() {
  const dot  = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');

  if (!dot || !ring) return;

  // Only on pointer devices
  if (!window.matchMedia('(hover: hover)').matches) return;

  let dotX = -100, dotY = -100;
  let ringX = -100, ringY = -100;
  let raf;

  document.addEventListener('mousemove', (e) => {
    dotX = e.clientX;
    dotY = e.clientY;
  });

  function animateCursor() {
    ringX += (dotX - ringX) * 0.14;
    ringY += (dotY - ringY) * 0.14;

    dot.style.left  = dotX  + 'px';
    dot.style.top   = dotY  + 'px';
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';

    raf = requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Hover effect on interactive elements
  const hoverTargets = document.querySelectorAll(
    'a, button, .col-card, .service-card, .testi-btn, .testi-dot, input, select, textarea'
  );

  hoverTargets.forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hovered'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hovered'));
  });

  document.addEventListener('mouseleave', () => {
    dot.style.opacity  = '0';
    ring.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    dot.style.opacity  = '1';
    ring.style.opacity = '1';
  });
}

/* ─────────────────────────────────────────
   7. SCROLL REVEAL (Intersection Observer)
───────────────────────────────────────── */
function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal-up, .reveal-card');

  if (!revealEls.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el    = entry.target;
        const delay = parseFloat(el.dataset.delay || 0);

        setTimeout(() => {
          el.classList.add('visible');
        }, delay * 1000);

        observer.unobserve(el);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  // Stagger cards within grids
  document.querySelectorAll('.collections-grid, .services-grid').forEach(grid => {
    const cards = grid.querySelectorAll('.reveal-card');
    cards.forEach((card, i) => {
      card.dataset.delay = (i * 0.08).toString();
    });
  });

  revealEls.forEach(el => observer.observe(el));
}

/* ─────────────────────────────────────────
   8. GSAP SCROLL ANIMATIONS (progressive enhancement)
───────────────────────────────────────── */
function initGSAPAnimations() {
  // Hero content entrance
  const heroLines = document.querySelectorAll('.hero-line');
  if (heroLines.length) {
    gsap.from(heroLines, {
      y: 80,
      opacity: 0,
      duration: 1.1,
      ease: 'power3.out',
      stagger: 0.12,
      delay: 0.4
    });
  }

  gsap.from('.hero-tag', {
    y: 20,
    opacity: 0,
    duration: 0.8,
    ease: 'power2.out',
    delay: 0.3
  });

  gsap.from('.hero-sub', {
    y: 24,
    opacity: 0,
    duration: 0.9,
    ease: 'power2.out',
    delay: 0.9
  });

  gsap.from('.hero-actions', {
    y: 24,
    opacity: 0,
    duration: 0.9,
    ease: 'power2.out',
    delay: 1.1
  });

  gsap.from('.hero-stats', {
    y: 24,
    opacity: 0,
    duration: 0.9,
    ease: 'power2.out',
    delay: 1.3
  });

  // About section parallax on image boxes
  const imgBoxes = document.querySelectorAll('.about-img-box');
  if (imgBoxes.length) {
    imgBoxes.forEach((box, i) => {
      gsap.to(box, {
        yPercent: i === 0 ? -10 : 10,
        ease: 'none',
        scrollTrigger: {
          trigger: '.about',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.5
        }
      });
    });
  }

  // Services bg text drift
  const bgText = document.querySelector('.services-bg-text');
  if (bgText) {
    gsap.to(bgText, {
      x: -80,
      ease: 'none',
      scrollTrigger: {
        trigger: '.services',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 2
      }
    });
  }

  // Section titles split-reveal
  document.querySelectorAll('.section-title').forEach(title => {
    gsap.from(title, {
      y: 40,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: title,
        start: 'top 88%',
        toggleActions: 'play none none none'
      }
    });
  });

  // Process steps stagger
  const steps = document.querySelectorAll('.step');
  if (steps.length) {
    gsap.from(steps, {
      x: -30,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out',
      stagger: 0.15,
      scrollTrigger: {
        trigger: '.process-steps',
        start: 'top 80%',
        toggleActions: 'play none none none'
      }
    });
  }
}

/* ─────────────────────────────────────────
   9. TESTIMONIALS SLIDER
───────────────────────────────────────── */
function initTestimonials() {
  const track     = document.getElementById('testimonialTrack');
  const prevBtn   = document.getElementById('testiPrev');
  const nextBtn   = document.getElementById('testiNext');
  const dotsWrap  = document.getElementById('testiDots');

  if (!track) return;

  const cards     = track.querySelectorAll('.testimonial-card');
  const total     = cards.length;
  let   current   = 0;
  let   autoTimer = null;

  // Create dots
  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'testi-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsWrap?.appendChild(dot);
  });

  function getDots() {
    return dotsWrap?.querySelectorAll('.testi-dot') || [];
  }

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    getDots().forEach((d, i) => d.classList.toggle('active', i === current));
  }

  prevBtn?.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
  nextBtn?.addEventListener('click', () => { goTo(current + 1); resetAuto(); });

  function startAuto() {
    autoTimer = setInterval(() => goTo(current + 1), 5000);
  }

  function resetAuto() {
    clearInterval(autoTimer);
    startAuto();
  }

  startAuto();

  // Touch/swipe support
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      dx < 0 ? goTo(current + 1) : goTo(current - 1);
      resetAuto();
    }
  });
}

/* ─────────────────────────────────────────
   10. COUNTER ANIMATION (Hero Stats)
───────────────────────────────────────── */
function initCounterAnimation() {
  const counters = document.querySelectorAll('.stat-num');
  if (!counters.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = parseInt(el.dataset.target || 0, 10);
      const duration = 1800;
      const step   = Math.ceil(target / (duration / 16));
      let current  = 0;

      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current.toLocaleString();
        if (current >= target) clearInterval(timer);
      }, 16);

      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
}

/* ─────────────────────────────────────────
   11. CONTACT FORM
───────────────────────────────────────── */
function initContactForm() {
  const form    = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  const submitBtn = document.getElementById('formSubmit');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Basic validation
    const name    = form.querySelector('#name');
    const phone   = form.querySelector('#phone');
    const service = form.querySelector('#service');

    let valid = true;

    [name, phone, service].forEach(field => {
      if (!field.value.trim()) {
        field.style.borderColor = '#e06060';
        valid = false;
        setTimeout(() => { field.style.borderColor = ''; }, 2000);
      }
    });

    if (!valid) return;

    // Simulate submission
    const btnText    = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    submitBtn.disabled = true;
    btnText.setAttribute('hidden', '');
    btnLoading.removeAttribute('hidden');

    setTimeout(() => {
      submitBtn.disabled = false;
      btnText.removeAttribute('hidden');
      btnLoading.setAttribute('hidden', '');
      success.removeAttribute('hidden');
      form.reset();

      // Build WhatsApp message and open
      const nameVal    = name.value;
      const phoneVal   = phone.value;
      const svcVal     = service.value;
      const msgVal     = form.querySelector('#message')?.value || '';

      const waMsg = encodeURIComponent(
        `Hello Hayee Interior! 👋\n\nName: ${nameVal}\nPhone: ${phoneVal}\nService: ${svcVal}\n${msgVal ? 'Message: ' + msgVal : ''}`
      );

      setTimeout(() => {
        window.open(`https://wa.me/917299030406?text=${waMsg}`, '_blank', 'noopener');
      }, 800);

      setTimeout(() => success.setAttribute('hidden', ''), 7000);
    }, 1400);
  });

  // Live input feedback
  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('input', () => {
      field.style.borderColor = '';
    });
  });
}

/* ─────────────────────────────────────────
   12. SMOOTH SCROLL (for anchor links)
───────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* ─────────────────────────────────────────
   13. NAVBAR BURGER ANIMATION (burger → X)
───────────────────────────────────────── */
(function burgerAnimation() {
  const burger = document.getElementById('navBurger');
  const menu   = document.getElementById('mobileMenu');
  if (!burger || !menu) return;

  const observer = new MutationObserver(() => {
    const isOpen = menu.classList.contains('open');
    const spans  = burger.querySelectorAll('span');
    if (spans.length < 3) return;

    if (isOpen) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
    }
  });

  observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
})();

/* ─────────────────────────────────────────
   14. HOVER CARD 3D TILT
───────────────────────────────────────── */
(function initCardTilt() {
  // Only on non-touch devices
  if (!window.matchMedia('(hover: hover)').matches) return;

  function applyTilt(card) {
    card.addEventListener('mousemove', (e) => {
      const rect  = card.getBoundingClientRect();
      const relX  = e.clientX - rect.left;
      const relY  = e.clientY - rect.top;
      const normX = (relX / rect.width  - 0.5) * 2;  // -1 to 1
      const normY = (relY / rect.height - 0.5) * 2;  // -1 to 1

      const rotX  = -normY * 6;  // max 6deg
      const rotY  =  normX * 6;

      card.style.transform = `
        perspective(900px)
        rotateX(${rotX}deg)
        rotateY(${rotY}deg)
        translateY(-8px)
        scale3d(1.02, 1.02, 1.02)
      `;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform 0.5s cubic-bezier(0.4,0,0.2,1), box-shadow 0.5s';
    });

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.15s ease, box-shadow 0.3s';
    });
  }

  document.querySelectorAll('.col-card, .service-card').forEach(applyTilt);
})();

/* ─────────────────────────────────────────
   15. SCROLL PROGRESS INDICATOR
───────────────────────────────────────── */
(function initScrollProgress() {
  const bar = document.createElement('div');
  bar.id = 'scrollProgress';
  bar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    width: 0%;
    background: linear-gradient(90deg, #a07840, #c9a96e, #e8d4a8);
    z-index: 9999;
    transition: width 0.1s linear;
    pointer-events: none;
  `;
  document.body.appendChild(bar);

  window.addEventListener('scroll', () => {
    const scrollTop  = window.scrollY;
    const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    const progress   = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width  = progress + '%';
  }, { passive: true });
})();

/* ─────────────────────────────────────────
   16. LAZY LOAD IMAGES (if real images added)
───────────────────────────────────────── */
(function initLazyLoad() {
  const images = document.querySelectorAll('img[loading="lazy"]');
  if ('loading' in HTMLImageElement.prototype) return; // native lazy load

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) img.src = img.dataset.src;
        observer.unobserve(img);
      }
    });
  });

  images.forEach(img => observer.observe(img));
})();