/**
 * Shared site behaviour. Loaded on every page, deliberately tiny.
 * Nothing here is required for the page to be readable or usable.
 */

import { track } from './analytics.js';

/* --- Mobile navigation --------------------------------------------------- */

function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  if (!toggle || !nav) return;

  const main = document.querySelector('main');
  const footer = document.querySelector('.site-footer');

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.dataset.open = String(open);
    document.body.style.overflow = open ? 'hidden' : '';
    [main, footer].forEach((el) => el && (el.inert = open));
    if (open) nav.querySelector('a')?.focus();
  };

  // Keep Tab inside the open menu; the toggle stays in the loop so it can be closed.
  const trap = (e) => {
    if (e.key !== 'Tab' || toggle.getAttribute('aria-expanded') !== 'true') return;
    const items = [toggle, ...nav.querySelectorAll('a')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  nav.addEventListener('keydown', trap);
  toggle.addEventListener('keydown', trap);

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  // Leaving the mobile breakpoint should never strand a locked body.
  const mq = window.matchMedia('(min-width: 881px)');
  mq.addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
}

/* --- Current-page marker -------------------------------------------------
 * Set from the URL rather than hand-maintained on eleven pages.
 * ------------------------------------------------------------------------ */

function initCurrentPage() {
  const path = window.location.pathname.replace(/index\.html$/, '');
  document.querySelectorAll('.site-nav .nav-link').forEach((link) => {
    const href = new URL(link.getAttribute('href'), window.location.origin).pathname.replace(
      /index\.html$/,
      ''
    );
    const isSection = href !== '/' && path.startsWith(href);
    if (href === path || isSection) link.setAttribute('aria-current', 'page');
  });
}

/* --- Header inversion over a dark hero ----------------------------------- */

function initHeaderState() {
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('[data-hero-sentinel]');
  if (!header) return;

  if (!hero) {
    header.dataset.overHero = 'false';
    return;
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      header.dataset.overHero = String(entry.isIntersecting);
    },
    { rootMargin: `-${header.offsetHeight}px 0px 0px 0px`, threshold: 0 }
  );
  io.observe(hero);
}

/* --- Reveal on scroll ---------------------------------------------------- */

function initReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );

  targets.forEach((el) => io.observe(el));
}

/* --- FAQ: one open at a time --------------------------------------------- */

function initFaq() {
  const items = document.querySelectorAll('details.faq');
  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      items.forEach((other) => {
        if (other !== item && other.open && other.closest('.faq-list') === item.closest('.faq-list')) {
          other.open = false;
        }
      });
    });
  });
}

/* --- Consultation form ---------------------------------------------------
 * Posts JSON to /api/consult. Without JS the same form posts natively and the
 * function answers with a 303 to /contact/thank-you.html.
 * ------------------------------------------------------------------------ */

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function initConsultForm() {
  const form = document.querySelector('form[data-consult-form]');
  if (!form) return;

  // Native validation covers the no-JS case; with JS the inline messages take over.
  form.noValidate = true;

  // Tier cards on /memberships.html link through as ?tier=<slug>. Arriving with a
  // choice already made and then having to make it again is a needless drop-off.
  const select = form.querySelector('[data-tier-select]');
  const slug = new URLSearchParams(window.location.search).get('tier');
  if (select && slug) {
    const match = [...select.options].find((option) =>
      option.value.toLowerCase().replace(/[^a-z]+/g, '-').includes(slug.toLowerCase())
    );
    if (match) select.value = match.value;
  }

  // Server-side validation failed on a no-JS post and sent the visitor back here.
  const banner = document.querySelector('[data-error-banner]');
  if (banner && new URLSearchParams(window.location.search).has('error')) banner.hidden = false;

  const ts = form.querySelector('[data-form-ts]');
  if (ts) ts.value = String(Date.now());

  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const setStatus = (state, message) => {
    if (!status) return;
    status.dataset.state = state;
    status.textContent = message;
  };

  // Inline validation: message on blur, cleared as soon as the field is valid.
  form.querySelectorAll('input[required], select[required]').forEach((field) => {
    const msg = document.createElement('p');
    msg.className = 'field-error';
    msg.id = `${field.id || field.name}-error`;
    (field.closest('.consent') || field).after(msg);
    field.setAttribute(
      'aria-describedby',
      [field.getAttribute('aria-describedby'), msg.id].filter(Boolean).join(' ')
    );
    const check = () => {
      const bad = !field.validity.valid;
      field.setAttribute('aria-invalid', String(bad));
      msg.textContent = bad ? field.dataset.error || 'This field is required.' : '';
    };
    field.addEventListener('blur', check);
    field.addEventListener('change', check);
    field.addEventListener('input', () => field.getAttribute('aria-invalid') === 'true' && check());
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.querySelectorAll('[required]').forEach((f) => f.dispatchEvent(new Event('blur')));
      form.querySelector(':invalid')?.focus();
      setStatus('error', 'Please complete the highlighted fields so we can reach you.');
      return;
    }

    button.disabled = true;
    button.dataset.label = button.textContent;
    button.textContent = 'Sending…';
    setStatus('pending', '');

    try {
      const data = Object.fromEntries(new FormData(form));
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.errors?.form || String(res.status));

      const first = (data.name || '').trim().split(' ')[0];
      const success = document.createElement('div');
      success.className = 'form-success';
      success.setAttribute('role', 'status');
      success.tabIndex = -1;
      success.innerHTML = `
        <h2>Thank you, ${escapeHtml(first)}.</h2>
        <p>Katie will call or email within one business day. A copy of this note is on its way to your inbox.</p>
        <p>Something urgent? Call or text <a href="tel:+14708593583">470-859-3583</a>.</p>`;
      form.replaceWith(success);
      success.focus();
      track('consultation_submitted', { tier: data.tier || 'not_sure' });
    } catch {
      button.disabled = false;
      button.textContent = button.dataset.label;
      setStatus(
        'error',
        'Something went wrong sending your request. Please call or text 470-859-3583, or email consultations@WhiteOakStewardship.com.'
      );
    }
  });
}

/* --- Event tracking ------------------------------------------------------
 * One delegated listener; elements opt in with data-track and a section
 * declares its place with data-track-location. Never put personal data here.
 * ------------------------------------------------------------------------ */

const where = (el) => el.closest('[data-track-location]')?.dataset.trackLocation || 'body';

function initTracking() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a, button');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('tel:')) return track('phone_click', { location: where(a) });
    if (href.startsWith('mailto:')) return track('email_click', { location: where(a) });
    if (a.dataset.track) {
      const props = { location: where(a) };
      if (a.dataset.trackTier) props.tier = a.dataset.trackTier;
      track(a.dataset.track, props);
    }
  });

  document.querySelectorAll('details.faq').forEach((d) => {
    d.addEventListener('toggle', () => {
      if (d.open) {
        track('faq_open', { question: d.querySelector('summary')?.textContent.trim().slice(0, 100) });
      }
    });
  });
}

/* --- Footer year ---------------------------------------------------------- */

function initYear() {
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

initNav();
initCurrentPage();
initHeaderState();
initReveal();
initFaq();
initConsultForm();
initTracking();
initYear();
