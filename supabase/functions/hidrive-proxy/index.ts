// Supabase Edge Function: HiDrive proxy for anonymous video/image streaming
// - Proxies requests to IONOS HiDrive WebDAV using Basic Auth stored in Supabase secrets
// - Allows your public website visitors to stream media without seeing an auth prompt
// - Usage: /functions/v1/hidrive-proxy?path=/public/media/01/01_short.mp4

// NOTE: Do not log secrets or full target URLs. Keep responses cacheable where possible.

// CORS helpers
function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "*, Range, Content-Type, Accept, Origin",
  } as Record<string, string>;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get("Origin") ?? undefined;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...corsHeaders(origin) } });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { ...corsHeaders(origin) } });
  }

  const pathParam = url.searchParams.get("path") || "";
  const ownerParam = url.searchParams.get("owner") || undefined;
  if (!pathParam || !pathParam.startsWith("/")) {
    return new Response("Missing or invalid 'path' query param. Expected like /public/media/...", {
      status: 400,
      headers: { ...corsHeaders(origin) },
    });
  }

  // Optional: restrict to public/media subtree for safety
  if (!pathParam.startsWith("/public/")) {
    return new Response("Access denied: path must start with /public/", { status: 403, headers: { ...corsHeaders(origin) } });
  }

  const username = Deno.env.get("HIDRIVE_USERNAME");
  const password = Deno.env.get("HIDRIVE_PASSWORD");
  if (!username || !password) {
    return new Response("HiDrive credentials not configured", {
      status: 503,
      headers: { ...corsHeaders(origin) },
    });
  }

  // Build target URL to HiDrive WebDAV
  const base = "https://webdav.hidrive.strato.com";
  // Determine owner: explicit query param or fallback to auth username
  const owner = (() => {
    const re = /^[a-zA-Z0-9._-]{1,64}$/;
    if (ownerParam && re.test(ownerParam)) return ownerParam;
    return Deno.env.get("HIDRIVE_USERNAME") || "";
  })();
  if (!owner) {
    return new Response("HiDrive owner not configured", { status: 500, headers: { ...corsHeaders(origin) } });
  }
  // Ensure no double slashes; encode only path segments, preserve slashes
  const targetUrl = `${base}/users/${encodeURIComponent(owner)}${pathParam}`;

  const range = req.headers.get("Range") || undefined;

  try {
    const auth = "Basic " + btoa(`${username}:${password}`);
    const reqRange = range || 'none';
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Authorization: auth,
        Accept: "*/*",
        // Force range for video streaming when GET has no Range
        ...(req.method === "GET" && !range ? { Range: "bytes=0-" } : {}),
        ...(range ? { Range: range } : {}),
        "User-Agent": "Lovable-HiDrive-Proxy/1.0",
      },
    });

    // Safe diagnostic log (no secrets/urls)
    try {
      console.log("hidrive-proxy", JSON.stringify({ method: req.method, owner, path: pathParam, range: reqRange, status: upstream.status, ct: upstream.headers.get("Content-Type"), ar: upstream.headers.get("Accept-Ranges") }));
    } catch (_) {}


    // If unauthorized or forbidden, avoid leaking details
    if (upstream.status === 401 || upstream.status === 403) {
      return new Response("Upstream authorization failed", {
        status: 502,
        headers: { ...corsHeaders(origin) },
      });
    }

    // Normalize 404 with explicit message to help clients
    if (upstream.status === 404) {
      return new Response("Upstream file not found", { status: 404, headers });
    }

    // Copy relevant headers
    const headers = new Headers();
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Accept-Ranges", upstream.headers.get("Accept-Ranges") || "bytes");

    // Determine a safe Content-Type (fallback by file extension if upstream is generic)
    const upstreamCT = upstream.headers.get("Content-Type");
    const lowerPath = pathParam.toLowerCase();
    const mimeMap: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".m4v": "video/x-m4v",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp"
    };
    const ext = Object.keys(mimeMap).find((e) => lowerPath.endsWith(e));
    const inferredCT = ext ? mimeMap[ext] : undefined;
    const finalCT = upstreamCT && upstreamCT !== "application/octet-stream" ? upstreamCT : (inferredCT || upstreamCT);
    if (finalCT) headers.set("Content-Type", finalCT);

    // Intentionally omit Content-Length to avoid mismatches with streamed body
    // const cl = upstream.headers.get("Content-Length");
    // if (cl) headers.set("Content-Length", cl);
    const cr = upstream.headers.get("Content-Range");
    if (cr) headers.set("Content-Range", cr);
    const lm = upstream.headers.get("Last-Modified");
    if (lm) headers.set("Last-Modified", lm);

    // Encourage inline rendering and safe cross-origin embedding
    headers.set("Content-Disposition", "inline");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");

    // CORS
    const c = corsHeaders(origin);
    for (const [k, v] of Object.entries(c)) headers.set(k, v);
    headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type");

    // Stream body
    if (req.method === "HEAD") {
      return new Response(null, { status: upstream.status, headers });
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    console.error("HiDrive proxy error", err);
    return new Response("Proxy error", { status: 500, headers: { ...corsHeaders(origin) } });
  }
});
