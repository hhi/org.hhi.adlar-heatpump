/* eslint-disable import/no-unresolved, node/no-missing-import, import/extensions */
import fs from 'fs';
import http from 'http';
import path from 'path';

const FAVICON_LINK = '<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">';

/** All dashboards use their own app's logo, including when navigating to another tab. */
export function withDashboardFavicon(html: string): string {
  const icon = /<link\b[^>]*\brel=["'](?:shortcut )?icon["'][^>]*>/i;
  if (icon.test(html)) return html.replace(icon, FAVICON_LINK);
  return html.replace(/<\/head>/i, `  ${FAVICON_LINK}\n</head>`);
}

export async function serveDashboardFavicon(appDir: string, res: http.ServerResponse): Promise<void> {
  try {
    const icon = await fs.promises.readFile(path.join(appDir, 'assets', 'dashboard-favicon.png'));
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(icon);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}
