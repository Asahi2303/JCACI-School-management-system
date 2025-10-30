/* script.js - Frontend JavaScript for Jolly Children Academic Center */

// Load testimonials from API
(function() {
  const track = document.getElementById('carousel-track');
  const dotsContainer = document.querySelector('.dots');
  if (!track || !dotsContainer) return;

  async function loadTestimonials() {
    try {
  const response = await fetch('/api/testimonials'); // Fetch from backend API (relative path)
      if (!response.ok) throw new Error('Failed to fetch testimonials');
      let testimonials = await response.json();
      if (!Array.isArray(testimonials)) testimonials = [];

      // Client-side hardening: filter out empty/invalid entries and deduplicate by content+name
      const seen = new Set();
      testimonials = testimonials.filter(t => {
        if (!t) return false;
        const content = (t.content || '').toString().trim();
        const name = (t.client_name || t.name || '').toString().trim();
        if (!content) {
          console.warn('Skipping testimonial with empty content', t);
          return false;
        }
        // Prefer stable unique id when available; fallback to content+name
        const key = t.id ? `id:${t.id}` : (content + '|' + name).slice(0, 200);
        if (seen.has(key)) {
          console.warn('Duplicate testimonial skipped', t);
          return false;
        }
        seen.add(key);
        return true;
      });

      // Clear existing content
      track.innerHTML = '';
      dotsContainer.innerHTML = '';

      // Create slides and dots
      testimonials.forEach((testimonial, index) => {
        // Create slide
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', `${index + 1} of ${testimonials.length}`);

        slide.innerHTML = `
          <div class="card">
            <figure>
              <blockquote>${testimonial.content}</blockquote>
              <figcaption>— ${testimonial.client_name}<br><small class="role">${testimonial.client_role}</small></figcaption>
            </figure>
          </div>
        `;
        track.appendChild(slide);

        // Create dot
        const dot = document.createElement('button');
        dot.className = 'dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-controls', `slide-${index}`);
        dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        dot.addEventListener('click', () => {
          currentIndex = index;
          updateCarousel();
        });
        dotsContainer.appendChild(dot);
      });

      // Initialize carousel if testimonials exist
      if (testimonials.length > 0) {
        initializeCarousel();
      }
    } catch (error) {
      console.error('Error loading testimonials:', error);
      // Fallback to static testimonials if API fails
      loadStaticTestimonials();
    }
  }

  function loadStaticTestimonials() {
    const staticTestimonials = [
      {
        content: "Our child runs to school every day—teachers truly care.",
        client_name: "Parent of Grade 2 student",
        client_role: "Parent"
      },
      {
        content: "Engaging lessons and a warm, inclusive community.",
        client_name: "Parent of Kinder student",
        client_role: "Parent"
      },
      {
        content: "The balance of academics and arts has been wonderful.",
        client_name: "Parent of Grade 6 student",
        client_role: "Parent"
      },
      {
        content: "My child feels safe and happy every day.",
        client_name: "Parent of Grade 1 student",
        client_role: "Parent"
      }
    ];

    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    staticTestimonials.forEach((testimonial, index) => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${index + 1} of ${staticTestimonials.length}`);

      slide.innerHTML = `
        <div class="card">
          <figure>
            <blockquote>${testimonial.content}</blockquote>
            <figcaption>— ${testimonial.client_name}<br><small class="role">${testimonial.client_role}</small></figcaption>
          </figure>
        </div>
      `;
      track.appendChild(slide);

      const dot = document.createElement('button');
      dot.className = 'dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-controls', `slide-${index}`);
      dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => {
        currentIndex = index;
        updateCarousel();
      });
      dotsContainer.appendChild(dot);
    });

    initializeCarousel();
  }

  let currentIndex = 0;
  let carouselTimer;

  function updateCarousel() {
    const slides = Array.from(track.children);
    const dots = Array.from(dotsContainer.children);

    if (slides.length === 0) return;

    // Update track position
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update dots
    dots.forEach((dot, index) => {
      const isActive = index === currentIndex;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function nextSlide() {
    const slides = Array.from(track.children);
    if (slides.length === 0) return;
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
  }

  function prevSlide() {
    const slides = Array.from(track.children);
    if (slides.length === 0) return;
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarousel();
  }

  function initializeCarousel() {
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');

    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);

    updateCarousel();

    // Auto-advance carousel
    if (track.children.length > 1) {
      carouselTimer = setInterval(nextSlide, 6000);

      // Pause on hover
      track.addEventListener('mouseenter', () => clearInterval(carouselTimer));
      track.addEventListener('mouseleave', () => {
        carouselTimer = setInterval(nextSlide, 6000);
      });
    }
  }

  // Load testimonials when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTestimonials);
  } else {
    loadTestimonials();
  }
})();

// Load facilities from API
(function() {
  const facilitiesGrid = document.getElementById('facilities-grid');
  if (!facilitiesGrid) return;

  async function loadFacilities() {
    try {
  const response = await fetch('/api/facilities'); // Fetch from backend API (relative path)
      if (!response.ok) throw new Error('Failed to fetch facilities');
      const facilities = await response.json();

      facilitiesGrid.innerHTML = '';

      // Helper: resolve image URL coming from API/backend
      function resolveImageSrc(f) {
        const raw = (f && (f.image || f.imageUrl || f.image_url || f.photoUrl || f.url)) || '';
        if (!raw) return '';
        // Already absolute
        if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
        // Use current origin (includes hostname + port) so resources load on the correct port
        const apiOrigin = (window.location && window.location.origin) ? window.location.origin : (location.protocol + '//' + location.host);
        // If root-relative (starts with '/'), prefix with current origin
        if (raw.startsWith('/')) return apiOrigin + raw;
        // Otherwise assume relative path and prefix
        return apiOrigin + '/' + raw.replace(/^\/+/, '');
      }

      facilities.forEach(facility => {
        const article = document.createElement('article');
        article.className = 'card';
        article.setAttribute('aria-label', facility.title || 'Facility');

        const imgSrc = resolveImageSrc(facility);
        const imgHtml = imgSrc ? `<div class="facility-media"><img src="${imgSrc}" alt="${(facility.title||'') .replace(/"/g, '&quot;')}" class="facility-photo"/></div>` : '';

        article.innerHTML = `
          ${imgHtml}
          <div class="icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 21v-8l8-4 8 4v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3>${facility.title || ''}</h3>
          <p>${facility.description || ''}</p>
        `;
        facilitiesGrid.appendChild(article);
      });
    } catch (error) {
      console.error('Error loading facilities:', error);
      // Fallback to static facilities if API fails
      loadStaticFacilities();
    }
  }

  function loadStaticFacilities() {
    const staticFacilities = [
      {
        title: "Modern Classrooms",
        description: "Bright, technology-equipped spaces designed for interactive learning."
      },
      {
        title: "Science Laboratory",
        description: "Hands-on experiments and discovery in our state-of-the-art lab."
      },
      {
        title: "Library & Media Center",
        description: "Extensive collection of books and digital resources for all ages."
      },
      {
        title: "Art Studio",
        description: "Creative space for painting, sculpting, and artistic expression."
      },
      {
        title: "Playground & Sports Field",
        description: "Safe outdoor areas for physical activity and team sports."
      },
      {
        title: "Music Room",
        description: "Instruments and space for musical exploration and performance."
      }
    ];

    facilitiesGrid.innerHTML = '';

    staticFacilities.forEach(facility => {
      const article = document.createElement('article');
      article.className = 'card';
      article.setAttribute('aria-label', facility.title);

      const imgHtml = facility.imageUrl ? `<div class="facility-media"><img src="${facility.imageUrl}" alt="${(facility.title||'').replace(/"/g, '&quot;')}" class="facility-photo"/></div>` : '';

      article.innerHTML = `
        ${imgHtml}
        <div class="icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 21v-8l8-4 8 4v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3>${facility.title}</h3>
        <p>${facility.description}</p>
      `;
      facilitiesGrid.appendChild(article);
    });
  }

  // Load facilities when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFacilities);
  } else {
    loadFacilities();
  }
})();

