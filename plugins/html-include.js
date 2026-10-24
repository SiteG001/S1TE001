import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Minimal build-time HTML includes.
 *
 *   <!--#include partials/header.html -->
 *
 * Keeps the header, footer and schema blocks in one place across eleven static
 * pages without dragging in a templating framework. Runs at build time, so the
 * shipped HTML is fully server-rendered — which is the entire point on a site
 * whose acquisition channel is local search (plan §2.4).
 */
export function htmlInclude({ root }) {
  const pattern = /<!--#include\s+([^\s>]+)\s*-->/g;
  const comment = /<!--[\s\S]*?-->/g;

  function expand(html, seen = new Set()) {
    return html.replace(pattern, (match, file) => {
      const path = resolve(root, file);
      if (seen.has(path)) {
        throw new Error(`html-include: circular include of ${file}`);
      }
      if (!existsSync(path)) {
        throw new Error(`html-include: cannot find ${file} (resolved to ${path})`);
      }
      const next = new Set(seen);
      next.add(path);
      // Nested includes are resolved first, so by the time comments are stripped
      // no #include directives are left to eat. Partials carry design rationale
      // (see brand-mark.html) that is worth keeping in source and not worth
      // shipping twice on every one of eleven pages. Page-level comments, which
      // this never sees, are left alone.
      return expand(readFileSync(path, 'utf8'), next).replace(comment, '');
    });
  }

  let server;

  return {
    name: 'wos-html-include',
    configureServer(devServer) {
      server = devServer;
      devServer.watcher.add(resolve(root, 'partials'));
      devServer.watcher.on('change', (file) => {
        if (dirname(file).endsWith('partials')) {
          devServer.ws.send({ type: 'full-reload' });
        }
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return expand(html);
      },
    },
  };
}
