import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { htmlInclude } from './plugins/html-include.js';

const r = (p) => resolve(import.meta.dirname, p);

export default defineConfig({
  appType: 'mpa',
  plugins: [htmlInclude({ root: import.meta.dirname })],
  build: {
    target: 'es2020',
    // Surface anything that drifts past the plan's §2.2 payload budget.
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      input: {
        home: r('index.html'),
        about: r('about.html'),
        services: r('services.html'),
        memberships: r('memberships.html'),
        faq: r('faq.html'),
        contact: r('contact.html'),
        contactThanks: r('contact/thank-you.html'),
        blog: r('blog/index.html'),
        blogWinter: r('blog/winter-checklist-second-home.html'),
        blogHomeWatch: r('blog/what-home-watch-actually-covers.html'),
        privacy: r('legal/privacy.html'),
        terms: r('legal/terms.html'),
      },
    },
  },
  server: {
    port: 5273,
    open: false,
  },
});
