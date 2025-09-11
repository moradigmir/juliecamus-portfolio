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

  // Allow limited root prefixes: /public, /Common, /Personal or /Shared (case-insensitive)
  const allowedPrefixes = [/^\/public(\/|$)/i, /^\/common(\/|$)/i, /^\/personal(\/|$)/i, /^\/shared(\/|$)/i];
  const allowed = allowedPrefixes.some((re) => re.test(pathParam));
  if (!allowed) {
    return new Response('Access denied: path must start with /public, /Common, /Personal or /Shared', {
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

  // Resolve target URL. Common is under user namespace: /users/{owner}/Common/...
  const resolveUrl = (p: string, owner: string) => {
    // Both /public/... and /Common/public/... are under user namespace
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

      // Fallbacks for common mis-paths
      let outResp = resp;
      let outPath = pathParam;
      if (resp.status === 404) {
        const alts: string[] = [];
        if (pathParam.toLowerCase() === '/common/public') {
          alts.push('/Common');
        }
        if (pathParam.toLowerCase().startsWith('/common/public/')) {
          alts.push('/Common/' + pathParam.slice('/Common/public/'.length));
        }
        if (pathParam.toLowerCase().startsWith('/public/')) {
          alts.push('/Common' + pathParam); // /Common/public/...
          alts.push('/Common/' + pathParam.slice('/public/'.length)); // /Common/...
        }
        for (const alt of alts) {
          const { url: altUrl } = resolveUrl(alt, owner);
          const altResp = await fetch(altUrl, {
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
          try { console.log('hidrive-proxy-list-fallback', JSON.stringify({ owner, tried: alt, status: altResp.status })); } catch (_) {}
          if (altResp.ok) { outResp = altResp; outPath = alt; break; }
        }
      }

      const text = await outResp.text();
      try {
        console.log('hidrive-proxy-list', JSON.stringify({ owner, path: outPath, status: outResp.status }));
      } catch (_) {}

      return new Response(text, { status: outResp.status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/xml' } });
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

    // Try ALL possible HiDrive WebDAV roots systematically  
    if (upstream.status === 404) {
      const testPaths = [
        usedPath,
        `/users/${owner}${usedPath}`,
        `/root${usedPath}`,
        `${usedPath}`,
      ];
      
      const testBases = [
        base, // https://webdav.hidrive.strato.com
        `${base}/users/${owner}`, // /users/juliecamus
        `${base}/root`, // /root
      ];

      for (const testBase of testBases) {
        for (const testPath of testPaths) {
          const testUrl = testPath.startsWith('/') ? `${testBase}${testPath}` : `${testBase}/${testPath}`;
          const alt = await fetch(testUrl, {
            method: req.method,
            headers: {
              Authorization: auth,
              Accept: '*/*',
              ...(req.method === 'GET' && !range ? { Range: 'bytes=0-' } : {}),
              ...(range ? { Range: range } : {}),
              'User-Agent': 'Lovable-HiDrive-Proxy/1.0',
            },
          });
          try { console.log('hidrive-test', JSON.stringify({ base: testBase.replace('https://webdav.hidrive.strato.com', ''), path: testPath, status: alt.status, url: testUrl })); } catch (_) {}
          if (alt.ok) { upstream = alt; usedPath = testPath; break; }
        }
        if (upstream.ok) break;
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