// Contact Form Submission
(function() {
  const form = document.getElementById('contact-form');
  const formNote = document.getElementById('form-note');
  if (!form || !formNote) return;
  if (form.dataset.bound === '1') return; // avoid duplicate binding
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const submitButton = form.querySelector('button[type="submit"]');

    // Simple client-side validation to give fast feedback
    const errors = [];
    const name = (data.name || '').trim();
    const email = (data.email || '').trim();
    const message = (data.message || '').trim();
    const emailRe = /^(?!.{255,})([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+)\.[A-Z]{2,}$/i;
    if (!name || name.length < 2) errors.push('Please enter your name.');
    if (!email || !emailRe.test(email)) errors.push('Please enter a valid email.');
    if (!message || message.length < 10) errors.push('Please enter a longer message.');
    if (errors.length) {
      formNote.textContent = errors.join(' ');
      const firstInvalid = !name ? form.querySelector('#name') : (!email || !emailRe.test(email) ? form.querySelector('#email') : form.querySelector('#message'));
      firstInvalid && firstInvalid.focus();
      return;
    }

    submitButton.disabled = true;
    formNote.textContent = 'Sending...';

    try { // Add try block here
      const response = await fetch('/api/contact', { // Your future backend endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // Try to parse JSON; fallback to ok message
        let msg = 'Message sent successfully!';
        try { const j = await response.json(); if (j && j.status === 'ok') msg = 'Message sent successfully!'; } catch (_) {}
        formNote.textContent = msg;
        form.reset();
      } else {
        let errMsg = 'Something went wrong.';
        try { const j = await response.json(); if (j && j.errors) errMsg = j.errors.join(' '); } catch (_) {}
        throw new Error(errMsg);
      }
    } catch (error) { // Add catch block here
      formNote.textContent = 'Error: Could not send message. ' + error.message;
      console.error("Form submission error:", error); // Log the error to the console
    } finally {
      submitButton.disabled = false;
    }
  });
})();

