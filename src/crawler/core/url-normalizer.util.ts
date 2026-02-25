export function normalizeUrl(rawUrl: string): {
  normalized: string;
  domain: string;
} {
  const url = new URL(rawUrl);

  url.hash = '';

  if (url.pathname === '/') {
    url.pathname = '';
  }

  const normalized = url.toString();
  const domain = url.hostname.toLowerCase();

  return { normalized, domain };
}
