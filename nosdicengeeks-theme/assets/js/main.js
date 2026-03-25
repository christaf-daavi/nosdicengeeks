/* ==========================================================================
   NosDicenGeeks Theme — main.js
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   Theme Manager
   -------------------------------------------------------------------------- */
const ThemeManager = (() => {
  const STORAGE_KEY = 'theme';
  const DARK_VALUE  = 'dark';
  const LIGHT_VALUE = 'light';
  const DATA_ATTR   = 'data-theme';

  const root         = document.documentElement;
  const systemDark   = window.matchMedia('(prefers-color-scheme: dark)');

  function getPreferred() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === DARK_VALUE || stored === LIGHT_VALUE) return stored;
    return systemDark.matches ? DARK_VALUE : LIGHT_VALUE;
  }

  function apply(theme) {
    if (theme === DARK_VALUE) {
      root.setAttribute(DATA_ATTR, DARK_VALUE);
    } else {
      root.removeAttribute(DATA_ATTR);
    }
  }

  function save(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function toggle() {
    const current = root.getAttribute(DATA_ATTR) === DARK_VALUE ? DARK_VALUE : LIGHT_VALUE;
    const next    = current === DARK_VALUE ? LIGHT_VALUE : DARK_VALUE;
    apply(next);
    save(next);
    updateToggleLabel(next);
  }

  function updateToggleLabel(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = theme === DARK_VALUE;
    btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    btn.setAttribute('aria-pressed', String(isDark));
  }

  function init() {
    const preferred = getPreferred();
    apply(preferred);
    updateToggleLabel(preferred);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }

    // Keep in sync when the OS preference changes and the user has no stored choice
    systemDark.addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const next = e.matches ? DARK_VALUE : LIGHT_VALUE;
        apply(next);
        updateToggleLabel(next);
      }
    });
  }

  return { init };
})();


/* --------------------------------------------------------------------------
   Nav Toggle (mobile hamburger)
   -------------------------------------------------------------------------- */
const NavManager = (() => {
  function init() {
    const toggle = document.querySelector('.nav-toggle');
    const nav    = document.querySelector('.main-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close nav when a link inside it is clicked (SPA-friendly)
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close nav on outside click
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') &&
          !nav.contains(e.target) &&
          !toggle.contains(e.target)) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close nav on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  return { init };
})();


/* --------------------------------------------------------------------------
   Scroll-aware header (adds shadow class when page is scrolled)
   -------------------------------------------------------------------------- */
const HeaderScroll = (() => {
  function init() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle('site-header--scrolled', window.scrollY > 8);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run once on load
  }

  return { init };
})();


/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  NavManager.init();
  HeaderScroll.init();
});