/* Testimonials carousel initializer (icons-only cards) */
(function() {
  const track = document.getElementById('testi-track');
  const dotsWrap = document.getElementById('testi-dots');
  const prevBtn = document.getElementById('testi-prev');
  const nextBtn = document.getElementById('testi-next');
  if (!track || !dotsWrap) return;

  let testimonials = [];
  let index = 0;
  let timer = null;

  function render() {
    track.innerHTML = '';
    dotsWrap.innerHTML = '';
    console.debug('Rendering testimonials count=', testimonials.length, testimonials.map(t => ({ id: t.id, name: t.client_name })));
    testimonials.forEach((t, i) => {
      const slide = document.createElement('div');
      slide.className = 'testi-slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${i+1} of ${testimonials.length}`);
      slide.innerHTML = `
        <div class="testi-body">
          <svg class="testi-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7zM13 13h4v4h-4z" fill="currentColor" opacity="0.08"/>
            <path d="M7.5 11.5c.833-1.333 1.5-2 2-2s1.167.667 2 2c.833 1.333 2.5 3 4 3v1.5c-2.5 0-4.167-1.667-5-3-.833-1.333-1.5-2-2-2s-1.167.667-2 2c-.833 1.333-2.5 3-4 3V14.5c1.5 0 3.167-1.667 4-3z" fill="currentColor"/>
          </svg>
          <blockquote class="testi-quote">${escapeHtml((t.content||'').slice(0, 280))}</blockquote>
          <figcaption class="testi-meta"><strong class="testi-name">${escapeHtml(t.client_name||'Community')}</strong><span class="testi-role">${escapeHtml(t.client_role||'Parent')}</span></figcaption>
        </div>
      `;
      track.appendChild(slide);

      const dot = document.createElement('button');
      dot.className = 'testi-dot';
      dot.setAttribute('aria-label', `Show testimonial ${i+1}`);
      dot.addEventListener('click', () => goTo(i));
      // progress bar element inside dot
      const progress = document.createElement('span');
      progress.className = 'progress';
      dot.appendChild(progress);
      dotsWrap.appendChild(dot);
    });

    // Set track width to accommodate all slides side-by-side
  // Allow CSS to manage slide widths; track width stays default so translateX(-index*100%) shifts exactly one slide

    update();
  }

  function update() {
    const slides = Array.from(track.children);
    // Translate by exact viewport (slide) width in pixels to avoid percent math pitfalls
    const viewport = track.parentElement; // .testi-viewport
    const slideW = viewport ? viewport.clientWidth : track.clientWidth;
    track.style.transform = `translate3d(-${index * slideW}px, 0, 0)`;
    slides.forEach((s, i) => {
      // clear any per-slide transform to avoid conflicting vertical translations
      s.style.transform = '';
      // mark only the active slide as visible to assistive tech
      s.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
    const dots = Array.from(dotsWrap.children);
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
      d.setAttribute('aria-selected', i === index ? 'true' : 'false');
      d.tabIndex = 0;
    });
    if (prevBtn) prevBtn.disabled = testimonials.length <= 1;
    if (nextBtn) nextBtn.disabled = testimonials.length <= 1;

    // Announce slide change for screen reader users
    const announcer = document.getElementById('testi-announcer');
    if (announcer) {
      const current = testimonials[index] || {};
      announcer.textContent = `${(index + 1)} of ${testimonials.length}: ${current.client_name || 'Community'} — ${current.client_role || ''}`;
    }
  }

  function next() { index = (index + 1) % testimonials.length; update(); }
  function prev() { index = (index - 1 + testimonials.length) % testimonials.length; update(); }
  function goTo(i) { index = i; update(); }

  function startAuto() { if (timer) clearInterval(timer); timer = setInterval(next, 6000); }
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }

  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);
  // Delegated handler for dots (safer if dots are re-rendered)
  dotsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.testi-dot');
    if (!btn) return;
    const idx = Array.from(dotsWrap.children).indexOf(btn);
    if (idx >= 0) goTo(idx);
  });

  // Defensive: if prev/next buttons are replaced later, rebind (observes attribute changes)
  const btnObserver = new MutationObserver(() => {
    if (prevBtn && !prevBtn.onclick) prevBtn.addEventListener('click', prev);
    if (nextBtn && !nextBtn.onclick) nextBtn.addEventListener('click', next);
  });
  btnObserver.observe(track.parentElement || document.body, { childList: true, subtree: true });
  // Pause on hover/focus
  [track, prevBtn, nextBtn, dotsWrap].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', stopAuto);
    el.addEventListener('mouseleave', startAuto);
    el.addEventListener('focusin', stopAuto);
    el.addEventListener('focusout', startAuto);
  });

  // Progress control for pills
  const AUTO_MS = 6000;
  let progressTimeout = null;

  // Keep alignment on resize
  const ro = new ResizeObserver(() => update());
  if (track && track.parentElement) ro.observe(track.parentElement);
  window.addEventListener('resize', update);

  function resetProgress() {
    Array.from(dotsWrap.children).forEach(d => {
      const p = d.querySelector('.progress');
      if (p) {
        p.style.transition = 'none';
        p.style.width = '0%';
        // force reflow
        // eslint-disable-next-line no-unused-expressions
        p.offsetWidth;
        p.style.transition = `width ${AUTO_MS}ms linear`;
      }
    });
  }

  function startProgress() {
    resetProgress();
    const active = dotsWrap.children[index];
    if (!active) return;
    const p = active.querySelector('.progress');
    if (!p) return;
    // start filling
    // ensure any previous transition ended
    clearTimeout(progressTimeout);
    // small timeout to allow transition to apply
    progressTimeout = setTimeout(() => { p.style.width = '100%'; }, 50);
  }

  function pauseProgress() {
    Array.from(dotsWrap.children).forEach(d => {
      const p = d.querySelector('.progress');
      if (p) {
        const computed = window.getComputedStyle(p);
        const width = computed.width;
        // convert to percent
        const parentW = p.parentElement ? p.parentElement.clientWidth : 1;
        const percent = parentW ? (parseFloat(width) / parentW) * 100 : 0;
        p.style.transition = 'none';
        p.style.width = percent + '%';
      }
    });
    clearTimeout(progressTimeout);
  }

  // Hook pause/resume to existing pause handlers
  [track, prevBtn, nextBtn, dotsWrap].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', pauseProgress);
    el.addEventListener('mouseleave', startProgress);
    el.addEventListener('focusin', pauseProgress);
    el.addEventListener('focusout', startProgress);
  });

  // Helper to escape HTML to avoid XSS from server-rendered content
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchTestimonials() {
    try {
      const res = await fetch('/api/testimonials');
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      testimonials = Array.isArray(data) ? data : [];

      // Client-side hardening: filter invalid and dedupe (same logic used elsewhere)
      const seen = new Set();
      testimonials = testimonials.filter(t => {
        if (!t) return false;
        const content = (t.content || '').toString().trim();
        const name = (t.client_name || t.name || '').toString().trim();
        if (!content) return false;
        const key = t.id ? `id:${t.id}` : (content + '|' + name).slice(0, 200);
        if (seen.has(key)) {
          console.warn('Duplicate testimonial skipped', t);
          return false;
        }
        seen.add(key);
        return true;
      });
      if (testimonials.length === 0) throw new Error('No testimonials');
      render();
      startAuto();
    } catch (err) {
      // Fallback: show a single friendly static testimonial
      testimonials = [
        { content: 'Our child loves school — the teachers are warm and organized.', client_name: 'Parent', client_role: 'Parent' }
      ];
      render();
    }
  }

  // Keyboard support (left/right arrows) — keep inside IIFE so prev/next are in scope
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  // Start
  fetchTestimonials();

})();

