// Supabase Edge Function: HiDrive proxy for anonymous video/image streaming
// - Proxies requests to IONOS HiDrive WebDAV using Basic Auth stored in Supabase secrets
// - Allows public website visitors to stream media without exposing credentials
// - Usage (stream):   /functions/v1/hidrive-proxy?path=/public/media/01/01_short.mp4&owner=juliecamus
// - Usage (listing):  /functions/v1/hidrive-proxy?path=/Common/public/01&list=1&owner=juliecamus

// CORS helpers
function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, accept, origin',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
  } as Record<string, string>;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get('Origin') ?? undefined;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...corsHeaders(origin) } });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { ...corsHeaders(origin) } });
  }

  const pathParam = url.searchParams.get('path') || '';
  const ownerParam = url.searchParams.get('owner') || undefined;
  const list = url.searchParams.get('list'); // if present and "1", perform PROPFIND

  if (!pathParam || !pathParam.startsWith('/')) {
    return new Response("Missing or invalid 'path' query param. Expected like /public/media/...", {
      status: 400,
      headers: { ...corsHeaders(origin) },
    });
  }

  // Allow either /public/... (user namespace) or /Common/public/... (root common area)
  const allowed = pathParam.startsWith('/public/') || pathParam.startsWith('/Common/public/');
  if (!allowed) {
    return new Response('Access denied: path must start with /public/ or /Common/public/', {
      status: 403,
      headers: { ...corsHeaders(origin) },
    });
  }

  const username = Deno.env.get('HIDRIVE_USERNAME');
  const password = Deno.env.get('HIDRIVE_PASSWORD');
  if (!username || !password) {
    return new Response('HiDrive credentials not configured', {
      status: 503,
      headers: { ...corsHeaders(origin) },
    });
  }

  const base = 'https://webdav.hidrive.strato.com';

  // Resolve target URL. Common is a root namespace (no /users/<owner> prefix)
  const resolveUrl = (p: string, owner: string) => {
    if (p.startsWith('/Common/')) {
      return { url: `${base}${p}`, usedPath: p, root: 'root' as const };
    }
    return { url: `${base}/users/${encodeURIComponent(owner)}${p}`, usedPath: p, root: 'user' as const };
  };

  const owner = (() => {
    const re = /^[a-zA-Z0-9._-]{1,64}$/;
    if (ownerParam && re.test(ownerParam)) return ownerParam;
    return username; // fallback to auth user
  })();

  // PROPFIND directory listing
  if (list && req.method === 'GET') {
    const { url: listUrl } = resolveUrl(pathParam, owner);
    const body = `<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:">\n  <d:prop>\n    <d:displayname/>\n    <d:resourcetype/>\n    <d:getcontentlength/>\n    <d:getlastmodified/>\n    <d:getcontenttype/>\n  </d:prop>\n</d:propfind>`;

    try {
      const resp = await fetch(listUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: 'Basic ' + btoa(`${username}:${password}`),
          Depth: '1',
          'Content-Type': 'text/xml',
          Accept: '*/*',
          'User-Agent': 'Lovable-HiDrive-Proxy/1.0',
        },
        body,
      });

      const text = await resp.text();
      try {
        console.log('hidrive-proxy-list', JSON.stringify({ owner, path: pathParam, status: resp.status }));
      } catch (_) {}

      return new Response(text, { status: resp.status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/xml' } });
    } catch (err) {
      console.error('HiDrive list error', err);
      return new Response('List error', { status: 500, headers: { ...corsHeaders(origin) } });
    }
  }

  const range = req.headers.get('Range') || undefined;

  try {
    const auth = 'Basic ' + btoa(`${username}:${password}`);
    const reqRange = range || 'none';

    // Initial request
    let { url: targetUrl, usedPath } = resolveUrl(pathParam, owner);
    let upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Authorization: auth,
        Accept: '*/*',
        ...(req.method === 'GET' && !range ? { Range: 'bytes=0-' } : {}),
        ...(range ? { Range: range } : {}),
        'User-Agent': 'Lovable-HiDrive-Proxy/1.0',
      },
    });

    // Log first attempt
    try {
      console.log('hidrive-proxy', JSON.stringify({ method: req.method, owner, path: usedPath, range: reqRange, status: upstream.status, ct: upstream.headers.get('Content-Type'), ar: upstream.headers.get('Accept-Ranges') }));
    } catch (_) {}

    // Fallback: if /public/... 404s, try /Common/public/... (root namespace)
    if (upstream.status === 404 && usedPath.startsWith('/public/')) {
      const altPath = '/Common' + usedPath;
      const alt = await fetch(`${base}${altPath}`, {
        method: req.method,
        headers: {
          Authorization: auth,
          Accept: '*/*',
          ...(req.method === 'GET' && !range ? { Range: 'bytes=0-' } : {}),
          ...(range ? { Range: range } : {}),
          'User-Agent': 'Lovable-HiDrive-Proxy/1.0',
        },
      });
      try { console.log('hidrive-proxy-fallback', JSON.stringify({ owner, tried: altPath, status: alt.status })); } catch (_) {}
      if (alt.ok) {
        upstream = alt;
        usedPath = altPath;
      }
    }

    // If unauthorized or forbidden, avoid leaking details
    if (upstream.status === 401 || upstream.status === 403) {
      return new Response('Upstream authorization failed', { status: 502, headers: { ...corsHeaders(origin) } });
    }

    // Prepare headers for client
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('Accept-Ranges', upstream.headers.get('Accept-Ranges') || 'bytes');

    // Content type
    const upstreamCT = upstream.headers.get('Content-Type');
    const lowerPath = usedPath.toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.m4v': 'video/x-m4v',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const ext = Object.keys(mimeMap).find((e) => lowerPath.endsWith(e));
    const inferredCT = ext ? mimeMap[ext] : undefined;
    const finalCT = upstreamCT && upstreamCT !== 'application/octet-stream' ? upstreamCT : (inferredCT || upstreamCT);
    if (finalCT) headers.set('Content-Type', finalCT);

    const cr = upstream.headers.get('Content-Range');
    if (cr) headers.set('Content-Range', cr);
    const lm = upstream.headers.get('Last-Modified');
    if (lm) headers.set('Last-Modified', lm);

    // Inline
    headers.set('Content-Disposition', 'inline');
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    // CORS
    const c = corsHeaders(origin);
    for (const [k, v] of Object.entries(c)) headers.set(k, v);

    if (req.method === 'HEAD') {
      return new Response(null, { status: upstream.status, headers });
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    console.error('HiDrive proxy error', err);
    return new Response('Proxy error', { status: 500, headers: { ...corsHeaders(origin) } });
  }
});
