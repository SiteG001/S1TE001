/**
 * Vendor-neutral event shim — plan §4.3.
 *
 * Pushes to dataLayer (GA4 via GTM), calls gtag directly if present, and always
 * dispatches a DOM event so QA can watch the stream with no analytics wired.
 * Phase 4 of the SOW swaps in the real property ID; nothing here changes.
 */
export function track(name, params = {}) {
  const payload = { event: name, ...params };

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
    if (typeof window.plausible === 'function') window.plausible(name, { props: params });
  } catch {
    /* analytics must never break the page */
  }

  document.dispatchEvent(new CustomEvent('wos:track', { detail: payload }));

  if (new URLSearchParams(window.location.search).has('debug')) {
    // eslint-disable-next-line no-console
    console.info('[wos:track]', name, params);
  }
}