// Load site statistics dynamically
(function() {
  const elStudents = document.getElementById('stat-total-students');
  const elStaff = document.getElementById('stat-total-staff');
  const elClubs = document.getElementById('stat-total-clubs');
  const elYears = document.getElementById('stat-years-of-joy');
  const elements = [elStudents, elStaff, elClubs, elYears];
  if (elements.every(el => !el)) return; // Section absent

  function animateValue(el, end) {
    if (!el) return;
    // If the element already displays the desired end value (hardcoded/static), do nothing.
    try {
      const current = parseInt(String(el.textContent || '').replace(/[^0-9\-]/g,''), 10);
      if (!isNaN(current) && current === Number(end)) return;
    } catch (ee) { /* ignore parsing errors and continue animation */ }
    const duration = 1200;
    const start = 0;
    const range = end - start;
    if (range <= 0) {
      el.textContent = end;
      return;
    }
    const startTs = performance.now();
    function frame(now) {
      const progress = Math.min(1, (now - startTs) / duration);
      const value = Math.floor(start + range * progress);
      el.textContent = value.toLocaleString();
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  async function loadStats() {
    let stats = null;
    try {
      const resp = await fetch('/api/site-stats');
      if (!resp.ok) throw new Error('Bad response');
      stats = await resp.json();
    } catch (e) {
      console.warn('Using fallback site stats due to error:', e && e.message ? e.message : e);
      // fallback from data-count attributes or zeros
      stats = {
        totalStudents: parseInt(elStudents && elStudents.getAttribute('data-count')) || 0,
        totalStaff: parseInt(elStaff && elStaff.getAttribute('data-count')) || 0,
        totalClubsTeams: parseInt(elClubs && elClubs.getAttribute('data-count')) || 0,
        yearsOfJoy: parseInt(elYears && elYears.getAttribute('data-count')) || 0
      };
    }

    animateValue(elStudents, stats.totalStudents || 0);
    animateValue(elStaff, stats.totalStaff || 0);
    animateValue(elClubs, stats.totalClubsTeams || 0);
    animateValue(elYears, stats.yearsOfJoy || 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadStats);
  } else {
    loadStats();
  }
})();

// Contact form AJAX submission
(function() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const statusEl = document.getElementById('form-note');
  let statusPanel = null;

  function ensureStatusPanel() {
    if (!statusPanel) {
      statusPanel = document.createElement('div');
      statusPanel.className = 'form-status-panel';
      statusEl && statusEl.parentNode.insertBefore(statusPanel, statusEl.nextSibling);
    }
    return statusPanel;
  }

  function setStatus(msg, type) {
    const panel = ensureStatusPanel();
    panel.textContent = msg;
    panel.className = 'form-status-panel ' + (type || '');
  }

  function fieldError(field, message) {
    const wrapper = field.closest('.field');
    if (!wrapper) return;
    wrapper.classList.remove('success');
    wrapper.classList.add('error');
    let err = wrapper.querySelector('.error-text');
    if (!err) {
      err = document.createElement('div');
      err.className = 'error-text';
      wrapper.appendChild(err);
    }
    err.textContent = message;
  }

  function clearFieldState(field) {
    const wrapper = field.closest('.field');
    if (!wrapper) return;
    wrapper.classList.remove('error');
    const err = wrapper.querySelector('.error-text');
    if (err) err.remove();
  }

  function markSuccess(field) {
    const wrapper = field.closest('.field');
    if (!wrapper) return;
    wrapper.classList.remove('error');
    const err = wrapper.querySelector('.error-text');
    if (err) err.remove();
    wrapper.classList.add('success');
  }

  ['input','blur'].forEach(evt => {
    form.addEventListener(evt, e => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!t.matches('#name,#email,#message')) return;
      if (!t.value.trim()) { clearFieldState(t); return; }
      if (t.id === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.value.trim())) {
        fieldError(t, 'Invalid email format');
      } else if (t.id === 'message' && t.value.trim().split(/\s+/).length < 3) {
        fieldError(t, 'Add a bit more detail');
      } else {
        markSuccess(t);
      }
    }, true);
  });

  form.addEventListener('submit', async (e) => {
    // If browser supports fetch and JS, use AJAX; otherwise allow normal submit
    if (!window.fetch) return;
    e.preventDefault();
    setStatus('Sending message…', 'pending');
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.originalText = submitBtn.textContent; submitBtn.textContent = 'Sending…'; }

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    // Simple client validation
    let hasError = false;
    if (!payload.name || !payload.name.trim()) { fieldError(form.querySelector('#name'), 'Name required'); hasError = true; }
    if (!payload.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email.trim())) { fieldError(form.querySelector('#email'), 'Valid email required'); hasError = true; }
    if (!payload.message || payload.message.trim().split(/\s+/).length < 3) { fieldError(form.querySelector('#message'), 'Message too short'); hasError = true; }
    if (hasError) { setStatus('Fix the highlighted fields.', 'error'); if (submitBtn){ submitBtn.disabled=false; submitBtn.textContent=submitBtn.dataset.originalText; } return; }

    try {
      const resp = await fetch(form.getAttribute('action') || '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: payload.name.trim(),
            email: payload.email.trim(),
            message: payload.message.trim(),
            website: payload.website || '',
            phone: payload.phone || ''
        })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(()=>({}));
        setStatus(data.errors ? data.errors.join(', ') : (data.error || 'Failed to send message'), 'error');
        if (submitBtn){ submitBtn.disabled=false; submitBtn.textContent=submitBtn.dataset.originalText; }
        return;
      }
      setStatus('Message sent successfully! We will get back to you soon.', 'success');
      form.reset();
      form.querySelectorAll('.field.success').forEach(el=>el.classList.remove('success'));
      if (submitBtn){ submitBtn.disabled=false; submitBtn.textContent=submitBtn.dataset.originalText; }
    } catch (err) {
      console.error('Contact form error:', err);
      setStatus('An unexpected error occurred. Please try again later.', 'error');
      if (submitBtn){ submitBtn.disabled=false; submitBtn.textContent=submitBtn.dataset.originalText; }
    }
  });
})();

