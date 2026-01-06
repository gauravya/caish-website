/**
 * CAISH - Warmth & Delight Enhancements
 *
 * Subtle, natural interactions that make reading a joy.
 * Respects user preferences and accessibility.
 */

const Enhancements = {
  // Check if user prefers reduced motion
  prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  // Respect data saver / slow connections
  prefersReducedData: (() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return false;
    return Boolean(connection.saveData) || /2g/.test(connection.effectiveType || '');
  })(),
  // Check if device supports touch (likely mobile)
  isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  // Track prefetched URLs to avoid duplicates
  prefetchedUrls: new Set(),

  init() {
    // Critical: Always init prefetching for instant navigation
    this.initLinkPrefetch();

    if (!this.prefersReducedMotion) {
      this.initPageEntrance();
    }

    const runEnhancements = () => {
      // Only run visual enhancements if user hasn't opted out
      if (!this.prefersReducedMotion) {
        this.initScrollReveal();
        this.initImageFadeIn();
        this.initSmoothAnchors();
        // Skip parallax on touch devices - can cause scroll jank
        if (!this.isTouchDevice) {
          this.initParallax();
        }
        this.initReadingProgress();
      }

      // These are always safe to run
      this.initWarmHovers();
      this.initLinkUnderlines();
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(runEnhancements, { timeout: 1500 });
    } else {
      setTimeout(runEnhancements, 1);
    }
  },

  /**
   * Link Prefetching - McMaster-Carr technique
   * Prefetch pages on hover for instant navigation
   * Uses both <link rel="prefetch"> and fetch() for maximum compatibility
   */
  initLinkPrefetch() {
    if (this.prefersReducedData) return;
    // Get all internal navigation links
    const internalLinks = document.querySelectorAll('a[href^="/"], a[href^="./"], .nav-links a, .mobile-nav a');

    internalLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href === '#' || href.startsWith('#') || href.startsWith('http')) return;

      // Normalize the URL
      const url = new URL(href, window.location.origin).pathname;
      const htmlUrl = url.endsWith('/') ? url + 'index.html' : (url.includes('.') ? url : url + '.html');

      let prefetchTimeout;

      link.addEventListener('mouseenter', () => {
        // Small delay to avoid prefetching on accidental hovers
        prefetchTimeout = setTimeout(() => {
          this.prefetchPage(htmlUrl);
        }, 65);
      });

      link.addEventListener('mouseleave', () => {
        clearTimeout(prefetchTimeout);
      });

      // Also prefetch on touch start for mobile
      link.addEventListener('touchstart', () => {
        this.prefetchPage(htmlUrl);
      }, { passive: true });
    });

    // Prefetch visible links in viewport (speculative)
    if ('IntersectionObserver' in window) {
      const prefetchObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const href = entry.target.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
              const url = new URL(href, window.location.origin).pathname;
              const htmlUrl = url.endsWith('/') ? url + 'index.html' : (url.includes('.') ? url : url + '.html');
              // Low priority prefetch for visible links
              setTimeout(() => this.prefetchPage(htmlUrl, 'low'), 1000);
            }
            prefetchObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px' });

      document.querySelectorAll('.nav-links a').forEach(link => {
        prefetchObserver.observe(link);
      });
    }
  },

  prefetchPage(url, priority = 'high') {
    if (this.prefetchedUrls.has(url)) return;
    this.prefetchedUrls.add(url);

    // Method 1: Use <link rel="prefetch"> (browser-managed caching)
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'document';
    if (priority === 'low') {
      link.setAttribute('importance', 'low');
    }
    document.head.appendChild(link);

    // Method 2: Also use fetch for immediate cache warming (high priority only)
    if (priority === 'high' && 'fetch' in window) {
      fetch(url, {
        priority: 'low',
        credentials: 'same-origin',
        cache: 'force-cache'
      }).catch(() => {}); // Silently ignore errors
    }
  },

  /**
   * Scroll Reveal - Elements gracefully appear as you scroll
   * Creates a sense of discovery and unfolding content
   */
  initScrollReveal() {
    const revealElements = document.querySelectorAll(
      '.initiative-item, .event-card, .home-event-item, .timeline-point, ' +
      '.feature, .expectation, .track, .mentor, .research-card, .team-member, ' +
      '.mission-text, .mission-image, .about-text, .about-image, ' +
      '.fellowship-content > p, .mars-content > p, .director, ' +
      '.faq-title, .faq-card'
    );

    // Set initial state
    revealElements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
      // Stagger effect for siblings
      const parent = el.parentElement;
      const siblings = parent ? Array.from(parent.children).filter(
        child => revealElements.contains ? Array.from(revealElements).includes(child) : false
      ) : [];
      const index = siblings.indexOf(el);
      if (index > 0) {
        el.style.transitionDelay = `${index * 0.08}s`;
      }
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  },

  /**
   * Image Fade In - Images appear gently when loaded
   * No jarring pop-ins
   */
  initImageFadeIn() {
    const images = document.querySelectorAll(
      '.hero-image img, .mission-image img, .fellowship-image img, ' +
      '.mars-hero-image img, .mars-working-image img, .event-cover img, ' +
      '.director-photo img.outline, .team-member-photo img, .mentor-photo'
    );

    images.forEach(img => {
      if (img.complete) {
        img.style.opacity = '1';
        return;
      }

      img.style.opacity = '0';
      img.style.transition = 'opacity 0.5s ease-out';

      img.addEventListener('load', () => {
        img.style.opacity = '1';
      });
    });
  },

  /**
   * Smooth Anchor Scrolling - Fluid navigation within pages
   * Uses natural easing for a flowing feel
   */
  initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition - 100;
        const duration = Math.min(800, Math.max(400, Math.abs(distance) * 0.5));

        this.smoothScrollTo(startPosition, distance, duration);
      });
    });
  },

  // Eased scroll animation
  smoothScrollTo(start, distance, duration) {
    let startTime = null;

    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

    const animation = currentTime => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      window.scrollTo(0, start + distance * easeOutCubic(progress));

      if (progress < 1) {
        requestAnimationFrame(animation);
      }
    };

    requestAnimationFrame(animation);
  },

  /**
   * Subtle Parallax - Gentle depth on scroll
   * Very subtle - adds dimension without being distracting
   */
  initParallax() {
    const parallaxElements = [
      { selector: '.hero-image img', speed: 0.15 },
      { selector: '.mission-image img', speed: 0.1 },
      { selector: '.cta-image img', speed: 0.08 }
    ];

    let ticking = false;

    const updateParallax = () => {
      parallaxElements.forEach(({ selector, speed }) => {
        const el = document.querySelector(selector);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const viewportCenter = window.innerHeight / 2;
        const elementCenter = rect.top + rect.height / 2;
        const offset = (viewportCenter - elementCenter) * speed;

        el.style.transform = `translateY(${offset}px)`;
      });
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  },

  /**
   * Reading Progress - Warm indicator showing scroll progress
   * Subtle, encouraging, shows you're making progress
   */
  initReadingProgress() {
    // Only add on content-heavy pages
    const isContentPage = document.querySelector('.fellowship-content, .mars-content, .about-section');
    if (!isContentPage) return;

    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.innerHTML = '<div class="reading-progress-fill"></div>';
    document.body.appendChild(progressBar);

    const fill = progressBar.querySelector('.reading-progress-fill');

    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.pageYOffset / scrollHeight) * 100;
      fill.style.width = `${progress}%`;
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  },

  /**
   * Page Entrance - Gentle fade in when page loads
   * Feels like a curtain gently opening
   */
  initPageEntrance() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease-out';

    // Wait for DOM to be ready, then fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.style.opacity = '1';
      });
    });
  },

  /**
   * Warm Hovers - Elements respond with warmth to attention
   * Subtle lift, glow, and responsiveness
   */
  initWarmHovers() {
    // Add warm glow to interactive cards
    const warmElements = document.querySelectorAll(
      '.initiative-item, .timeline-point, .feature, .expectation, ' +
      '.track, .event-card, .research-card, .btn, .btn-primary'
    );

    warmElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        el.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    });

    // Logo warmth on hover - subtle pulse
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.addEventListener('mouseenter', () => {
        logo.style.transform = 'scale(1.05)';
        logo.style.transition = 'transform 0.3s ease-out';
      });
      logo.addEventListener('mouseleave', () => {
        logo.style.transform = 'scale(1)';
      });
    }
  },

  /**
   * Link Underlines - Animated underlines that draw on hover
   * More organic than instant underlines
   */
  initLinkUnderlines() {
    const contentLinks = document.querySelectorAll(
      '.fellowship-content a:not(.btn):not(.btn-primary), ' +
      '.mars-content a:not(.btn):not(.btn-primary), ' +
      '.about-text a:not(.btn):not(.btn-primary), ' +
      'p a:not(.btn):not(.btn-primary)'
    );

    contentLinks.forEach(link => {
      // Skip if already has special styling
      if (link.classList.contains('inline-link') ||
          link.classList.contains('text-link') ||
          link.closest('.initiative-content')) return;

      link.style.backgroundImage = 'linear-gradient(currentColor, currentColor)';
      link.style.backgroundSize = '0% 1px';
      link.style.backgroundRepeat = 'no-repeat';
      link.style.backgroundPosition = 'left bottom';
      link.style.transition = 'background-size 0.3s ease-out';

      link.addEventListener('mouseenter', () => {
        link.style.backgroundSize = '100% 1px';
      });
      link.addEventListener('mouseleave', () => {
        link.style.backgroundSize = '0% 1px';
      });
    });
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Enhancements.init());
} else {
  Enhancements.init();
}