// Stats skeleton & reduced motion handling
(function(){
  const nums = document.querySelectorAll('.stats .stat .num');
  if (!nums.length) return;
  nums.forEach(n => { if(!n.textContent.trim() || n.textContent.trim()==='0') n.classList.add('loading'); });
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Hook into existing loader (site-stats block already animates). We'll observe text changes.
  const observer = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.type === 'childList') {
        const el = m.target;
        if (el.textContent && el.textContent.trim() !== '0') el.classList.remove('loading');
      }
    });
  });
  nums.forEach(n => observer.observe(n, { childList: true }));
  if (prefersReduced) {
    // If reduced motion, remove loading shimmer after short delay
    setTimeout(()=> nums.forEach(n=>n.classList.remove('loading')), 300);
  }
})();

// Facilities fade-in
(function(){
  const grid = document.getElementById('facilities-grid');
  if(!grid) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target);} });
  }, { rootMargin: '40px 0px 0px 0px', threshold: 0.1 });
  const activate = () => {
    grid.querySelectorAll('article.card').forEach(card => {
      if (!card.classList.contains('facility-fade')) card.classList.add('facility-fade');
      io.observe(card);
    });
  };
  // initial attempt & after facilities load (existing populateFacilities already sets grid.innerHTML)
  activate();
  // Monkey-patch grid innerHTML setter (lightweight) for re-run
  const orig = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (orig && orig.set) {
    Object.defineProperty(grid, 'innerHTML', {
      set(val){ orig.set.call(this, val); requestAnimationFrame(activate); },
      get(){ return orig.get.call(this); }
    });
  }
})();

// Navigation active section highlighting
(function(){
  const links = Array.from(document.querySelectorAll('nav .nav-links a[href^="#"], .nav-panel a[href^="#"]'));
  if (!links.length) return;
  const map = new Map();
  links.forEach(a => { const id = a.getAttribute('href').slice(1); const sec = document.getElementById(id); if (sec) map.set(sec, a); });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const link = map.get(e.target);
      if (!link) return;
      if (e.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }, { threshold: 0.5 });
  map.forEach((_, sec) => io.observe(sec));
})();

// Testimonials carousel accessibility upgrades: pause/play + swipe
(function(){
  const track = document.getElementById('carousel-track');
  if (!track) return;
  const container = track.parentElement;
  if (!container) return;
  // Add controls container if not present
  let controls = document.querySelector('.carousel-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'carousel-controls';
    const after = container.nextElementSibling; // place after dots maybe
    (after && after.parentNode) ? after.parentNode.insertBefore(controls, after.nextSibling) : container.parentNode.appendChild(controls);
  }
  let paused = false;
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'carousel-toggle';
  toggleBtn.setAttribute('aria-pressed', 'false');
  toggleBtn.textContent = 'Pause';
  controls.appendChild(toggleBtn);
  toggleBtn.addEventListener('click', () => {
    paused = !paused;
    toggleBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    toggleBtn.textContent = paused ? 'Play' : 'Pause';
  });
  // Enhance dots with aria-label
  const dots = document.querySelectorAll('.dots .dot');
  dots.forEach((d,i)=> d.setAttribute('aria-label', 'Go to testimonial ' + (i+1)));
  // Swipe support
  let startX = 0; let deltaX = 0; let dragging = false;
  function onStart(e){ dragging = true; startX = (e.touches?e.touches[0].clientX:e.clientX); deltaX=0; }
  function onMove(e){ if(!dragging) return; const x=(e.touches?e.touches[0].clientX:e.clientX); deltaX = x-startX; track.style.transition='none'; track.style.transform += ''; }
  function onEnd(){ if(!dragging) return; dragging=false; if (Math.abs(deltaX) > 60) { const dir = deltaX < 0 ? 1 : -1; // reuse existing carousel global if present
      if (typeof nextSlide === 'function' && dir===1 && !paused) nextSlide();
      if (typeof prevSlide === 'function' && dir===-1 && !paused) prevSlide(); }
      track.style.transition=''; }
  track.addEventListener('touchstart', onStart, {passive:true});
  track.addEventListener('mousedown', onStart);
  window.addEventListener('touchmove', onMove, {passive:true});
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchend', onEnd);
  window.addEventListener('mouseup', onEnd);
})();

// Theme toggle & persistence
(function(){
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const STORAGE_KEY = 'site-theme';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  function apply(theme){
    if (theme === 'dark') { root.setAttribute('data-theme','dark'); btn.setAttribute('aria-pressed','true'); btn.textContent='☀️'; btn.setAttribute('aria-label','Activate light mode'); }
    else { root.removeAttribute('data-theme'); btn.setAttribute('aria-pressed','false'); btn.textContent='🌙'; btn.setAttribute('aria-label','Activate dark mode'); }
  }
  let current = localStorage.getItem(STORAGE_KEY) || (prefersDark ? 'dark' : 'light');
  apply(current);
  btn.addEventListener('click', () => {
    current = (current === 'dark') ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, current);
    apply(current);
  });
  // React to system changes if user hasn't explicitly chosen (optional)
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', e => {
    if (!localStorage.getItem(STORAGE_KEY)) { current = e.matches ? 'dark' : 'light'; apply(current); }
  });
})();